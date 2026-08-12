import 'package:flutter/foundation.dart';

class CartModifier {
  final String groupName;
  final String optionName;
  final double priceDeltaRm;
  final int tokenPriceDelta;

  const CartModifier({
    required this.groupName,
    required this.optionName,
    this.priceDeltaRm = 0,
    this.tokenPriceDelta = 0,
  });

  Map<String, dynamic> toApi() {
    return {
      'group_name': groupName,
      'option_name': optionName,
      'price_delta_rm': priceDeltaRm.toStringAsFixed(2),
      'token_price_delta': tokenPriceDelta,
    };
  }
}

class CartItem {
  final String id;
  final int menuItemId;
  final String menuItemCode;
  final String name;
  final String? imageAssetPath;
  final String? imageUrl;
  final double basePriceRm;
  final int tokenPrice;
  final int quantity;
  final String? remarks;
  final String? displayDetails;
  final List<CartModifier> modifiers;

  const CartItem({
    required this.id,
    required this.menuItemId,
    required this.menuItemCode,
    required this.name,
    required this.basePriceRm,
    required this.tokenPrice,
    required this.quantity,
    this.imageAssetPath,
    this.imageUrl,
    this.remarks,
    this.displayDetails,
    this.modifiers = const [],
  });

  double get modifierTotalRm =>
      modifiers.fold(0, (sum, modifier) => sum + modifier.priceDeltaRm);

  int get modifierTotalTokens =>
      modifiers.fold(0, (sum, modifier) => sum + modifier.tokenPriceDelta);

  double get unitTotalRm => basePriceRm + modifierTotalRm;

  int get unitTotalTokens => tokenPrice + modifierTotalTokens;

  double get lineTotalRm => unitTotalRm * quantity;

  int get lineTotalTokens => unitTotalTokens * quantity;

  CartItem copyWith({
    int? quantity,
    String? remarks,
    String? displayDetails,
    List<CartModifier>? modifiers,
  }) {
    return CartItem(
      id: id,
      menuItemId: menuItemId,
      menuItemCode: menuItemCode,
      name: name,
      imageAssetPath: imageAssetPath,
      imageUrl: imageUrl,
      basePriceRm: basePriceRm,
      tokenPrice: tokenPrice,
      quantity: quantity ?? this.quantity,
      remarks: remarks ?? this.remarks,
      displayDetails: displayDetails ?? this.displayDetails,
      modifiers: modifiers ?? this.modifiers,
    );
  }

  Map<String, dynamic> toApi() {
    return {
      'menu_item_id': menuItemId,
      'quantity': quantity,
      'remarks': remarks,
      'modifiers': modifiers.map((modifier) => modifier.toApi()).toList(),
    };
  }
}

class CartSnapshot {
  final int storeId;
  final String storeName;
  final List<CartItem> items;

  const CartSnapshot({
    required this.storeId,
    required this.storeName,
    required this.items,
  });

  double get subtotalRm =>
      items.fold(0, (sum, item) => sum + item.lineTotalRm);

  int get subtotalTokens =>
      items.fold(0, (sum, item) => sum + item.lineTotalTokens);
}

class CartService extends ChangeNotifier {
  CartService._();

  static final CartService instance = CartService._();

  int? _storeId;
  String? _storeName;
  final List<CartItem> _items = [];

  int? get storeId => _storeId;
  String? get storeName => _storeName;
  List<CartItem> get items => List.unmodifiable(_items);
  bool get isEmpty => _items.isEmpty;

  CartSnapshot? get snapshot {
    if (_storeId == null || _storeName == null || _items.isEmpty) {
      return null;
    }
    return CartSnapshot(
      storeId: _storeId!,
      storeName: _storeName!,
      items: List.unmodifiable(_items),
    );
  }

  void addItem({
    required int storeId,
    required String storeName,
    required CartItem item,
  }) {
    if (_storeId != null && _storeId != storeId) {
      clear();
    }

    _storeId = storeId;
    _storeName = storeName;
    _items.add(item);
    notifyListeners();
  }

  void updateQuantity(String itemId, int quantity) {
    final index = _items.indexWhere((item) => item.id == itemId);
    if (index == -1) return;

    if (quantity <= 0) {
      _items.removeAt(index);
    } else {
      _items[index] = _items[index].copyWith(quantity: quantity);
    }

    if (_items.isEmpty) {
      _storeId = null;
      _storeName = null;
    }
    notifyListeners();
  }

  void removeItem(String itemId) {
    _items.removeWhere((item) => item.id == itemId);
    if (_items.isEmpty) {
      _storeId = null;
      _storeName = null;
    }
    notifyListeners();
  }

  void clear() {
    _storeId = null;
    _storeName = null;
    _items.clear();
    notifyListeners();
  }
}
