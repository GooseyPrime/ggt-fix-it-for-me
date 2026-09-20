"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ACCENT, TOOL_NAME, fixItSaleLive, publicBasePath } from "@/lib/config";
import { anyPriceConfigured, shopPrices, variantPrice } from "@/lib/prices";
import type { AuditResult, Bucket, PriceTiers, VariantId } from "@/lib/types";

import { BucketColumn } from "./BucketColumn";
import { FixItOutcome } from "./FixItOutcome";

const AUDIT_STORAGE_KEY = "ggt.fix-it.audit";

export function buildApiUrl(path: string, basePath = publicBasePath()): string {
  const prefix = basePath.replace(/\/$/, "");
  return `${prefix}${path}`;
}

export function defaultVariantId(prices: PriceTiers): VariantId {
  if (prices.standardCents != null) return "standard";
  if (prices.plusCents != null) return "plus";
  return "standard";
}

export function FixItApp() {
  const resultsRef = useRef<HTMLElement | null>(null);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const prices = useMemo(() => shopPrices(), []);
  const basePath = useMemo(() => publicBasePath(), []);
  const initialVariant = useMemo(() => defaultVariantId(prices), [prices]);
  const [variant, setVariant] = useState<VariantId>(initialVariant);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockNote, setUnlockNote] = useState("");

  const saleLive = useMemo(() => fixItSaleLive(), []);
  const standard = variantPrice(prices, "standard");
  const plus = variantPrice(prices, "plus");
  const showPrices = anyPriceConfigured(prices);
  const selected = variantPrice(prices, variant);

  useEffect(() => {
    const saved = readStoredAudit();
    if (saved) {
      setResult(saved);
    }

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id") || params.get("sessionId");
    if (!sessionId) return;

    void (async () => {
      try {
        const res = await fetch(buildApiUrl("/api/verify", basePath), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          paid?: boolean;
          message?: string;
          kind?: string;
        };
        if (json.paid) {
          setUnlocked(true);
          setUnlockNote(
            json.kind === "local_unlock"
              ? "Local unlock (dev only)."
              : "Payment verified by the shop desk.",
          );
        } else if (json.message) {
          setError(json.message);
        }
      } catch {
        setError("Could not verify the checkout session.");
      }
    })();
  }, [basePath]);

  useEffect(() => {
    if (!variantPrice(prices, variant)) {
      setVariant(initialVariant);
    }
  }, [initialVariant, prices, variant]);

  useEffect(() => {
    try {
      if (result) {
        window.sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(result));
      } else {
        window.sessionStorage.removeItem(AUDIT_STORAGE_KEY);
      }
    } catch {
      /* ignore storage failures */
    }
  }, [result]);

  async function onAudit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch(buildApiUrl("/api/audit", basePath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, description }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Audit failed.");
      }
      setResult(json as AuditResult);
      setTimeout(
        () => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth" });
          resultsRef.current?.focus();
        },
        50,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onBuy() {
    setError("");
    setPaying(true);
    try {
      const returnUrl = window.location.href.split("?")[0] ?? "/";
      const res = await fetch(buildApiUrl("/api/sale", basePath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result?.finalUrl || result?.inputUrl || url,
          variant,
          returnUrl,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; url?: string; message?: string };
      if (!res.ok || !json.ok || !json.url) {
        throw new Error(json.message || "Checkout is not available.");
      }
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setPaying(false);
    }
  }

  return (
    <main className="ggt-root" style={{ ["--ggt-accent" as string]: ACCENT }}>
      <div className="ggt-wrap">
        <header className="ggt-hero">
          <p className="ggt-eyebrow">Golden Goose Tools</p>
          <h1>{TOOL_NAME}</h1>
          <p className="ggt-lede">
            Paste a URL or describe what is broken. Free: an honest three-way split — included,
            needs your decision, or not possible on your platform. We never invent business facts.
          </p>
        </header>

        <form onSubmit={onAudit}>
          <div className="fifm-field">
            <label className="fifm-label" htmlFor="fifm-url">
              Website address
            </label>
            <input
              id="fifm-url"
              className="ggt-input"
              type="text"
              inputMode="url"
              placeholder="yourbusiness.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="Website address"
            />
          </div>
          <div className="fifm-field">
            <label className="fifm-label" htmlFor="fifm-desc">
              What is wrong (optional)
            </label>
            <textarea
              id="fifm-desc"
              className="fifm-textarea"
              placeholder="Example: titles look generic, photos have no alt text, Wix will not let me change the header…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="fifm-actions">
            <button className="ggt-btn" type="submit" disabled={busy}>
              {busy ? "Auditing…" : "Run free audit"}
            </button>
          </div>
        </form>

        {error ? (
          <p className="fifm-error" role="alert">
            {error}
          </p>
        ) : null}

        {result ? (
          <section className="ggt-result" id="fifm-results" ref={resultsRef} tabIndex={-1}>
            <p className="fifm-pill">{result.platformLabel}</p>
            <h2 style={{ marginTop: 0 }}>{result.summary}</h2>
            {result.fetchNote ? <p className="fifm-note">{result.fetchNote}</p> : null}

            <div className="fifm-buckets">
              {(["included", "needs_decision", "not_possible"] as Bucket[]).map((bucket) => (
                <BucketColumn
                  key={bucket}
                  bucket={bucket}
                  findings={result.findings.filter((f) => f.bucket === bucket)}
                />
              ))}
            </div>

            <FixItOutcome
              result={result}
              unlocked={unlocked}
              unlockNote={unlockNote}
              showPrices={showPrices}
              saleLive={saleLive}
              variant={variant}
              setVariant={setVariant}
              standard={standard}
              plus={plus}
              selected={selected}
              paying={paying}
              onBuy={onBuy}
            />

            <p className="fifm-disclaimer">
              This is a practical fix plan, not a promise of rankings, legal compliance, or platform
              workarounds. If your builder blocks a change, we say so and stop.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function readStoredAudit(): AuditResult | null {
  try {
    const raw = window.sessionStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as AuditResult).findings)) {
      return null;
    }
    return parsed as AuditResult;
  } catch {
    return null;
  }
}
