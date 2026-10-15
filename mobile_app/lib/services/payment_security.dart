bool isTrustedPaymentCheckoutUrl(
  String value,
) {
  final uri = Uri.tryParse(value);
  if (uri == null || uri.scheme != 'https' || uri.userInfo.isNotEmpty) {
    return false;
  }
  final host = uri.host.toLowerCase();
  return host == 'chip-in.asia' || host.endsWith('.chip-in.asia');
}
