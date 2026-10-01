# Counter App API

The Counter App authenticates as a registered counter device. It must never
store a customer mobile-app access token or use Admin Web credentials.

## Device setup and login

An Operations Admin creates a device with `POST /v1/admin/counter-devices` and confirms the action with their current password.
The response contains a one-time `activation_code` that expires after 30 minutes.

On first launch, the Counter App asks for this code and exchanges it once:

```http
POST /v1/counter/activate
Content-Type: application/json

{ "activation_code": "C2-1234-ABCD-5678-EF90" }
```

The response contains `device_token` once. Store it in Android Keystore or
iOS Keychain through secure storage. This is the device login; staff must not
enter Admin Web credentials on the kiosk.

All Counter App calls use:

```http
Authorization: Bearer <device_token>
```

The device is bound to one tenant and one active store. The API rejects a
device if its tenant, store, or device status is inactive or revoked.

If secure storage has no token, show the activation screen. If
`GET /v1/counter/device` returns `401`, delete the local token and show the
activation screen again. An admin can issue a new activation code; doing so
immediately invalidates the old device token.

## Endpoints

### Confirm device

```http
GET /v1/counter/device
```

Returns the device, tenant, and assigned store identifiers. Call on app start.

### Load the assigned outlet menu

```http
GET /v1/counter/menu
```

Returns the current menu, RM prices, availability, and modifier rules for the
device's assigned outlet. The client does not send or choose a store ID.

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

## Current payment boundary

Counter sales are RM purchases; customer tokens must not be deducted. Direct
counter order creation remains disabled until a QR/card provider and its signed
server callback are configured. Never add a client-side "payment successful"
button that can mark an order paid. The Counter App should clear its local cart
and customer session after every completed, cancelled, or idle interaction.
