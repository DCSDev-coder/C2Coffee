import 'package:c2_coffee/services/customer_data_service.dart';
import 'package:flutter_test/flutter_test.dart';

RewardVoucherTemplate template(Map<String, dynamic> scope) {
  return RewardVoucherTemplate(
    code: 'VCH-1', name: 'Test', imageUrl: null, typeLabel: '',
    benefitType: 'Discount', audience: 'all_customers', voucherType: 'discount',
    discountMode: 'percent_rm', discountValue: '20.00', tokenValue: null,
    paymentModes: const [], minSpendRm: null, requiresDrinkInCart: false,
    howToUse: '', eligibleScope: scope, excludeScope: const {}, promotionRule: const {},
  );
}

void main() {
  test('eligibility summary leaves the remaining count to the expand button', () {
    final value = template({
      'items': ['Latte', 'Mocha', 'Espresso', 'Cappuccino', 'Flat White']
    });
    expect(value.eligibilitySummary, 'Selected: Latte, Mocha, Espresso');
    expect(value.eligibilityMoreCount, 2);
    expect(value.hasExpandedEligibility, isTrue);
  });
}
