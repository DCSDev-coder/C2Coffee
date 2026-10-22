import 'package:counter_app/counter_menu.dart';
import 'package:counter_app/product_detail_modal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final sampleItem = CounterMenuItem(
    id: '101',
    name: 'Senja Di Broga',
    priceRm: 16.90,
    imageUrl: null,
    isAvailable: true,
    categoryName: 'Coffee Craft',
    allowChoiceOfBeans: true,
    allowChoiceOfMilk: true,
    allowTemperature: true,
    allowChoiceOfSweetness: true,
    allowIceLevel: true,
    allowEspressoShot: false,
    source: {'desc': 'Specialty handcrafted drink prepared fresh to order.'},
    modifierGroups: [
      CounterModifierGroup(
        id: 1,
        code: 'TOPPINGS',
        name: 'Extra Topping',
        selectionType: 'multiple',
        isRequired: false,
        minSelect: 0,
        maxSelect: 3,
        options: [
          CounterModifierOption(
            id: 10,
            code: 'CARAMEL',
            name: 'Caramel Drizzle',
            priceDeltaRm: '2.00',
            isDefault: false,
          ),
          CounterModifierOption(
            id: 11,
            code: 'WHIP',
            name: 'Whipped Cream',
            priceDeltaRm: '2.50',
            isDefault: false,
          ),
        ],
      ),
    ],
  );

  testWidgets(
    'renders product detail options in tablet landscape without overflow',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1180, 820);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: ProductDetailModal(item: sampleItem),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Senja Di Broga'), findsWidgets);
      expect(find.text('Dato Blend'), findsOneWidget);
      expect(find.text('Datin Blend'), findsOneWidget);
      expect(find.text('Fresh Milk'), findsOneWidget);
      expect(find.text('Oat Milk'), findsOneWidget);
      expect(find.text('ADD TO CART'), findsOneWidget);
    },
  );

  testWidgets(
    'renders product detail options in tablet portrait without overflow',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(768, 1024);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: ProductDetailModal(item: sampleItem),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Senja Di Broga'), findsWidgets);
      expect(find.text('Fresh Milk'), findsOneWidget);
      expect(find.text('Oat Milk'), findsOneWidget);
      expect(find.text('ADD TO CART'), findsOneWidget);
    },
  );

  testWidgets(
    'selecting options updates selection and returns customization map',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      Map<String, dynamic>? result;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await Navigator.of(context).push<Map<String, dynamic>>(
                  MaterialPageRoute(
                    builder: (context) => ProductDetailModal(item: sampleItem),
                  ),
                );
              },
              child: const Text('Open Modal'),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      // Tap Oat Milk
      await tester.tap(find.text('Oat Milk'));
      await tester.pumpAndSettle();

      // Tap Add to Cart
      await tester.tap(find.text('ADD TO CART'));
      await tester.pumpAndSettle();

      expect(result, isNotNull);
      expect(result!['milk'], 'Oat Milk');
      expect(result!['quantity'], 1);
    },
  );
}
