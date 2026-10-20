class ApiConfig {
  ApiConfig._();

  static const _productionBaseUrl = 'https://api.c2coffeeandcandle.com/v1';
  static const tenantCode = String.fromEnvironment(
    'C2_TENANT_CODE',
    defaultValue: 'c2coffee',
  );

  static String get baseUrl => _productionBaseUrl;
}
