import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  static const String baseUrl = 'http://localhost:8080'; // Replace with actual backend URL

  Future<http.Response> post(String path, Map<String, dynamic> body, {String? token}) async {
    final headers = {'Content-Type': 'application/json'};
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }

    return await http.post(
      Uri.parse('$baseUrl$path'),
      headers: headers,
      body: jsonEncode(body),
    );
  }

  Future<http.Response> get(String path, {String? token}) async {
    final headers = {'Content-Type': 'application/json'};
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }

    return await http.get(
      Uri.parse('$baseUrl$path'),
      headers: headers,
    );
  }

  Future<http.Response> delete(String path, {Map<String, String>? headers}) async {
    final requestHeaders = {'Content-Type': 'application/json'};
    if (headers != null) {
      requestHeaders.addAll(headers);
    }

    return await http.delete(
      Uri.parse('$baseUrl$path'),
      headers: requestHeaders,
    );
  }
}
