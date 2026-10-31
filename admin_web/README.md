# C2 Coffee Admin Web

React + Vite admin panel.

## API base URL

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` for the API environment you intend to use. Production defaults to `https://api.c2coffeeandcandle.com` when the variable is not supplied.

Notes:

- `admin_web/src/lib/adminApi.js` already has refresh-token handling and formats expired-session errors as a sign-in prompt.
- In the current deployment, the Windows API container is exposed through IIS, so the public domain is the normal client target.
- The local Vite dev server commonly runs on `http://localhost:5173`, but it still calls the public API host.

## Asset and session flow

- Marketing posters and menu images are read from the API, not from the web app bundle.
- If a request fails after the app sits idle, the app should attempt a token refresh first and then ask the admin to sign in again if the refresh token is no longer valid.

## Inventory purchasing workflow

The inventory module separates customer-order consumption from supplier purchasing:

1. Super Admin creates suppliers and links each inventory item to one or more suppliers. Each link stores that supplier's SKU, package unit, package-to-stock conversion, minimum order, lead time, and price.
2. Operations Admin or Super Admin creates one purchase order per supplier. Only items already linked to that supplier can be selected.
3. Submit the draft purchase order when it has been sent to the supplier.
4. When a delivery arrives, open the purchase order and choose **Receive delivery**. Enter the delivered and rejected quantities for each line together with the delivery-order or invoice reference.
5. Only accepted quantities increase stock. Partial deliveries remain outstanding and can be received later. Each delivery creates a separate goods-received record and audit entry.

Supplier prices, inventory valuation, and cost analytics are visible only to Super Admin. Operations Admin can place orders, receive deliveries, transfer stock, record wastage, and perform stock counts without seeing supplier costs.
