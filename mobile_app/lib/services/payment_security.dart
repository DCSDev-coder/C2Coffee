bool isTrustedPaymentCheckoutUrl(String value) {
  final uri = Uri.tryParse(value);
  if (uri == null || uri.scheme != 'https' || uri.userInfo.isNotEmpty) {
    return false;
  }
  final host = uri.host.toLowerCase();
  return host == 'billplz.com' ||
      host.endsWith('.billplz.com') ||
      host == 'billplz-sandbox.com' ||
      host.endsWith('.billplz-sandbox.com');
}
