import 'package:flutter/material.dart';

import '../screens/loading_order_page.dart';
import '../screens/order_confirmation_page.dart';
import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/cart_service.dart';
import '../services/catalog_api_service.dart';
import '../services/customer_data_service.dart';
import '../utils/app_notification.dart';

class OrderReorderService {
  OrderReorderService._();

  static final OrderReorderService instance = OrderReorderService._();

  Future<void> reorderOrder(
    BuildContext context,
    CustomerOrder order,
  ) async {
    try {
      final session = AppSessionService.instance;
      final reorderStore = session.stores
          .where((store) => store.id == order.store.id)
          .firstOrNull;
      if (reorderStore == null ||
          reorderStore.status != 'active' ||
          !reorderStore.supportsPickup) {
        throw ApiException(
          'This previous order belongs to an outlet that is not currently available for pickup.',
          code: 'store_not_available',
        );
      }

      // Historical orders must be checked against the current outlet menu.
      // This also handles a customer changing outlets after the original
      // order: selectStore reloads the menu instead of rejecting the reorder
      // merely because the previously selected outlet differs.
      await session.selectStore(
        reorderStore,
        selectedManually: false,
        forceRefresh: true,
      );

      final menuItemsById = {
        for (final item in session.allMenuItems) item.id: item,
      };
      final menuItemsByName = <String, List<CatalogMenuItem>>{};
      for (final item in session.allMenuItems) {
        final key = _normalize(item.name);
        menuItemsByName.putIfAbsent(key, () => <CatalogMenuItem>[]).add(item);
      }
      final menuItemMetaById = {
        for (final category in session.menuCategories)
          for (final item in category.items)
            item.id: {
              'categoryCode': category.code,
              'categoryName': category.name,
              'subcategoryCode': item.subcategoryCode,
              'subcategoryName': item.subcategoryName,
              'productKindCode': item.productKindCode,
              'productKindName': item.productKindName,
            },
      };

      final itemsToAdd = <CartItem>[];

      for (final orderItem in order.items) {
        // Prefer the immutable historical ID. If an administrator replaced a
        // menu row, use a unique exact-name match as a safe compatibility
        // fallback so the customer's previous order remains reorderable.
        var currentMenuItem = menuItemsById[orderItem.menuItemId];
        if (currentMenuItem == null || !currentMenuItem.isOrderable) {
          final matches = menuItemsByName[_normalize(orderItem.name)] ??
              const <CatalogMenuItem>[];
          if (matches.length == 1 && matches.first.isOrderable) {
            currentMenuItem = matches.first;
          }
        }
        if (currentMenuItem == null || !currentMenuItem.isOrderable) {
          throw ApiException(
            'One or more items from this order are no longer available.',
            code: 'order_item_unavailable',
          );
        }

        final modifiers = migrateCurrentModifiersForReorder(
          currentMenuItem,
          orderItem.modifiers,
        );

        final currentTokenPrice = currentMenuItem.tokenPrices[session.tier] ??
            (currentMenuItem.basePriceToken > 0
                ? currentMenuItem.basePriceToken
                : orderItem.tokenPrice ?? 0);
        final currentMenuMeta =
            menuItemMetaById[currentMenuItem.id] ?? const <String, String?>{};

        itemsToAdd.add(
          CartItem(
            id: 'reorder-${order.id}-${orderItem.id}',
            menuItemId: currentMenuItem.id,
            menuItemCode: currentMenuItem.code,
            name: currentMenuItem.name,
            categoryCode: currentMenuMeta['categoryCode'],
            categoryName: currentMenuMeta['categoryName'],
            subcategoryCode: currentMenuMeta['subcategoryCode'],
            subcategoryName: currentMenuMeta['subcategoryName'],
            productKindCode: currentMenuMeta['productKindCode'],
            productKindName: currentMenuMeta['productKindName'],
            imageAssetPath: null,
            imageUrl: currentMenuItem.imageUrl,
            basePriceRm: double.tryParse(currentMenuItem.basePriceRm) ??
                double.tryParse(orderItem.basePriceRm) ??
                0.0,
            tokenPrice: currentTokenPrice,
            quantity: orderItem.quantity,
            remarks: null,
            displayDetails: null,
            modifiers: modifiers,
          ),
        );
      }

      if (itemsToAdd.isEmpty) {
        throw ApiException(
          'This order has no items to reorder.',
          code: 'order_empty',
        );
      }

      CartService.instance.clear();
      for (final item in itemsToAdd) {
        CartService.instance.addItem(
          storeId: order.store.id,
          storeName: order.store.name,
          item: item,
        );
      }

      if (!context.mounted) return;
      InteractiveFillingLoader.show(
        context,
        targetPage: const OrderConfirmationPage(),
      );
    } on ApiException catch (error) {
      if (!context.mounted) return;
      AppNotification.showError(
        context,
        friendlyCustomerErrorMessage(
          error,
          fallback: 'Unable to reorder this order right now.',
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      AppNotification.showError(
        context,
        'Unable to reorder this order right now.',
      );
    }
  }

  static String _normalize(String value) =>
      value.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ');

  static List<CartModifier> migrateCurrentModifiersForReorder(
    CatalogMenuItem item,
    List<CustomerOrderItemModifier> historicalModifiers,
  ) {
    final groups = item.modifierGroups
        .where((group) => group.source == 'library')
        .toList();
    if (groups.isEmpty) return const [];

    final historicalByGroup = <String, List<CustomerOrderItemModifier>>{};
    for (final modifier in historicalModifiers) {
      if (modifier.groupName.trim().toLowerCase() == 'remarks') continue;
      historicalByGroup
          .putIfAbsent(_normalize(modifier.groupName), () => [])
          .add(modifier);
    }

    final selectedByGroup = <int, List<CatalogModifierOption>>{};
    final selectedOptionIds = <int>{};

    for (final group in groups) {
      if (!_isVisible(group, groups, selectedByGroup, selectedOptionIds)) {
        selectedByGroup[group.id] = const [];
        continue;
      }

      final optionsByName = {
        for (final option in group.options) _normalize(option.name): option,
      };
      final selected = <CatalogModifierOption>[];
      final maxSelect =
          group.maxSelect > 0 ? group.maxSelect : group.options.length;
      for (final historical in historicalByGroup[_normalize(group.name)] ??
          const <CustomerOrderItemModifier>[]) {
        final option = optionsByName[_normalize(historical.optionName)];
        if (option == null || selected.any((item) => item.id == option.id)) {
          continue;
        }
        selected.add(option);
        if (selected.length >= maxSelect) break;
      }

      final minimum = group.isRequired
          ? (group.minSelect < 1 ? 1 : group.minSelect)
          : group.minSelect;
      if (selected.length < minimum) {
        final fallbackOptions = [
          ...group.options.where((option) => option.isDefault),
          ...group.options,
        ];
        for (final option in fallbackOptions) {
          if (selected.any((item) => item.id == option.id)) continue;
          selected.add(option);
          if (selected.length >= minimum || selected.length >= maxSelect) break;
        }
      }

      selectedByGroup[group.id] = selected;
      selectedOptionIds.addAll(selected.map((option) => option.id));
    }

    return [
      for (final group in groups)
        for (final option in selectedByGroup[group.id] ?? const [])
          CartModifier(
            optionGroupId: group.id,
            optionGroupOptionId: option.id,
            groupName: group.name,
            optionName: option.name,
            priceDeltaRm: double.tryParse(option.priceDeltaRm) ?? 0.0,
            tokenPriceDelta: option.tokenPriceDelta,
          ),
    ];
  }

  static bool _isVisible(
    CatalogModifierGroup group,
    List<CatalogModifierGroup> groups,
    Map<int, List<CatalogModifierOption>> selectedByGroup,
    Set<int> selectedOptionIds,
  ) {
    if (group.hiddenWhenOptionIds.isEmpty) {
      final temperatureGroups = groups
          .where((candidate) =>
              candidate.name.toLowerCase().contains('temperature'))
          .toList();
      final hasTemperatureSelection = temperatureGroups.any(
        (candidate) => (selectedByGroup[candidate.id] ?? const []).isNotEmpty,
      );
      final isCold = temperatureGroups.any(
        (candidate) => (selectedByGroup[candidate.id] ?? const []).any(
          (option) => _normalize(option.name) == 'cold',
        ),
      );
      final isIceGroup =
          RegExp(r'\bice\b', caseSensitive: false).hasMatch(group.name);
      return !isIceGroup || !hasTemperatureSelection || isCold;
    }

    if (group.hiddenWhenOptionIds.any(selectedOptionIds.contains)) return false;
    final parentGroups = groups.where((candidate) =>
        candidate.id != group.id &&
        candidate.options.any(
          (option) => group.hiddenWhenOptionIds.contains(option.id),
        ));
    for (final parent in parentGroups) {
      if ((selectedByGroup[parent.id] ?? const []).isEmpty) return false;
    }
    return true;
  }
}
