# C2 Coffee Mobile Launch Playbook

Last updated: August 3, 2026

## 1. Purpose

This document converts the current C2 Coffee product discussion into a build-ready launch plan for the mobile app and backend.

It covers:

- phase 1 launch decisions for the first public release
- phase 2 expansion after the first 1,000 registered users
- login and OTP options with pricing implications
- payment and wallet strategy
- membership, loyalty, and subscription options
- backend scope needed to ship quickly

This document assumes:

- the mobile app is pickup only
- the frontend in [mobile_app](C:/DCStack/C2Coffee/C2Coffee/mobile_app/) is already far along
- the backend still needs real implementation
- the app is targeted at Malaysia first

## 2. Current Product Direction

### Final product assumptions from discussion

- authentication should use phone number as the primary login ID
- OTP should be sent by WhatsApp if possible
- SMS should remain as fallback
- ordering should be pickup only for launch
- the app should support Malaysian payment behavior
- Touch 'n Go eWallet is preferred as a payment method
- a real internal stored-value wallet should not be phase 1 unless business and legal review explicitly approve it

### Important clarification on "wallet"

There are 3 different wallet models:

1. Touch 'n Go eWallet as an external checkout method
2. a C2 Coffee reward credit or promo balance
3. a true C2 Coffee stored-value wallet with prepaid user funds

For launch, the recommended model is:

- use Touch 'n Go eWallet as an external payment method
- do not launch a true stored-value C2 Coffee wallet in phase 1
- if needed, use vouchers, promo credits, and membership benefits instead

Reason:

- true stored-value handling is much harder technically
- reconciliation and refund logic become significantly harder
- prepaid balance models can create regulatory and operational risk

## 3. Recommended Two-Phase Rollout

### Phase 1: Launch to First 1,000 Registered Users

### Product goal

Ship a stable consumer app quickly, learn user behavior, and avoid avoidable financial and compliance complexity.

### Phase 1 decisions

- pickup only
- free membership for all users
- cup-based loyalty tiers
- Touch 'n Go eWallet, FPX, and cards as payment methods
- WhatsApp OTP as primary login verification
- SMS OTP as fallback
- no paid subscription yet
- no true internal stored-value wallet yet

### Why this is the right launch scope

- it matches the current UI direction
- it suits Malaysian payment behavior
- it avoids overbuilding before real user data exists
- it reduces legal and accounting complexity
- it keeps the backend focused on orders, auth, loyalty, and payments

### Phase 2: After First 1,000 Registered Users

### Product goal

Use real user and transaction data to decide whether C2 should add a paid pass, top-up balance, or stronger rewards automation.

### Phase 2 decisions

- keep pickup only unless store operations prove delivery is worth adding
- pilot a paid monthly membership pass
- consider a limited-purpose merchant balance only after finance and legal review
- add stronger campaign automation, referral rewards, and personalized offers
- optimize pricing and discount stacking using actual margin data

### Trigger to enter phase 2

Use any of these as the threshold:

- 1,000 registered users
- or 300 monthly active purchasers
- or 150+ paid orders per week for 6 straight weeks

## 4. Membership, Loyalty, and Subscription Model

### Phase 1 recommendation

Launch with free membership plus a simple tier model.

### Recommended tier model

- `Tier 1 - C2 One`: default on signup
- `Tier 2 - C2 Plus`: 12 qualifying cups in 90 days
- `Tier 3 - C2 Signature`: 30 qualifying cups in 180 days
- `Tier 4 - C2 Reserve`: 60 qualifying cups in 365 days

### Qualifying cup rule

- 1 qualifying cup = 1 paid handcrafted drink above a minimum amount such as RM12
- free drinks do not count
- heavily discounted promo drinks should not count
- cancelled or refunded orders do not count

### Phase 1 tier benefits

- birthday voucher
- faster reward unlocks at higher tiers
- exclusive seasonal drink access
- selected pickup discounts or size upgrades
- referral bonus multiplier for higher tiers

