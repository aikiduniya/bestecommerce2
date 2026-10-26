# Checkout public order code fix

## Root cause
The current `place_order` RPC returns `id`, numeric `order_number`, and `guest_token`, but omits the generated `order_code`. Guest checkout passed that numeric value directly into tracking. A type-only change would not fix this.

## Fix
- Read the stored public code through a new owner/guest-token-verified server function when the placement response lacks it; no database migration needed.
- COD tracking redirects use that code. Tracking thank-you text, input, headings, account history and order details use the public code.
- Legacy numeric tracking remains supported; a successful response with a code normalizes the input to it. Return requests retain their internal numeric reference.
- Card checkout's customer-visible line item uses the stored code. Card success reads the order through its stored Stripe session link instead of trusting numeric metadata; success text and tracking links use the code.
- Missing codes never fall back to displaying a numeric internal identifier. No public codes are fabricated.

## Executed verification
**PASS:** 59 tests across 7 files; 0 failures. Command:
```sh
bunx vitest run src/test/order-reference.test.ts src/test/checkout-public-code.test.tsx src/test/email-render.test.ts src/test/order-notifications.test.ts src/test/stripe-notifications.test.ts src/test/stripe.test.ts src/test/stripe-webhook.test.ts
```
New tests cover legacy placement responses, public-code redirects, automatic tracking lookup, manual code lookup, numeric backward compatibility, matching email variables, guest token and authenticated-owner checks, session-linked card success and unlinked-session privacy.

**PASS:** preview's automated build/typecheck reports `build OK`.

**PASS:** read-only Chromium check at `/track?n=ELE-261026-9520&e=qa%40example.test`; the actual order input displays `ELE-261026-9520`, email prefills, no runtime errors. This synthetic reference is not a real order and does not verify a database-backed lookup.

**NOT TESTED:** real COD placement, delivered confirmation email and live database-backed tracking as one end-to-end flow. No independent disposable backend is available in this sandbox, and no existing orders were changed. Checkout/lookup and email variable matching were exercised with isolated doubles, not real delivery. Real card charge is also untested; its success flow was exercised using doubles without enabling Stripe.

## Exact files changed
- `src/lib/order-reference.ts` (new)
- `src/lib/order-reference.functions.ts` (new)
- `src/lib/payments.functions.ts`
- `src/routes/{-$lang}/checkout.tsx`
- `src/routes/{-$lang}/track.tsx`
- `src/routes/payment.success.tsx`
- `src/routes/_authenticated/order.$id.tsx`
- `src/routes/_authenticated/account.tsx`
- `src/test/order-reference.test.ts` (new)
- `src/test/checkout-public-code.test.tsx` (new)
- `AGENTS.md`
- `roadmap.md`
- `docs/checkout-order-code-verification.md` (this report)

Project memory also records the public-code requirement. No compiled files, migrations, credentials, Stripe settings, SMTP settings or database records were modified.