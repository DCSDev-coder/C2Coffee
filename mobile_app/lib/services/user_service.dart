import 'package:shared_preferences/shared_preferences.dart';

class UserService {
  static const String _presetKey = 'preset_avatar_path';
  static const String _pickedImageKey = 'picked_image_path';

  static const String _usernameKey = 'username';
  static const String _emailKey = 'email';
  static const String _phoneKey = 'phone';
  static const String _birthdayKey = 'birthday';
  static const String _genderKey = 'gender';
  static const String _addressKey = 'address';
  static const String _stateKey = 'state';

  static Future<void> saveAvatar(
      {String? presetPath, String? pickedImagePath}) async {
    final prefs = await SharedPreferences.getInstance();
    if (presetPath != null) {
      await prefs.setString(_presetKey, presetPath);
      await prefs.remove(_pickedImageKey); // clear picked if preset selected
    } else if (pickedImagePath != null) {
      await prefs.setString(_pickedImageKey, pickedImagePath);
      await prefs.remove(_presetKey); // clear preset if picked selected
    }
  }

  static Future<Map<String, String?>> getAvatar() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'presetPath': prefs.getString(_presetKey),
      'pickedImagePath': prefs.getString(_pickedImageKey),
    };
  }

  static Future<void> saveUserProfile(Map<String, String> data) async {
    final prefs = await SharedPreferences.getInstance();
    if (data.containsKey('username')) {
      await prefs.setString(_usernameKey, data['username']!);
    }
    if (data.containsKey('email')) {
      await prefs.setString(_emailKey, data['email']!);
    }
    if (data.containsKey('phone')) {
      await prefs.setString(_phoneKey, data['phone']!);
    }
    if (data.containsKey('birthday')) {
      await prefs.setString(_birthdayKey, data['birthday']!);
    }
    if (data.containsKey('gender')) {
      await prefs.setString(_genderKey, data['gender']!);
    }
    if (data.containsKey('address')) {
      await prefs.setString(_addressKey, data['address']!);
    }
    if (data.containsKey('state')) {
      await prefs.setString(_stateKey, data['state']!);
    }
  }

  static Future<void> overwriteUserProfile(Map<String, String?> data) async {
    final prefs = await SharedPreferences.getInstance();
    await _writeNullable(prefs, _usernameKey, data['username']);
    await _writeNullable(prefs, _emailKey, data['email']);
    await _writeNullable(prefs, _phoneKey, data['phone']);
    await _writeNullable(prefs, _birthdayKey, data['birthday']);
    await _writeNullable(prefs, _genderKey, data['gender']);
    await _writeNullable(prefs, _addressKey, data['address']);
    await _writeNullable(prefs, _stateKey, data['state']);
  }

  static Future<Map<String, String?>> getUserProfile() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'username': prefs.getString(_usernameKey),
      'email': prefs.getString(_emailKey),
      'phone': prefs.getString(_phoneKey),
      'birthday': prefs.getString(_birthdayKey),
      'gender': prefs.getString(_genderKey),
      'address': prefs.getString(_addressKey),
      'state': prefs.getString(_stateKey),
    };
  }

  static Future<void> clearUserProfile() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_usernameKey);
    await prefs.remove(_emailKey);
    await prefs.remove(_phoneKey);
    await prefs.remove(_birthdayKey);
    await prefs.remove(_genderKey);
    await prefs.remove(_addressKey);
    await prefs.remove(_stateKey);
  }

  static Future<void> clearAvatar() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_presetKey);
    await prefs.remove(_pickedImageKey);
  }

  static Future<void> _writeNullable(
    SharedPreferences prefs,
    String key,
    String? value,
  ) async {
    if (value == null || value.isEmpty) {
      await prefs.remove(key);
    } else {
      await prefs.setString(key, value);
    }
  }
}
