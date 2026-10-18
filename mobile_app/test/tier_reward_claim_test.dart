import 'package:flutter_test/flutter_test.dart';
import 'package:c2_coffee/services/customer_data_service.dart';

void main() {
  test('claimable tier reward parses separately from checkout vouchers', () {
    final reward = TierRewardEntitlement.fromApi({
      'id': 42,
      'status': 'claimable',
      'issue_case_ref': 'tier_unlock:brewer:7',
      'tier_code': 'brewer',
      'unlocked_at': '2026-10-16T08:00:00.000Z',
      'template': {
        'code': 'BREWER7',
        'name': 'Brewer Discount',
        'image_url': null,
        'voucher_type': 'tier_reward',
        'discount_mode': 'fixed_token',
        'discount_value': '2.00',
        'token_value': 2,
        'min_spend_rm': null,
        'requires_drink_in_cart': false,
        'eligible_scope_json': <String, dynamic>{},
        'exclude_scope_json': <String, dynamic>{},
      },
    });

    expect(reward.id, 42);
    expect(reward.isClaimable, isTrue);
    expect(reward.template.displayLabel, 'Brewer Discount');
    expect(reward.template.discountMode, 'fixed_token');
  });
}
