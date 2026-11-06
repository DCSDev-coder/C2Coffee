import 'package:c2_coffee/services/catalog_api_service.dart';
import 'package:c2_coffee/services/customer_data_service.dart';
import 'package:c2_coffee/services/order_reorder_service.dart';
import 'package:flutter_test/flutter_test.dart';

CatalogModifierOption option({
  required int id,
  required String name,
  bool isDefault = false,
}) =>
    CatalogModifierOption(
      id: id,
      code: name.toLowerCase().replaceAll(' ', '_'),
      name: name,
      priceDeltaRm: '0.00',
      tokenPriceDelta: 0,
      calorieDeltaKcal: 0,
      imageUrl: null,
      colorHex: null,
      gradientEndHex: null,
      gradientDirection: 'diagonal',
      isActive: true,
      isDefault: isDefault,
      sortOrder: id,
    );

CatalogModifierGroup group({
  required int id,
  required String name,
  required List<CatalogModifierOption> options,
  bool required = true,
  List<int> hiddenWhenOptionIds = const [],
}) =>
    CatalogModifierGroup(
      id: id,
      code: name.toLowerCase().replaceAll(' ', '_'),
      name: name,
      selectionType: 'single',
      minSelect: required ? 1 : 0,
      maxSelect: 1,
      isRequired: required,
      sortOrder: id,
      source: 'library',
      hiddenWhenOptionIds: hiddenWhenOptionIds,
      options: options,
    );

CatalogMenuItem item(List<CatalogModifierGroup> groups) => CatalogMenuItem(
      id: 1,
      code: 'TEST',
      name: 'Test Drink',
      description: null,
      basePriceRm: '10.00',
      basePriceToken: 10,
      baseCaloriesKcal: 0,
      imageUrl: null,
      colorHex: null,
      gradientEndHex: null,
      isAvailable: true,
      isHandcraftedDrink: true,
      isQualifyingCup: true,
      allowChoiceOfBeans: false,
      allowEspressoShot: false,
      allowChoiceOfMilk: false,
      allowChoiceOfSweetness: false,
      allowIceLevel: false,
      allowTemperature: false,
      allowSparklingMixer: false,
      allowOrderType: false,
      allowRemarks: false,
      subcategoryId: null,
      subcategoryCode: null,
      subcategoryName: null,
      productKindCode: 'drink',
      productKindName: 'Drink',
      tokenPrices: const {},
      modifierGroups: groups,
    );

void main() {
  test('reorder preserves valid choices and defaults newly required groups',
      () {
    final migrated = OrderReorderService.migrateCurrentModifiersForReorder(
      item([
        group(
          id: 1,
          name: 'Temperature',
          options: [option(id: 11, name: 'Hot', isDefault: true)],
        ),
        group(
          id: 2,
          name: 'Milk',
          options: [
            option(id: 21, name: 'Fresh Milk', isDefault: true),
            option(id: 22, name: 'Oat Milk'),
          ],
        ),
      ]),
      const [
        CustomerOrderItemModifier(
          groupName: 'Milk',
          optionName: 'Oat Milk',
          priceDeltaRm: '3.00',
          tokenPriceDelta: 3,
        ),
      ],
    );

    expect(
      migrated
          .map((modifier) => '${modifier.groupName}:${modifier.optionName}'),
      ['Temperature:Hot', 'Milk:Oat Milk'],
    );
  });

  test('reorder replaces removed choices with the current default', () {
    final migrated = OrderReorderService.migrateCurrentModifiersForReorder(
      item([
        group(
          id: 1,
          name: 'Milk',
          options: [option(id: 11, name: 'Fresh Milk', isDefault: true)],
        ),
      ]),
      const [
        CustomerOrderItemModifier(
          groupName: 'Milk',
          optionName: 'Removed Milk',
          priceDeltaRm: '0.00',
          tokenPriceDelta: 0,
        ),
      ],
    );

    expect(migrated.single.optionName, 'Fresh Milk');
  });

  test('reorder omits dependent groups when their parent is unselected', () {
    final hot = option(id: 11, name: 'Hot');
    final cold = option(id: 12, name: 'Cold');
    final migrated = OrderReorderService.migrateCurrentModifiersForReorder(
      item([
        group(
          id: 1,
          name: 'Temperature',
          options: [hot, cold],
          required: false,
        ),
        group(
          id: 2,
          name: 'Ice Level',
          options: [option(id: 21, name: 'Regular Ice', isDefault: true)],
          hiddenWhenOptionIds: [hot.id],
        ),
      ]),
      const [],
    );

    expect(migrated, isEmpty);
  });
}
