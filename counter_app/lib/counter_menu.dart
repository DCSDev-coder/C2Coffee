class CounterMenuItem {
  final String id;
  final String name;
  final double priceRm;
  final String? imageUrl;
  final bool isAvailable;
  final Map<String, dynamic> source;

  const CounterMenuItem({
    required this.id,
    required this.name,
    required this.priceRm,
    required this.imageUrl,
    required this.isAvailable,
    required this.source,
  });

  factory CounterMenuItem.fromApi(Map<String, dynamic> json) {
    final id = json['id'];
    final rawPrice = json['base_price_rm'] ?? json['price'];
    final price = rawPrice is num
        ? rawPrice.toDouble()
        : double.tryParse(rawPrice?.toString() ?? '');
    if (id == null || id.toString().isEmpty || price == null) {
      throw const FormatException('Menu item is missing its ID or RM price.');
    }

    return CounterMenuItem(
      id: id.toString(),
      name: json['name']?.toString().trim().isNotEmpty == true
          ? json['name'].toString().trim()
          : 'Unknown item',
      priceRm: price,
      imageUrl: json['image_url']?.toString().trim().isNotEmpty == true
          ? json['image_url'].toString().trim()
          : null,
      isAvailable: json['is_available'] != false,
      source: Map<String, dynamic>.from(json),
    );
  }
}

List<CounterMenuItem> parseCounterMenu(Object? decoded) {
  final rawItems = <Object?>[];
  if (decoded is List) {
    rawItems.addAll(decoded);
  } else if (decoded is Map) {
    final root = Map<String, dynamic>.from(decoded);
    if (root['items'] is List) rawItems.addAll(root['items'] as List);
    if (root['categories'] is List) {
      for (final rawCategory in root['categories'] as List) {
        if (rawCategory is! Map) continue;
        final items = rawCategory['items'];
        if (items is List) rawItems.addAll(items);
      }
    }
  }

  final parsed = <CounterMenuItem>[];
  for (final rawItem in rawItems) {
    if (rawItem is! Map) continue;
    try {
      final item = CounterMenuItem.fromApi(Map<String, dynamic>.from(rawItem));
      if (item.isAvailable) parsed.add(item);
    } on FormatException {
      // A malformed row must not hide the rest of the outlet's valid menu.
    }
  }
  return parsed;
}
