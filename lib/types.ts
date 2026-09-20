/** Three-way split buckets — the free product. */
export type Bucket = "included" | "needs_decision" | "not_possible";

export type PlatformId =
  | "wix"
  | "squarespace"
  | "shopify"
  | "wordpress-com"
  | "wordpress-org"
  | "webflow"
  | "godaddy"
  | "unknown";

export type Finding = {
  id: string;
  title: string;
  detail: string;
  bucket: Bucket;
  /** Why this bucket — shown in free preview; never invents buyer facts. */
  reason: string;
  evidence?: string;
};

export type AuditInput = {
  url?: string;
  description?: string;
};

export type AuditResult = {
  ok: true;
  inputUrl: string | null;
  finalUrl: string | null;
  platform: PlatformId;
  platformLabel: string;
  fetchOk: boolean;
  fetchNote?: string;
  descriptionUsed: boolean;
  findings: Finding[];
  counts: Record<Bucket, number>;
  summary: string;
};

export type AuditError = {
  ok: false;
  message: string;
};

/** Paid plan variants — amounts only from shop-mirrored env. */
export type VariantId = "standard" | "plus";

export type PriceTiers = {
  standardCents: number | null;
  plusCents: number | null;
};
