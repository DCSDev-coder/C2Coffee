import 'package:counter_app/counter_cart_modifiers.dart';
import 'package:counter_app/counter_menu.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const temperatureGroup = CounterModifierGroup(
    id: 10,
    code: 'temperature',
    name: 'Choice of Temperature',
    selectionType: 'single',
    minSelect: 1,
    maxSelect: 1,
    isRequired: true,
    options: [
      CounterModifierOption(
        id: 101,
        code: 'cold',
        name: 'Cold',
        priceDeltaRm: '0.00',
        isDefault: true,
      ),
    ],
  );

  const item = CounterMenuItem(
    id: '7',
    name: 'Test Latte',
    priceRm: 10,
    imageUrl: null,
    isAvailable: true,
    allowChoiceOfBeans: true,
    allowEspressoShot: true,
    allowChoiceOfMilk: true,
    allowChoiceOfSweetness: true,
    allowIceLevel: true,
    allowTemperature: true,
    modifierGroups: [temperatureGroup],
    source: {},
  );

  test('keeps library and fallback choices in the checkout snapshot', () {
    final modifiers = buildCounterCartModifiers(
      item: item,
      customization: {
        'bean': 'Datin Blend',
        'espressoShots': '2 shots',
        'temperature': null,
        'milk': 'Oat Milk',
        'sweetness': 'Less Sweet',
        'iceLevel': 'Less Ice',
        'librarySelections': {
          10: [101],
        },
      },
    );

    expect(
      modifiers.map((modifier) => modifier['option_name']),
      containsAll([
        'Cold',
        'Datin Blend',
        '2 shots',
        'Oat Milk',
        'Less Sweet',
        'Less Ice',
      ]),
    );
    expect(counterCartModifierTotal(modifiers), 6);
  });

  test('does not send ice for a hot fallback drink', () {
    final hotItem = CounterMenuItem(
      id: item.id,
      name: item.name,
      priceRm: item.priceRm,
      imageUrl: null,
      isAvailable: true,
      allowIceLevel: true,
      allowTemperature: true,
      source: const {},
    );
    final modifiers = buildCounterCartModifiers(
      item: hotItem,
      customization: {'temperature': 'Hot', 'iceLevel': 'Regular Ice'},
    );

    expect(
      modifiers.map((modifier) => modifier['group_name']),
      isNot(contains('Ice Level')),
    );
  });
}
