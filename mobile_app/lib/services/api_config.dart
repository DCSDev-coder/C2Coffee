import 'package:flutter/foundation.dart';

class ApiConfig {
  ApiConfig._();

  static const _productionBaseUrl = 'https://api.c2coffeeandcandle.com/v1';
  static const _localWebBaseUrl = 'http://localhost:8080/v1';

  static String get baseUrl {
    const override = String.fromEnvironment('API_BASE_URL');
    if (override.isNotEmpty) {
      return override;
    }

    if (kIsWeb) {
      return _localWebBaseUrl;
    }

    return _productionBaseUrl;
  }
}
