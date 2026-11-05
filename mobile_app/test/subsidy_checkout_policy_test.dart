import 'package:c2_coffee/services/subsidy_checkout_policy.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SubsidyCheckoutBreakdown', () {
    test('uses subsidy for eligible drinks when enabled', () {
      final result = SubsidyCheckoutBreakdown.calculate(
        combinedBalance: 206,
        totalCharge: 16,
        drinkCharge: 16,
        subsidyEligible: true,
        subsidyEnabled: true,
        subsidyRemaining: 200,
      );

      expect(result.personalBalance, 6);
      expect(result.subsidyApplied, 16);
      expect(result.personalRequired, 0);
      expect(result.canPay, isTrue);
    });

    test('reserves subsidy when the customer turns it off', () {
      final result = SubsidyCheckoutBreakdown.calculate(
        combinedBalance: 206,
        totalCharge: 16,
        drinkCharge: 16,
        subsidyEligible: true,
        subsidyEnabled: false,
        subsidyRemaining: 200,
      );

      expect(result.personalBalance, 6);
      expect(result.subsidyApplied, 0);
      expect(result.personalRequired, 16);
      expect(result.availableForOrder, 6);
      expect(result.canPay, isFalse);
    });

    test('uses subsidy only for the drink portion of a mixed order', () {
      final result = SubsidyCheckoutBreakdown.calculate(
        combinedBalance: 206,
        totalCharge: 20,
        drinkCharge: 10,
        subsidyEligible: true,
        subsidyEnabled: true,
        subsidyRemaining: 200,
      );

      expect(result.subsidyApplied, 10);
      expect(result.personalRequired, 10);
      expect(result.canPay, isFalse);
    });

    test('treats the full balance as personal for non-employees', () {
      final result = SubsidyCheckoutBreakdown.calculate(
        combinedBalance: 206,
        totalCharge: 16,
        drinkCharge: 16,
        subsidyEligible: false,
        subsidyEnabled: false,
        subsidyRemaining: 0,
      );

      expect(result.personalBalance, 206);
      expect(result.availableForOrder, 206);
      expect(result.canPay, isTrue);
    });
  });
}
