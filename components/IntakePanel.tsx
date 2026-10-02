"use client";

import { useEffect, useRef, useState } from "react";
import type { VariantId } from "@/lib/types";

export type PaidSession = { sessionId: string; variant: VariantId; targetUrl?: string };

type Field = "siteUrl" | "whatToFix" | "contactEmail" | "accessNotes";

const DONE_KEY = (sessionId: string) => `ggt.fix-it.done.${sessionId}`;

export function IntakePanel({
  session,
  intakeUrl,
  initialSite,
}: {
  session: PaidSession;
  intakeUrl: string;
  initialSite: string;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [siteUrl, setSiteUrl] = useState(session.targetUrl || initialSite);
  const [whatToFix, setWhatToFix] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<Field | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const focusDone = useRef(false);

  useEffect(() => {
    try {
      const done = window.localStorage.getItem(DONE_KEY(session.sessionId));
      if (done) setReference(done);
    } catch {
      /* ignore */
    }
  }, [session.sessionId]);

  useEffect(() => {
    if (reference && focusDone.current) {
      focusDone.current = false;
      headingRef.current?.focus();
    }
  }, [reference]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorField(null);
    setBusy(true);
    try {
      const res = await fetch(intakeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          siteUrl,
          whatToFix,
          contactEmail,
          accessNotes,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        field?: Field;
        reference?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        if (json?.field) setErrorField(json.field);
        throw new Error(json?.message || "We could not send your request. Please try again.");
      }
      const ref = json.reference || session.sessionId.slice(-8);
      try {
        window.localStorage.setItem(DONE_KEY(session.sessionId), ref);
      } catch {
        /* ignore */
      }
      focusDone.current = true;
      setReference(ref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const plan = session.variant === "plus" ? "Plus" : "Standard";

  if (reference) {
    return (
      <section className="fifm-unlocked" aria-labelledby="fifm-done-title">
        <h2 id="fifm-done-title" tabIndex={-1} ref={headingRef}>
          Request received
        </h2>
        <p>
          Thank you. We have your {plan} request and will read it and reply by email at the address you gave.
          We will tell you plainly if anything you asked for cannot be done on your platform.
        </p>
        <p className="fifm-note">Your reference: {reference}. Keep it if you write to us about this order.</p>
      </section>
    );
  }

  return (
    <section className="fifm-unlocked" aria-labelledby="fifm-intake-title">
      <h2 id="fifm-intake-title">Payment received. Now tell us what to fix.</h2>
      <p className="fifm-note">
        Plan: <strong>{plan}</strong>. This form goes straight to us. We will reply by email.
      </p>

      <p className="fifm-warning" role="note">
        <strong>Do not put passwords in this form.</strong> We will never ask you to email or type one.
        If we need access, we will tell you how to give it safely, for example by adding us as a user you can remove later.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <div className="fifm-field">
          <label className="fifm-label" htmlFor="fifm-intake-site">
            Website address
          </label>
          <input
            id="fifm-intake-site"
            className="ggt-input"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            aria-invalid={errorField === "siteUrl"}
            aria-describedby={errorField === "siteUrl" ? "fifm-intake-error" : undefined}
            required
          />
        </div>

        <div className="fifm-field">
          <label className="fifm-label" htmlFor="fifm-intake-fix">
            What you want fixed
          </label>
          <textarea
            id="fifm-intake-fix"
            className="fifm-textarea"
            rows={6}
            placeholder="For example: the page title and description, missing photo descriptions, and the phone number in the footer."
            value={whatToFix}
            onChange={(e) => setWhatToFix(e.target.value)}
            aria-invalid={errorField === "whatToFix"}
            aria-describedby={errorField === "whatToFix" ? "fifm-intake-error" : undefined}
            required
          />
        </div>

        <div className="fifm-field">
          <label className="fifm-label" htmlFor="fifm-intake-email">
            Your email
          </label>
          <input
            id="fifm-intake-email"
            className="ggt-input"
            type="email"
            autoComplete="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            aria-invalid={errorField === "contactEmail"}
            aria-describedby={errorField === "contactEmail" ? "fifm-intake-error" : undefined}
            required
          />
        </div>

        <div className="fifm-field">
          <label className="fifm-label" htmlFor="fifm-intake-access">
            How we can get into your site (optional)
          </label>
          <textarea
            id="fifm-intake-access"
            className="fifm-textarea"
            rows={3}
            placeholder="Which website builder you use and who owns the account. No passwords."
            value={accessNotes}
            onChange={(e) => setAccessNotes(e.target.value)}
            aria-invalid={errorField === "accessNotes"}
            aria-describedby={errorField === "accessNotes" ? "fifm-intake-error" : undefined}
          />
        </div>

        {error ? (
          <p className="fifm-error" role="alert" id="fifm-intake-error">
            {error}
          </p>
        ) : null}

        <div className="fifm-actions">
          <button className="ggt-btn" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send my request"}
          </button>
        </div>
      </form>
    </section>
  );
}
