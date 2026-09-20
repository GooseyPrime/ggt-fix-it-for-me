# Golden Goose Tools — Fix It For Me

Free audit with an honest three-way split: **included**, **needs your decision**, **not possible on your platform**. Paid unlocks go through the shop sale/verify desk only — **no Stripe secrets in this repo**.

- Accent: Ember `#b4553f`
- Registry: id `fix-it`, path `/tools/fix-it`, **`live: false`**
- Sale body: `{ url, product: "fix-it", toolId: "fix-it", variant: "standard"|"plus" }`
- Until the shop allowlist includes `fix-it`, checkout is **refused** (never falls through to `seo-audit`)

## Local

```bash
npm i && npm run dev
```

Open http://localhost:3000 or http://localhost:3000/tools/fix-it

## Checks

```bash
npm run typecheck && npm test && npm run build
```

Draft PRs only. Brandon merges.
