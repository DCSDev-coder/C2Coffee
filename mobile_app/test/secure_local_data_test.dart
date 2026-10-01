import 'package:c2_coffee/services/pending_top_up_service.dart';
import 'package:c2_coffee/services/user_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });

  test('profile data migrates out of plaintext preferences', () async {
    SharedPreferences.setMockInitialValues({
      'email': 'customer@example.com',
      'phone': '+60123456789',
    });

    final profile = await UserService.getUserProfile();
    final prefs = await SharedPreferences.getInstance();
    const storage = FlutterSecureStorage();

    expect(profile['email'], 'customer@example.com');
    expect(profile['phone'], '+60123456789');
    expect(prefs.getString('email'), isNull);
    expect(prefs.getString('phone'), isNull);
    expect(await storage.read(key: 'profile_v2_email'),
        'customer@example.com');
    expect(await storage.read(key: 'profile_v2_phone'), '+60123456789');
  });

  test('pending top-up survives service recreation and can be cleared', () async {
    await PendingTopUpService.instance.save('TOPUP-123');
    expect(await PendingTopUpService.instance.read(), 'TOPUP-123');

    await PendingTopUpService.instance.clear();
    expect(await PendingTopUpService.instance.read(), isNull);
  });
}
