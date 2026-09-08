# Print Connector Protocol

The API intentionally does not attempt to speak every printer's USB,
Bluetooth, LAN, or Windows-spooler protocol. A connector runs next to the
printer and converts the API's receipt payload into the vendor-specific format.

## Security

- Configure `PRINT_CONNECTOR_SHARED_SECRET` only in the deployment secret
  store. Never put it in the Admin Web, a receipt-printer form, or source code.
- Send it in `X-C2-Print-Connector-Key` over HTTPS.
- Register a unique `printer_reference` in Admin Web Operations. The connector
  can only claim and acknowledge jobs for that reference.

## Connector Loop

1. Call `POST /v1/print-connectors/heartbeat` with `printer_reference`.
2. Poll `POST /v1/print-connectors/jobs/claim` with the same reference.
3. A `204` response means no work is available. Back off before polling again.
4. Render the `receipt` JSON using the printer vendor's supported SDK.
5. Call `POST /v1/print-connectors/jobs/acknowledge` with `job_ref` and either
   `printed` or `failed`.

The first connector should be a tested Windows Print Bridge. Android direct,
Bluetooth, USB, and LAN printers require separate hardware certification before
they can be marked supported for a customer site.