### Phase 2 subscription recommendation

Do not launch unlimited coffee. It is margin-risky and hard to control.

Instead launch a lightweight paid pass:

- `C2 Plus Pass Monthly`
- suggested pilot price: RM14.90 to RM19.90 per month

Suggested benefits:

- 1 free drink voucher or 2 size upgrades per month
- 10 percent off selected handcrafted drinks
- 1.25x cup earning
- early access to limited drinks
- members-only weekday pickup offers during slower hours

### Decision summary

- phase 1: free membership + tiers
- phase 2: optional paid pass

## 5. Login and OTP Strategy

### Recommended phase 1 login flow

1. user enters phone number
2. backend creates OTP with short expiry
3. backend sends OTP by WhatsApp
4. user verifies OTP
5. if WhatsApp fails or times out, offer SMS fallback

### Why this is the best fit

- phone login is simple for Malaysian consumers
- WhatsApp is familiar and trusted
- SMS fallback protects account access when WhatsApp delivery is delayed

### WhatsApp requirements

Using a business number "registered under Meta" is not enough by itself.

The business also needs:

- WhatsApp Business Account setup
- phone number enabled for WhatsApp Business Platform or Cloud API
- approved authentication template for OTP
- backend support for rate limiting, expiry, retries, and audit logging

### OTP security rules

- expiry: 3 to 5 minutes
- resend cooldown: at least 30 to 60 seconds
- max verify attempts per OTP: 5
- max OTP requests per phone/day: set rate limits
- do not store OTP plaintext
- mark OTP as single-use
- log send and verify outcomes

## 6. OTP Pricing and Options

Pricing below is based on publicly visible pricing as of August 3, 2026. Final charges can differ by negotiated rate, BSP markup, destination class, and message volume.

### Option A: Meta WhatsApp Cloud API direct

Best when:

- the team can handle direct API integration
- C2 wants lower per-message cost and fewer vendor markups

Indicative cost:

- WhatsApp authentication message in Malaysia: about RM0.0564 per message
- authentication-international can be higher; public examples show RM0.1685

Notes:

- Meta pricing is not the only cost if a BSP is used
- template approval and operational setup are still required

### Option B: Twilio Verify with WhatsApp

Best when:

- the team wants faster managed verification workflows
- the business accepts higher verification cost

Public pricing:

- Twilio Verify: starts at USD0.05 per successful verification
- Twilio WhatsApp fee: USD0.005 per message
- Meta WhatsApp template fee still applies on top

Conclusion:

- too expensive for a consumer coffee app at scale
- not recommended for C2 launch unless engineering speed matters more than cost

### Option C: Local SMS provider fallback

Best when:

- WhatsApp fails
- the customer does not receive WhatsApp reliably

Public pricing examples:

- iSMS Malaysia pricing shows about RM0.115 per SMS at 1,000 credits
- volume drops to about RM0.100 per SMS at 100,000 credits
- Exabytes publicly mentions RM0.30 per SMS for Malaysia on one bulk SMS page

Conclusion:

- local Malaysia SMS providers are viable fallback channels
- use SMS as backup, not primary

### Option D: Global SMS provider like Twilio

Public pricing example:

- Twilio Malaysia outbound SMS page shows USD0.3389 for an international number route

Conclusion:

- not recommended as the default OTP channel for C2
- can be much more expensive than local SMS routes

### Final auth recommendation

- primary: WhatsApp Cloud API or a local BSP using WhatsApp Business Platform
- fallback: local Malaysia SMS provider
- avoid Twilio Verify unless the priority is speed over cost

## 7. Payments and Checkout Strategy

### Phase 1 payment methods

- Touch 'n Go eWallet
- FPX
- debit and credit cards

### Why these methods

- Touch 'n Go is familiar in Malaysia
- FPX is trusted and bank-direct
- cards remain necessary for some users

