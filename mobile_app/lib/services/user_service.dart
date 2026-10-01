import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class UserService {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static const String _securePrefix = 'profile_v2_';
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
    if (presetPath != null) {
      await _storage.write(key: _secureKey(_presetKey), value: presetPath);
      await _storage.delete(key: _secureKey(_pickedImageKey));
    } else if (pickedImagePath != null) {
      await _storage.write(
          key: _secureKey(_pickedImageKey), value: pickedImagePath);
      await _storage.delete(key: _secureKey(_presetKey));
    }
    await _removeLegacyValues({_presetKey, _pickedImageKey});
  }

  static Future<Map<String, String?>> getAvatar() async {
    await _migrateLegacyValues({_presetKey, _pickedImageKey});
    return {
      'presetPath': await _storage.read(key: _secureKey(_presetKey)),
      'pickedImagePath': await _storage.read(key: _secureKey(_pickedImageKey)),
    };
  }

  static Future<void> saveUserProfile(Map<String, String> data) async {
    for (final entry in data.entries) {
      final key = _profileKeyFor(entry.key);
      if (key != null) {
        await _storage.write(key: _secureKey(key), value: entry.value);
      }
    }
    await _removeLegacyValues(_profileKeys);
  }

  static Future<void> overwriteUserProfile(Map<String, String?> data) async {
    for (final key in _profileKeys) {
      await _writeNullable(key, data[_profileFieldFor(key)]);
    }
    await _removeLegacyValues(_profileKeys);
  }

  static Future<Map<String, String?>> getUserProfile() async {
    await _migrateLegacyValues(_profileKeys);
    return {
      'username': await _storage.read(key: _secureKey(_usernameKey)),
      'email': await _storage.read(key: _secureKey(_emailKey)),
      'phone': await _storage.read(key: _secureKey(_phoneKey)),
      'birthday': await _storage.read(key: _secureKey(_birthdayKey)),
      'gender': await _storage.read(key: _secureKey(_genderKey)),
      'address': await _storage.read(key: _secureKey(_addressKey)),
      'state': await _storage.read(key: _secureKey(_stateKey)),
    };
  }

  static Future<void> clearUserProfile() async {
    for (final key in _profileKeys) {
      await _storage.delete(key: _secureKey(key));
    }
    await _removeLegacyValues(_profileKeys);
  }

  static Future<void> clearAvatar() async {
    await _storage.delete(key: _secureKey(_presetKey));
    await _storage.delete(key: _secureKey(_pickedImageKey));
    await _removeLegacyValues({_presetKey, _pickedImageKey});
  }

  static const Set<String> _profileKeys = {
    _usernameKey,
    _emailKey,
    _phoneKey,
    _birthdayKey,
    _genderKey,
    _addressKey,
    _stateKey,
  };

  static String _secureKey(String key) => '$_securePrefix$key';

  static String? _profileKeyFor(String field) => switch (field) {
        'username' => _usernameKey,
        'email' => _emailKey,
        'phone' => _phoneKey,
        'birthday' => _birthdayKey,
        'gender' => _genderKey,
        'address' => _addressKey,
        'state' => _stateKey,
        _ => null,
      };

  static String _profileFieldFor(String key) => key;

  static Future<void> _writeNullable(String key, String? value) async {
    if (value == null || value.isEmpty) {
      await _storage.delete(key: _secureKey(key));
    } else {
      await _storage.write(key: _secureKey(key), value: value);
    }
  }

  static Future<void> _migrateLegacyValues(Set<String> keys) async {
    final prefs = await SharedPreferences.getInstance();
    for (final key in keys) {
      final legacy = prefs.getString(key);
      if (legacy != null &&
          await _storage.read(key: _secureKey(key)) == null) {
        await _storage.write(key: _secureKey(key), value: legacy);
      }
      await prefs.remove(key);
    }
  }

  static Future<void> _removeLegacyValues(Set<String> keys) async {
    final prefs = await SharedPreferences.getInstance();
    for (final key in keys) {
      await prefs.remove(key);
    }
  }
}
