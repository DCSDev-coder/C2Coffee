# Production Readiness Evidence

This document separates evidence produced by automated checks from evidence
that requires the live environment, a mobile device, or a physical printer.
Do not mark the release complete until every required item has evidence.

## Verified in the source workspace

| Area | Evidence | Status |
| --- | --- | --- |
| API types and build | `npm run typecheck && npm run build` | Passed |
| API production dependencies | `npm audit --omit=dev --audit-level=high` | Passed with 0 vulnerabilities |
| Admin Web production bundle | `npm run build` | Passed |
| Customer Flutter analysis and tests | `flutter analyze && flutter test` | Passed |
| Barista Flutter analysis and tests | `flutter analyze && flutter test` | Passed |
| Customer Android release protection | Release bundle fails without protected upload key | Passed |
| Barista Android signing | Release bundle signed by C2 Coffee & Candle certificate | Passed |

## Required on the Windows production host

1. Deploy the API using `DEPLOY_WINDOWS_SERVER.md`.
2. Run `docker compose exec c2-api npm audit --omit=dev --audit-level=high`.
3. Stop the release and resolve or explicitly assess any reported high or critical vulnerability.
4. Run `docker compose exec c2-api npm run production-readiness:prod`.
5. Save the audit and `PASS` output with the deployment date and API commit identifier.
6. Do not release if the audit fails or any readiness line begins with `FAIL`.

## Required physical acceptance evidence

| Scenario | Required evidence |
| --- | --- |
| Customer authentication | A production OTP email is received and sign-in succeeds. |
| Admin session | Login, browser refresh, and logout work from the production Admin Web domain. |
| Customer notification | A physical Android and iPhone receive the professional ready-for-collection message in foreground and background. |
| Barista workflow | Barista tablet displays the published timetable and can progress an order safely. |
| Outlet routing | A barista-only account assigned to Broga sees only Broga orders, schedules, and printers. A second outlet must use a separately assigned barista account before it accepts orders. |
| Printing | A configured printer route receives and prints a real receipt through the installed print bridge. |
| Recovery | Disconnect the printer or internet, confirm the app shows a safe message, then restore it and confirm recovery. |

## Explicit non-evidence

- A Firebase or Billplz dashboard screenshot alone does not prove app delivery.
- A configured printer target alone does not prove receipt printing.
- A successful local build alone does not prove public HTTPS, SMTP, or device behavior.

## Single-Outlet Rollout

The current customer experience is intentionally limited to one customer-facing
outlet. The name may be changed from Admin Web Settings, but changing the name
does not move the physical outlet or route orders elsewhere.

The `038_add_single_outlet_routing.sql` migration marks `C2-BROGA` as the
customer-facing outlet and assigns existing barista-only accounts to it. It
also scopes the Barista App's order queue, status updates, print jobs, printer
readiness, and weekly timetable to that assignment.

To launch another physical outlet later, create its store record, explicitly
designate its customer-facing status, create a dedicated barista-only account,
and assign that account to the new store in `admin_user_store_assignments`.
Do not expose a customer store switcher until that rollout also has accurate
address coordinates, outlet-specific menu availability, printer routing, and
device acceptance evidence.
