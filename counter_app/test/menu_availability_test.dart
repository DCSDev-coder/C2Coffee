import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:counter_app/counter_menu.dart';
import 'package:counter_app/product_detail_modal.dart';
import 'package:counter_app/barista/services/api_service.dart';

void main() {
  group('BaristaMenuAvailabilityResult Parsing', () {
    test('parses menu availability payload with beans and categories', () {
      final json = {
        'store_id': 1,
        'store_name': 'C2 Cafe - Main Outlet',
        'beans': [
          {
            'code': 'dato_blend',
            'name': "Dato' Blend",
            'subtitle': 'Bold & Dark Chocolatey',
            'value': 'dato blend',
            'is_available': true,
          },
          {
            'code': 'datin_blend',
            'name': 'Datin Blend',
            'subtitle': 'Floral & Citrusy Bright',
            'value': 'datin blend',
            'is_available': false,
          },
        ],
        'categories': [
          {
            'id': 10,
            'name': 'Coffee Craft',
            'sort_order': 1,
            'items': [
              {
                'id': 101,
                'name': 'Spanish Latte',
                'description': 'Smooth latte with condensed milk',
                'base_price_rm': '13.00',
                'image_url': null,
                'allow_choice_of_beans': true,
                'is_available': true,
              },
              {
                'id': 102,
                'name': 'Matcha Latte',
                'description': 'Pure Japanese Uji matcha',
                'base_price_rm': '15.00',
                'image_url': null,
                'allow_choice_of_beans': false,
                'is_available': false,
              },
            ],
          },
        ],
      };

      final result = BaristaMenuAvailabilityResult.fromJson(json);

      expect(result.storeId, 1);
      expect(result.storeName, 'C2 Cafe - Main Outlet');
      expect(result.beans.length, 2);
      expect(result.beans[0].name, "Dato' Blend");
      expect(result.beans[0].isAvailable, isTrue);
      expect(result.beans[1].name, 'Datin Blend');
      expect(result.beans[1].isAvailable, isFalse);

      expect(result.categories.length, 1);
      final cat = result.categories[0];
      expect(cat.name, 'Coffee Craft');
      expect(cat.items.length, 2);

      final item1 = cat.items[0];
      expect(item1.name, 'Spanish Latte');
      expect(item1.allowChoiceOfBeans, isTrue);
      expect(item1.isAvailable, isTrue);

      final item2 = cat.items[1];
      expect(item2.name, 'Matcha Latte');
      expect(item2.allowChoiceOfBeans, isFalse);
      expect(item2.isAvailable, isFalse);
    });
  });

  group('Blend Availability in ProductDetailModal', () {
    testWidgets('shows only Dato Blend when Datin Blend is unavailable', (tester) async {
      tester.view.physicalSize = const Size(1180, 820);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final itemWithOnlyDato = CounterMenuItem(
        id: '101',
        name: 'Spanish Latte',
        priceRm: 13.00,
        imageUrl: null,
        isAvailable: true,
        allowChoiceOfBeans: true,
        source: {
          'desc': 'Handcrafted Spanish Latte',
          'available_beans': ['Dato Blend'],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ProductDetailModal(item: itemWithOnlyDato),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Dato Blend'), findsOneWidget);
      expect(find.text('Datin Blend'), findsNothing);
    });

    testWidgets('shows only Datin Blend when Dato Blend is unavailable', (tester) async {
      tester.view.physicalSize = const Size(1180, 820);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final itemWithOnlyDatin = CounterMenuItem(
        id: '101',
        name: 'Spanish Latte',
        priceRm: 13.00,
        imageUrl: null,
        isAvailable: true,
        allowChoiceOfBeans: true,
        source: {
          'desc': 'Handcrafted Spanish Latte',
          'available_beans': ['Datin Blend'],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ProductDetailModal(item: itemWithOnlyDatin),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Datin Blend'), findsOneWidget);
      expect(find.text('Dato Blend'), findsNothing);
    });

    testWidgets('shows only Fresh Milk when Oat Milk is unavailable', (tester) async {
      tester.view.physicalSize = const Size(1180, 820);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final itemWithOnlyFreshMilk = CounterMenuItem(
        id: '101',
        name: 'Spanish Latte',
        priceRm: 13.00,
        imageUrl: null,
        isAvailable: true,
        allowChoiceOfBeans: true,
        allowChoiceOfMilk: true,
        source: {
          'desc': 'Handcrafted Spanish Latte',
          'available_beans': ['Dato Blend', 'Datin Blend'],
          'available_milks': ['Fresh Milk'],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ProductDetailModal(item: itemWithOnlyFreshMilk),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Fresh Milk'), findsOneWidget);
      expect(find.text('Oat Milk'), findsNothing);
    });

    testWidgets('shows only Oat Milk when Fresh Milk is unavailable', (tester) async {
      tester.view.physicalSize = const Size(1180, 820);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final itemWithOnlyOatMilk = CounterMenuItem(
        id: '101',
        name: 'Spanish Latte',
        priceRm: 13.00,
        imageUrl: null,
        isAvailable: true,
        allowChoiceOfBeans: true,
        allowChoiceOfMilk: true,
        source: {
          'desc': 'Handcrafted Spanish Latte',
          'available_beans': ['Dato Blend', 'Datin Blend'],
          'available_milks': ['Oat Milk'],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ProductDetailModal(item: itemWithOnlyOatMilk),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Oat Milk'), findsOneWidget);
      expect(find.text('Fresh Milk'), findsNothing);
    });
  });
}
