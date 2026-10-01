bool isTrustedPaymentCheckoutUrl(
  String value, {
  bool allowSandbox = false,
}) {
  final uri = Uri.tryParse(value);
  if (uri == null || uri.scheme != 'https' || uri.userInfo.isNotEmpty) {
    return false;
  }
  final host = uri.host.toLowerCase();
  final isProduction =
      host == 'billplz.com' || host.endsWith('.billplz.com');
  final isSandbox = host == 'billplz-sandbox.com' ||
      host.endsWith('.billplz-sandbox.com');
  return isProduction || (allowSandbox && isSandbox);
}
