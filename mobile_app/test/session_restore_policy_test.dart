import 'package:c2_coffee/services/auth_api_service.dart';
import 'package:c2_coffee/services/session_restore_policy.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('only confirmed invalid sessions clear customer credentials', () {
    expect(
      sessionRestoreOutcomeForError(
        ApiException('Expired', code: 'invalid_refresh_token'),
      ),
      SessionRestoreOutcome.signedOut,
    );
    expect(
      sessionRestoreOutcomeForError(
        ApiException('Offline', code: 'network_error'),
      ),
      SessionRestoreOutcome.unavailable,
    );
    expect(
      sessionRestoreOutcomeForError(Exception('Socket unavailable')),
      SessionRestoreOutcome.unavailable,
    );
  });
}
