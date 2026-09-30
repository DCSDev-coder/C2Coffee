# Counter App API

The Counter App authenticates as a registered counter device. It must never
store a customer mobile-app access token or use Admin Web credentials.

## Device setup

An Operations Admin creates a device with `POST /v1/admin/counter-devices` and confirms the action with their current password.
The response contains `device_token` once. Store it in secure device storage.

All Counter App calls use:

```http
Authorization: Bearer <device_token>
```

The device is bound to one tenant and one active store. The API rejects a
device if its tenant, store, or device status is inactive or revoked.

## Endpoints

### Confirm device

```http
GET /v1/counter/device
```

Returns the device, tenant, and assigned store identifiers. Call on app start.

### Look up a customer

```http
POST /v1/counter/customer-sessions
Content-Type: application/json

{ "phone": "+60138601915" }
```

Returns a ten-minute `customer_session_token`, a safe customer summary, token
balance, loyalty tier, and active vouchers. Keep the session token in memory
only and send it on subsequent customer-session calls:

```http
X-Counter-Customer-Session: <customer_session_token>
```

The app should display the customer name for confirmation before showing the
menu. Do not display email, full address, or order history.

### Refresh the selected customer

```http
GET /v1/counter/customer-session
X-Counter-Customer-Session: <customer_session_token>
```

### End the selected customer session

```http
DELETE /v1/counter/customer-session
X-Counter-Customer-Session: <customer_session_token>
```

Call this after a completed or cancelled counter order and after idle timeout.

## Current boundary

This foundation deliberately does not yet allow token deduction or order
creation. Checkout must add an explicit customer-confirmation policy before it
can spend a customer's balance. The Counter App should still clear its local
cart and session after every interaction.
