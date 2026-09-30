export function isTrustedBillplzCheckoutUrl(
  checkoutUrl: string,
  gatewayBaseUrl: string
): boolean {
  try {
    const checkout = new URL(checkoutUrl);
    const gateway = new URL(gatewayBaseUrl);
    return checkout.protocol === 'https:' &&
      gateway.protocol === 'https:' &&
      checkout.hostname === gateway.hostname &&
      checkout.username === '' &&
      checkout.password === '';
  } catch {
    return false;
  }
}