### Recommended gateway strategy

Use one main payment gateway that already supports the needed methods.

Best fit for current direction:

- Razorpay Curlec

Reasons:

- supports FPX and e-wallets
- public Malaysia pricing is available
- subscription support exists for later phase
- Touch 'n Go is referenced in its subscription payment settings

### Curlec public pricing snapshot

Publicly visible pricing on August 3, 2026:

- one-time setup fee:
  - Basic: RM0
  - Premium: RM999
- cards:
  - 2.40 percent basic
  - 2.00 percent premium
- FPX:
  - 1.50 percent or RM1 minimum basic
  - 1.00 percent or RM1 minimum premium
- e-wallet:
  - 1.50 percent basic
  - 1.30 percent premium for Touch 'n Go and Boost

### Touch 'n Go direct integration option

Touch 'n Go also offers merchant and payment gateway paths directly.

Practical conclusion:

- C2 can accept Touch 'n Go directly as a payment method
- but one consolidated gateway is easier for launch operations
- Curlec is a cleaner launch path than assembling separate payment integrations

### Final payment recommendation

- launch with Curlec
- enable Touch 'n Go eWallet, FPX, and cards
- delay BNPL

## 8. Wallet Strategy

### Recommended phase 1 wallet decision

Do not launch a true C2 stored-value wallet in phase 1.

### Why not

- wallet ledger must be append-only and auditable
- top-up and spend logic must be atomic
- refund handling becomes harder
- reconciliation with payment gateway and bank settlement is harder
- prepaid balance can create compliance questions

### What to do instead

Use:

- Touch 'n Go eWallet as payment method
- promo vouchers
- birthday credits
- referral coupons
- tier-based benefits

### If the business still wants "wallet-like" behavior

Use a reward credit model, not cash balance:

- `RM5 welcome voucher`
- `top up style campaign` replaced with `buy 5 drinks get reward`
- `RM100 spend milestone` triggers voucher or benefit

This delivers similar user psychology without launching a regulated-feeling wallet product too early.

### Phase 2 wallet option

If phase 2 introduces a limited-purpose merchant balance, the backend must include:

- wallet account table
- append-only transaction ledger
- payment reference mapping
- idempotency keys
- atomic debit and credit transactions
- full audit log
- reconciliation process
- manual adjustment workflow with role-based approval

## 9. Discount and Promotion Rules

### Recommended phase 1 discount logic

Keep the rules simple and avoid uncontrolled stacking.

Recommended rules:

- direct payment discount:
  - optional 3 percent off pickup orders
  - cap at RM2 per order
- voucher:
  - one main voucher per order
- tier benefit:
  - can stack only if the margin is still safe

### If the boss wants a "wallet" reward concept

Replace prepaid wallet discounts with campaign rules:

- spend RM100 cumulative in the month -> unlock RM5 voucher
- complete 7 qualifying cups -> unlock free upgrade
- first TNG payment -> unlock RM2 coupon for next pickup

### Promotion policy

Do not allow unlimited stacking of:

- payment method discount
- voucher
- tier discount
- subscription discount
- referral reward

Use a promotion engine that always decides:

- one primary discount
- one reward redemption
- optional tier benefit if allowed

## 10. Backend Scope to Build ASAP

Current note:

- the frontend under [mobile_app](C:/DCStack/C2Coffee/C2Coffee/mobile_app/) is ahead of the backend
- the backend folder in the repo currently looks like scaffolding and still needs real implementation

### Phase 1 backend modules

Build in this order:

1. authentication
2. store and menu catalog
3. order creation and payment
4. loyalty and tiers
5. notifications and content

### Minimum phase 1 APIs

- `POST /auth/request-otp`
- `POST /auth/verify-otp`
- `GET /me`
- `GET /stores`
- `GET /menu`
- `POST /orders`
- `GET /orders`
- `GET /orders/{id}`
- `POST /payments/create-intent`
- `POST /payments/webhook`
- `GET /loyalty`
- `GET /promotions`
- `POST /referrals`

