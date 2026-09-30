# Admin Web Production QA

Run this checklist against a staging deployment and staging database before production migration.

## 1. Authentication and authorization

- Log in with each role and confirm only permitted navigation and actions appear.
- Try protected API routes without a session and with a lower-privilege account; expect `401` or `403`.
- Confirm logout invalidates the session and browser Back does not expose live admin data.
- Confirm sensitive actions require the current password and create an audit-log entry.

## 2. Outlet lifecycle

- Add an outlet and confirm it starts active but unavailable in the customer app unless explicitly selected.
- Publish two active outlets to the customer app and confirm both appear in the mobile outlet dropdown.
- Unpublish an outlet, then mark it inactive. Confirm it disappears from customer selection but historical orders remain reportable.
- Confirm an outlet cannot be inactive while still published to the customer app.
- Confirm an outlet code cannot be changed and duplicate codes are rejected.

## 3. Outlet filtering and reconciliation

- For Dashboard, Orders, Finance, Product Report, and Refund details, compare `All outlets` totals with the sum of each outlet for the same period.
- Confirm an outlet filter never returns another cafe deployment's data.
- Confirm date boundaries use `Asia/Kuala_Lumpur` consistently.
- Confirm exports use the same outlet/date/status filters shown on screen.

## 4. Orders and refunds

- Place one mobile order per published outlet and verify the outlet name throughout order detail, preparation, audit history, finance, and product reports.
- Test every valid order status transition and reject invalid transitions or repeated actions.
- Create, approve, and reject refund requests from Order details; confirm token balances and ledger entries change exactly once.
- Retry or double-click refund and status actions; confirm they remain idempotent.
- Confirm inactive outlets' historical orders and refunds remain visible through reporting filters.

## 5. Sales analysis

- Reconcile sales, order count, customers served, and best sellers against known database fixtures.
- Verify cancelled, failed, expired, and refunded records are excluded or deducted according to the label shown.
- Verify RM totals, token totals, quantities, and modifiers on detail views and exports.
- Test empty, single-row, high-volume, long-name, and missing-image states.

## 6. Security and resilience

- Enter HTML, SQL-like text, control characters, and oversized values in every search and editable field; confirm validation and escaped rendering.
- Confirm no access tokens, passwords, OTPs, bank details, or gateway secrets appear in URLs, browser storage, exports, or console logs.
- Disable the API or simulate timeout/`500`; confirm screens show recoverable errors and do not display stale totals as current.
- Verify CSP/security headers, production HTTPS, CORS allowlist, rate limiting, and secure cookie settings.
- Run dependency audits and review every production vulnerability rather than applying breaking upgrades blindly.

## 7. Browser and responsive checks

- Test current Chrome, Edge, and Safari at desktop and tablet widths.
- Verify tables, dialogs, filters, exports, keyboard navigation, focus states, and screen-reader labels.
- Refresh each route and verify authentication and current filter state recover safely.

## Release evidence

Record tester, timestamp, environment, commit, database migration version, browser/device, screenshots, and failed-case evidence. A passing build alone is not production sign-off.
