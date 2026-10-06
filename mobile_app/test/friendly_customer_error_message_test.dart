import 'package:c2_coffee/services/auth_api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const fallback = 'Something went wrong. Please try again.';

  group('friendlyCustomerErrorMessage', () {
    test('maps known customer errors to actionable messages', () {
      expect(
        friendlyCustomerErrorMessage(
          ApiException('Selected voucher expired.', code: 'voucher_expired'),
          fallback: fallback,
        ),
        'This voucher is no longer available. Please choose another voucher.',
      );
      expect(
        friendlyCustomerErrorMessage(
          ApiException('No row matched.', code: 'referral_code_not_found'),
          fallback: fallback,
        ),
        'That referral code was not found. Please check it and try again.',
      );
      expect(
        friendlyCustomerErrorMessage(
          ApiException('Token rejected.', code: 'invalid_refresh_token'),
          fallback: fallback,
        ),
        'Your session has expired. Please sign in again.',
      );
      expect(
        friendlyCustomerErrorMessage(
          ApiException('Birthday locked.',
              code: 'birthday_change_support_required'),
          fallback: fallback,
        ),
        'For account security, contact support to correct your saved birthday.',
      );
    });

    test('uses neutral wording for generic validation errors', () {
      expect(
        friendlyCustomerErrorMessage(
          ApiException('Field payload rejected.', code: 'validation_error'),
          fallback: fallback,
        ),
        'Please review the information and try again.',
      );
    });

    test('never exposes unknown backend or non-API error details', () {
      expect(
        friendlyCustomerErrorMessage(
          ApiException(
            'ER_DUP_ENTRY: Duplicate entry 42 for key users.email',
            code: 'database_constraint_failed',
          ),
          fallback: fallback,
        ),
        fallback,
      );
      expect(
        friendlyCustomerErrorMessage(
          Exception('SocketException: host api.internal.local'),
          fallback: fallback,
        ),
        fallback,
      );
    });
  });
}
