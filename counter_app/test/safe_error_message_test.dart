import 'package:counter_app/safe_error_message.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps known statuses without exposing backend text', () {
    expect(
      SafeErrorMessage.fromStatus(400, 'backend secret'),
      'Please check the information and try again.',
    );
    expect(SafeErrorMessage.fromStatus(500, 'safe fallback'), 'safe fallback');
  });
}
