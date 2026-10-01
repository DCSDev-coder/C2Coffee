import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiClient {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.c2coffeeandcandle.com',
  );

  static const Duration _requestTimeout = Duration(seconds: 20);

  Future<http.Response> post(
    String path,
    Map<String, dynamic> body, {
    String? token,
  }) async {
    final headers = {'Content-Type': 'application/json'};
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }

    return http
        .post(
          Uri.parse('$baseUrl$path'),
          headers: headers,
          body: jsonEncode(body),
        )
        .timeout(_requestTimeout);
  }

  Future<http.Response> get(String path, {String? token}) async {
    final headers = {'Content-Type': 'application/json'};
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }

    return http
        .get(Uri.parse('$baseUrl$path'), headers: headers)
        .timeout(_requestTimeout);
  }

  Future<http.Response> delete(
    String path, {
    Map<String, String>? headers,
  }) async {
    final requestHeaders = {'Content-Type': 'application/json'};
    if (headers != null) {
      requestHeaders.addAll(headers);
    }

    return http
        .delete(Uri.parse('$baseUrl$path'), headers: requestHeaders)
        .timeout(_requestTimeout);
  }
}
