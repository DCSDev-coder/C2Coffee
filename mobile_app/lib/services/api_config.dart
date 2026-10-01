class ApiConfig {
  ApiConfig._();

  static const _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.c2coffeeandcandle.com/v1',
  );
  static const allowBillplzSandbox = bool.fromEnvironment(
    'ALLOW_BILLPLZ_SANDBOX',
    defaultValue: false,
  );

  static String get baseUrl => validateBaseUrl(_configuredBaseUrl);

  static String validateBaseUrl(String value) {
    final normalized = value.trim().replaceFirst(RegExp(r'/+$'), '');
    final uri = Uri.tryParse(normalized);
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.path != '/v1' ||
        uri.hasQuery ||
        uri.hasFragment) {
      throw StateError(
        'API_BASE_URL must be an HTTPS URL ending in /v1 without credentials, query parameters, or fragments.',
      );
    }
    return normalized;
  }
}
