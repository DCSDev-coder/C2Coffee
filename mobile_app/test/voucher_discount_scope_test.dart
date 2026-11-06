import 'package:c2_coffee/services/cart_service.dart';
import 'package:c2_coffee/services/customer_data_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('free item token estimate only uses the configured reward scope', () {
    final template = RewardVoucherTemplate(
      code: 'FREE-DRINK',
      name: 'Free Drink',
      imageUrl: null,
      typeLabel: '',
      benefitType: 'Free',
      audience: 'all_customers',
      voucherType: 'campaign_token_equivalent',
      discountMode: 'free_drink',
      discountValue: '0',
      tokenValue: null,
      paymentModes: const ['token'],
      minSpendRm: null,
      requiresDrinkInCart: true,
      howToUse: '',
      eligibleScope: const {
        'product_kind_codes': ['drink'],
      },
      excludeScope: const {},
      promotionRule: const {
        'kind': 'standard',
        'qualifying_quantity': 1,
        'reward_quantity': 1,
        'qualifying_scope': {},
        'reward_scope': {},
      },
    );
    final snapshot = CartSnapshot(
      storeId: 1,
      storeName: 'Test',
      items: const [
        CartItem(
          id: 'food',
          menuItemId: 1,
          menuItemCode: 'FOOD',
          name: 'Food',
          productKindCode: 'food',
          basePriceRm: 20,
          tokenPrice: 20,
          quantity: 1,
        ),
        CartItem(
          id: 'drink',
          menuItemId: 2,
          menuItemCode: 'DRINK',
          name: 'Drink',
          productKindCode: 'drink',
          basePriceRm: 10,
          tokenPrice: 10,
          quantity: 1,
        ),
      ],
    );

    expect(template.freeItemTokenDiscount(snapshot), 10);
  });
}
