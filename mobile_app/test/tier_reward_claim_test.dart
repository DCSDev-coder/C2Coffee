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

  test('claimed tier reward stays active without a fixed calendar expiry', () {
    final voucher = RewardVoucher.fromApi({
      'id': 77,
      'status': 'active',
      'issued_reason': 'Claimed tier reward: Brewer Discount',
      'issue_case_ref': 'tier_claim:42',
      'tier_at_issue': 'brewer',
      'reward_kind': 'tier_achievement',
      'has_fixed_expiry': false,
      'validity_label': 'Valid while your current tier remains active',
      'issued_at': '2026-10-22T08:00:00.000Z',
      'expires_at': '2000-01-01T00:00:00.000Z',
      'redeemed_at': null,
      'revoked_at': null,
      'revoked_reason': null,
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

    expect(voucher.rewardKind, 'tier_achievement');
    expect(voucher.hasFixedExpiry, isFalse);
    expect(voucher.validityLabel,
        'Valid while your current tier remains active');
    expect(voucher.isActive, isTrue);
  });

  test('daily voucher uses its time window instead of a misleading date', () {
    final voucher = RewardVoucher.fromApi({
      'id': 78,
      'status': 'active',
      'issued_reason': 'Daily employee voucher: Employee Free Drinks',
      'issue_case_ref': 'daily:2026-10-23',
      'tier_at_issue': null,
      'reward_kind': 'voucher',
      'has_fixed_expiry': true,
      'validity_label': 'Today, 9:00 AM - 10:00 PM',
      'issued_at': '2026-10-23T01:00:00.000Z',
      'expires_at': '2026-10-23T14:00:59.999Z',
      'redeemed_at': null,
      'revoked_at': null,
      'revoked_reason': null,
      'template': {
        'code': 'EMPLOYEE_DAILY',
        'name': 'Employee Free Drinks',
        'image_url': null,
        'voucher_type': 'campaign_token_equivalent',
        'discount_mode': 'free_drink',
        'discount_value': '1.00',
        'token_value': null,
        'min_spend_rm': null,
        'requires_drink_in_cart': false,
        'eligible_scope_json': <String, dynamic>{
          'schedule': <String, dynamic>{
            'mode': 'daily',
            'startTime': '09:00',
            'endTime': '22:00',
          },
        },
        'exclude_scope_json': <String, dynamic>{},
      },
    });

    expect(voucher.validityLabel, 'Today, 9:00 AM - 10:00 PM');
  });
}
