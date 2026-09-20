import type { Bucket, Finding } from "@/lib/types";

const BUCKET_META: Record<Bucket, { title: string; blurb: string }> = {
  included: {
    title: "Included",
    blurb: "We can fix these without inventing facts about your business.",
  },
  needs_decision: {
    title: "Needs your decision",
    blurb: "Only you can supply the missing words, photos, or choices.",
  },
  not_possible: {
    title: "Not possible on your platform",
    blurb: "Your builder locks these controls — we will not pretend otherwise.",
  },
};

export function BucketColumn({
  bucket,
  findings,
}: {
  bucket: Bucket;
  findings: Finding[];
}) {
  const meta = BUCKET_META[bucket];
  return (
    <div className="fifm-bucket ggt-result" style={{ marginTop: 0 }}>
      <h3>{meta.title}</h3>
      <p className="fifm-note" style={{ marginTop: 0 }}>
        {meta.blurb}
      </p>
      {findings.length === 0 ? (
        <p className="fifm-note">None on this pass.</p>
      ) : (
        <ul>
          {findings.map((f) => (
            <li key={f.id}>
              <strong>{f.title}</strong>
              <div>{f.detail}</div>
              <p className="fifm-reason">{f.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
