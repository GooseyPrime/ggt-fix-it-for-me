"use client";

import type { AuditResult, VariantId } from "@/lib/types";

type PriceLabel = { label: string } | null;

export function FixItOutcome({
  result,
  open,
  variant,
  setVariant,
  standard,
  plus,
  selected,
  paying,
  onBuy,
}: {
  result: AuditResult;
  open: boolean | null;
  variant: VariantId;
  setVariant: (v: VariantId) => void;
  standard: PriceLabel;
  plus: PriceLabel;
  selected: PriceLabel;
  paying: boolean;
  onBuy: () => void;
}) {
  return (
    <section className="ggt-paywall" aria-labelledby="fifm-hire-title">
      <h2 id="fifm-hire-title">Want us to fix it for you?</h2>
      <p>
        Pay once, then fill in a short form with your site, what you want fixed and how to reach you. We read it
        and reply by email. Nothing is started until you have paid.
      </p>
      {result.counts.included === 0 ? (
        <p className="fifm-note">
          Nothing landed in the Included list this time, so there may be nothing for us to fix yet. You can still
          ask for something specific in the form.
        </p>
      ) : null}

      <fieldset className="fifm-tier">
        <legend className="fifm-label">Choose a plan</legend>
        <label>
          <input
            type="radio"
            name="variant"
            checked={variant === "standard"}
            onChange={() => setVariant("standard")}
          />
          <span>
            Standard: <strong>{standard ? standard.label : "price shown at checkout"}</strong> one-time. We make
            the fixes in your Included list.
          </span>
        </label>
        <label>
          <input type="radio" name="variant" checked={variant === "plus"} onChange={() => setVariant("plus")} />
          <span>
            Plus: <strong>{plus ? plus.label : "price shown at checkout"}</strong> one-time. A wider scope of
            work; we confirm exactly what is covered by email.
          </span>
        </label>
      </fieldset>

      {open === false ? (
        <p className="fifm-note" role="status">
          We are not taking new requests right now. The free audit above is yours to keep.
        </p>
      ) : null}

      <div className="fifm-actions">
        <button className="ggt-btn" type="button" onClick={onBuy} disabled={paying || open !== true}>
          {paying ? "Opening checkout…" : selected ? `Hire us: ${selected.label}` : "Hire us"}
        </button>
      </div>
      <p className="ggt-trust">Paid once. You pay on a secure checkout page; nothing is charged until you confirm there.</p>
    </section>
  );
}
