import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_client.dart';

class AuthService {
  final ApiClient _apiClient = ApiClient();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  
  static const String _tokenKey = 'device_token';

  Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }

  // Attempt to load the token. If it exists, call GET /v1/counter/device to verify it.
  Future<bool> verifyDevice() async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null) {
      return false;
    }

    try {
      final response = await _apiClient.get('/v1/counter/device', token: token);
      if (response.statusCode == 200) {
        return true;
      } else if (response.statusCode == 401) {
        // Device revoked, reset, or no longer valid
        await logout();
        return false;
      }
      return false; // Handle other errors as failed validation for now
    } catch (e) {
      // Network error, you might want to handle this differently in a real app
      return false;
    }
  }

  // Activate the device using a one-time activation code
  Future<bool> activateDevice(String activationCode) async {
    try {
      final response = await _apiClient.post(
        '/v1/counter/activate', 
        {'activation_code': activationCode}
      );

      if (response.statusCode == 200) {
        final jsonResponse = jsonDecode(response.body);
        final token = jsonResponse['device_token'];
        
        await _storage.write(key: _tokenKey, value: token);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
  }
}
