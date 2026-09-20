"use client";

import type { AuditResult, VariantId } from "@/lib/types";

type PriceLabel = { label: string } | null;

export function FixItOutcome({
  result,
  unlocked,
  unlockNote,
  showPrices,
  saleLive,
  variant,
  setVariant,
  standard,
  plus,
  selected,
  paying,
  onBuy,
}: {
  result: AuditResult;
  unlocked: boolean;
  unlockNote: string;
  showPrices: boolean;
  saleLive: boolean;
  variant: VariantId;
  setVariant: (v: VariantId) => void;
  standard: PriceLabel;
  plus: PriceLabel;
  selected: PriceLabel;
  paying: boolean;
  onBuy: () => void;
}) {
  if (unlocked) {
    return (
      <div className="fifm-unlocked">
        <h2>Paid plan unlocked</h2>
        <p className="fifm-note">{unlockNote}</p>
        <p>
          Next we prepare a change list from <strong>Included</strong>, a decision checklist
          from <strong>Needs your decision</strong>, and a clear refusal list for{" "}
          <strong>Not possible</strong>. Nothing outside those buckets. No invented rankings,
          reviews, or certifications.
        </p>
        <ol>
          {result.findings
            .filter((f) => f.bucket === "included")
            .map((f) => (
              <li key={f.id}>
                <strong>{f.title}</strong> — {f.reason}
              </li>
            ))}
        </ol>
        {result.counts.included === 0 ? (
          <p className="fifm-note">
            No included items on this pass — we will not invent work to sell you.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <aside className="ggt-tally ggt-tally--locked" aria-label="Locked tally">
        <p style={{ margin: 0 }}>
          {result.counts.included} included · {result.counts.needs_decision} need a
          decision · {result.counts.not_possible} not possible
        </p>
      </aside>

      <section className="ggt-paywall">
        <h2>Unlock the fix plan</h2>
        {showPrices ? (
          <div className="fifm-tier" role="radiogroup" aria-label="Plan">
            {standard ? (
              <label>
                <input
                  type="radio"
                  name="variant"
                  checked={variant === "standard"}
                  onChange={() => setVariant("standard")}
                />
                <span>
                  Standard — <strong>{standard.label}</strong> one-time
                </span>
              </label>
            ) : null}
            {plus ? (
              <label>
                <input
                  type="radio"
                  name="variant"
                  checked={variant === "plus"}
                  onChange={() => setVariant("plus")}
                />
                <span>
                  Plus — <strong>{plus.label}</strong> one-time
                </span>
              </label>
            ) : null}
          </div>
        ) : (
          <p className="fifm-note">
            Price comes from the shop config when the Fix It SKU is live. This tool never
            invents a dollar amount.
          </p>
        )}

        {!saleLive ? (
          <p className="fifm-note" role="status">
            Checkout is not live yet for Fix It For Me on the shop sale desk. Until the
            shop allowlist includes <code>fix-it</code>, we refuse checkout so you are not
            billed as SEO Audit ($29). The free three-way split above is yours to keep.
          </p>
        ) : null}

        <div className="fifm-actions">
          <button
            className="ggt-btn"
            type="button"
            onClick={onBuy}
            disabled={paying || !saleLive}
          >
            {paying
              ? "Opening checkout…"
              : saleLive
                ? selected
                  ? `Unlock — ${selected.label}`
                  : "Unlock via shop checkout"
                : "Checkout not live yet"}
          </button>
        </div>
        <p className="ggt-trust">
          Paid once. Yours to keep. No account required for the free pass. Stripe stays in
          the shop — this tool holds no payment secrets.
        </p>
      </section>
    </>
  );
}
