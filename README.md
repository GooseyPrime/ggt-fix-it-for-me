# Golden Goose Tools — Fix It For Me

A free website audit that sorts every finding into three lists: **included** (we can fix it),
**needs your decision**, and **not possible on your platform**. If the buyer wants the work done,
they pay once on the shop's checkout (Standard or Plus), then fill in an intake form. The form goes
to the owner by email, who does the work by hand.

Served on the shop at `/tools/fix-it` (the shop proxies this deployment).

## How it works

1. Free audit (`/api/audit`). Nothing is stored.
2. "Hire us" starts a shop checkout (`/api/sale` → shop `POST /api/sale`, `product: "fix-it"`, `variant: "standard" | "plus"`). The shop decides the price. This tool holds no payment keys.
3. The shop sends the buyer back with `?session_id=…`. The page checks it (`/api/verify` → shop `GET /api/verify`). It only counts when the shop says the checkout is paid **and** for `fix-it`.
4. The intake form (site, what to fix, contact email, optional access notes with a no-passwords warning) posts to `/api/intake`. The server re-checks the checkout with the shop, takes the plan from the shop's record, and emails the owner through Resend. A checkout reference is used as the email's idempotency key, so a double click cannot send two emails.
5. Checkout is **closed** (`/api/sale` returns 503, button disabled) until the email settings exist, so nobody pays for a request that would never arrive.

## Environment variables

| Name | Where | Required | Purpose |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | server | yes | Resend API key used to send the notification |
| `FIX_IT_NOTIFY_EMAIL` | server | yes | Who receives requests (comma-separated allowed) |
| `FIX_IT_FROM_EMAIL` | server | no | Sender; defaults to Resend's test sender, which only delivers to the Resend account's own email |
| `NEXT_PUBLIC_SHOP_ORIGIN` | public | no | Defaults to `https://www.goldengoosetools.com` |
| `NEXT_PUBLIC_PRICE_STANDARD_CENTS`, `NEXT_PUBLIC_PRICE_PLUS_CENTS` | public | no | Price labels shown on the page (display only) |

No secrets belong in this repository.

## Local

```bash
npm install
npm run dev   # http://localhost:3000/tools/fix-it
```

## Checks

```bash
npm run typecheck && npm test && npm run build
```

Draft PRs only. The owner merges.
