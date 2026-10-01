import 'package:c2_coffee/services/api_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('accepts deployment API origins only when HTTPS and versioned', () {
    expect(
      ApiConfig.validateBaseUrl('https://cafe.example.com/v1/'),
      'https://cafe.example.com/v1',
    );
  });

  test('rejects unsafe or ambiguous deployment API URLs', () {
    for (final value in [
      'http://cafe.example.com/v1',
      'https://user:pass@cafe.example.com/v1',
      'https://cafe.example.com',
      'https://cafe.example.com/v1?tenant=other',
    ]) {
      expect(() => ApiConfig.validateBaseUrl(value), throwsStateError);
    }
  });
}
