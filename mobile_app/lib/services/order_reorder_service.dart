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
      final selectedStore = session.selectedStore;
      if (selectedStore?.id != order.store.id) {
        await session.selectStore(
          StoreSummary(
            id: order.store.id,
            code: 'reorder',
            name: order.store.name,
            supportsPickup: true,
            pickupLeadMinutes: 0,
            status: 'active',
          ),
        );
      }

      final menuItemsById = {
        for (final item in session.allMenuItems) item.id: item,
      };
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
        final currentMenuItem = menuItemsById[orderItem.menuItemId];
        if (currentMenuItem == null || !currentMenuItem.isAvailable) {
          throw ApiException(
            'One or more items from this order are no longer available.',
            code: 'order_item_unavailable',
          );
        }

        final modifiers = orderItem.modifiers
            .map(
              (modifier) => CartModifier(
                groupName: modifier.groupName,
                optionName: modifier.optionName,
                priceDeltaRm: double.tryParse(modifier.priceDeltaRm) ?? 0.0,
                tokenPriceDelta: modifier.tokenPriceDelta,
              ),
            )
            .toList();

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
      AppNotification.showError(context, error.message);
    } catch (_) {
      if (!context.mounted) return;
      AppNotification.showError(
        context,
        'Unable to reorder this order right now.',
      );
    }
  }
}
