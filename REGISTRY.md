# Registry stub — Fix It For Me

| Field | Value |
| --- | --- |
| id | `fix-it` |
| slug | `fix-it-for-me` |
| path | `/tools/fix-it` |
| live | `false` |
| accent | Ember `#b4553f` (`--ggt-accent`) |
| group | Shop |

## Sale desk

Shop `POST /api/sale` body (after allowlist merges):

```json
{ "url": "https://example.com", "product": "fix-it", "toolId": "fix-it", "variant": "standard" }
```

Variants: `standard` | `plus` — amounts from shop `lib/config.ts` only.

**Today** the desk allowlist is only `seo-audit` | `accessibility`. Sending `fix-it` before the Groundwork PR merges would price as SEO $29. This app **refuses checkout** until `fix-it` is listed in `NEXT_PUBLIC_SHOP_SALE_PRODUCTS`. No fallthrough.
