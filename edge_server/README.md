# C2 Coffee Local Print Connector

This service runs on a computer in the outlet. It is intentionally separate from
the Barista app: the app queues a receipt; the connector performs the local,
hardware-specific print and acknowledges the result.

## Current support

- Generic ESC/POS thermal receipt printers over LAN or Wi-Fi TCP.
- The ZYWELL ZY905-K4-W is compatible through this route. Use 80 mm paper and
  its LAN IP address. The default TCP port is `9100`; confirm this from the
  printer configuration/test page before use.

USB, Bluetooth, Android-direct, and POS-vendor routes are intentionally not
claimed as supported by this first connector. They require separate adapters.

## First outlet test

1. Connect the ZYWELL printer to the outlet router by Ethernet.
2. Install the ZYWELL Windows driver and send a Windows test page. Do not
   continue until that physical test succeeds.
3. Use the ZYWELL configuration tool or its self-test printout to find the
   printer IP. Reserve that address in the router.
4. In the API environment, set a long random `PRINT_CONNECTOR_SHARED_SECRET`
   and restart the API. Keep this secret only on the API host and connector PC.
5. In Admin Web, go to `Operations > Printers & POS`, add a route:
   - Name: `C2 Test Receipt Printer`
   - Delivery route: `Managed network printer`
   - Printer reference: `c2-broga-zy905`
   - Default receipt printer: enabled
6. Copy `.env.example` to `.env` on the outlet PC and set the API URL, the
   same shared secret, `PRINTER_REFERENCE=c2-broga-zy905`, and the printer IP.
7. Run `npm start` from this folder. The Admin status becomes `Connected` after
   the first successful heartbeat.
8. Start with `DRY_RUN=true`, queue a receipt, and confirm the connector logs
   `Dry run`. It is intentionally recorded as `not printed`; dry-run must not
   falsely claim that a customer receipt was physically printed. Then set
   `DRY_RUN=false`, restart the connector, and queue one test receipt for
   physical printing.

## Windows commands

```powershell
cd D:\C2Coffee\edge_server
Copy-Item .env.example .env
notepad .env
node --version # Node 20 or newer is required
npm test
npm start
```

To keep it running as a Windows Docker service instead, use:

```powershell
docker compose up --build -d
docker compose logs -f
```

Before changing `DRY_RUN=false`, validate network reachability:

```powershell
Test-NetConnection 192.168.1.50 -Port 9100
```

Replace `192.168.1.50` with the actual reserved printer IP. A failed test means
the printer network setup must be corrected before using the connector.

## Operational behavior

- The connector uses a shared secret for every API call.
- It claims one immutable print job at a time.
- A successful TCP handoff is acknowledged as `printed`.
- A TCP failure is acknowledged as `failed` with a safe error code, so it does
  not remain indefinitely in `dispatching`.
- `DRY_RUN=true` lets the API flow be tested without consuming paper and records
  `dry_run_not_printed` instead of falsely marking the receipt printed.