### Core backend tables

- users
- auth_otps
- devices
- stores
- menu_categories
- menu_items
- item_variants
- orders
- order_items
- payments
- payment_events
- loyalty_cup_events
- loyalty_tier_snapshots
- vouchers
- user_vouchers
- referrals
- notifications

## 11. Phase 1 vs Phase 2 Feature Matrix

| Area | Phase 1 Launch | Phase 2 After 1,000 Users |
| --- | --- | --- |
| Login | Phone + WhatsApp OTP + SMS fallback | Add stronger anti-fraud and device trust |
| Ordering | Pickup only | Keep pickup, add scheduling improvements |
| Payments | TNG, FPX, cards | Optimize routing and campaign logic |
| Membership | Free member | Keep free member |
| Loyalty | Cup tiers | Tune thresholds using real data |
| Subscription | Not launched | Pilot paid pass |
| Wallet | No true stored-value wallet | Reconsider only after review |
| Promotions | Simple vouchers and campaigns | Personalized offers |
| Referrals | Basic refer-a-friend | Tier-aware referral rules |

## 12. Cost Guidance for Early Planning

These are planning ranges, not committed vendor quotes.

### Login cost planning

#### Lowest-cost practical model

- WhatsApp direct or local BSP primary
- local SMS fallback

Indicative cost range:

- WhatsApp OTP: about RM0.0564 each before BSP markup
- SMS fallback: about RM0.10 to RM0.115 each with a local provider

#### More expensive model

- Twilio Verify + WhatsApp

This adds:

- USD0.05 per successful verification
- plus Twilio message fee
- plus Meta fee

This is generally too expensive for a mass-market coffee app.

### Payment cost planning

Using Curlec basic public rates:

- FPX and e-wallets: about 1.5 percent
- cards: about 2.4 percent

Practical conclusion:

- encourage TNG and FPX first
- accept cards, but expect higher processing cost

## 13. Final Recommended Decisions

### Ship now

- phone login
- WhatsApp OTP primary
- SMS fallback
- pickup only
- free membership
- cup tiers
- Touch 'n Go, FPX, and cards
- no true internal stored-value wallet
- no paid subscription at launch

### Add after first 1,000 users

- C2 Plus Pass monthly
- stronger campaign automation
- personalized loyalty offers
- reconsider limited merchant balance only after legal and finance review

## 14. Sources

Prices and product notes below were checked on August 3, 2026.

- Meta WhatsApp pricing overview:
  - https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Meta WhatsApp authentication-international overview:
  - https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/authentication-international-rates
- Meta WhatsApp authentication templates:
  - https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates
- Twilio Verify pricing:
  - https://www.twilio.com/en-us/verify/pricing
- Twilio WhatsApp pricing:
  - https://www.twilio.com/en-us/whatsapp/pricing
- Twilio SMS pricing Malaysia:
  - https://www.twilio.com/en-us/sms/pricing/my
- Curlec pricing:
  - https://curlec.com/pricing/
- Curlec subscriptions settings:
  - https://curlec.com/docs/payments/subscriptions/settings/
- TNG merchant registration:
  - https://www.tngdigital.com.my/business/merchant/
- TNG payment gateway solutions:
  - https://www.tngdigital.com.my/business/enterprise/business-solutions/payment-gateway/
- PayNet FPX for business:
  - https://paynet.my/business-solutions/fpx.html
- iSMS Malaysia pricing:
  - https://www.vocotext.com/
- Exabytes bulk SMS page:
  - https://www.exabytes.my/online-marketing/bulk-sms-marketing

### Source caution

- WhatsApp charges can vary by destination category, BSP markup, and international classification
- payment rates can change based on commercial negotiation and volume
- this document should be refreshed before final vendor signoff
