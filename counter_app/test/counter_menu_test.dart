import 'package:counter_app/counter_menu.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('flattens the categorized counter menu returned by the API', () {
    final items = parseCounterMenu({
      'store_id': 1,
      'categories': [
        {
          'items': [
            {
              'id': 101,
              'name': 'Latte',
              'base_price_rm': '12.90',
              'image_url': 'https://cdn.example.test/latte.png',
              'is_available': true,
            },
            {
              'id': 102,
              'name': 'Unavailable drink',
              'base_price_rm': '9.00',
              'is_available': false,
            },
          ],
        },
      ],
    });

    expect(items, hasLength(1));
    expect(items.single.id, '101');
    expect(items.single.name, 'Latte');
    expect(items.single.priceRm, 12.90);
    expect(items.single.imageUrl, 'https://cdn.example.test/latte.png');
  });

  test('supports the legacy flat menu shape without crashing', () {
    final items = parseCounterMenu({
      'items': [
        {'id': '5', 'name': 'Tea', 'price': 6.5},
        {'id': null, 'name': 'Malformed'},
      ],
    });

    expect(items, hasLength(1));
    expect(items.single.id, '5');
    expect(items.single.priceRm, 6.5);
  });
}
