class CounterModifierOption {
  final int id;
  final String code;
  final String name;
  final String priceDeltaRm;
  final bool isDefault;

  const CounterModifierOption({
    required this.id,
    required this.code,
    required this.name,
    required this.priceDeltaRm,
    required this.isDefault,
  });

  factory CounterModifierOption.fromApi(Map<String, dynamic> json) {
    return CounterModifierOption(
      id: (json['id'] as num).toInt(),
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      priceDeltaRm: json['price_delta_rm'] as String? ?? '0.00',
      isDefault: json['is_default'] as bool? ?? false,
    );
  }
}

class CounterModifierGroup {
  final int id;
  final String code;
  final String name;
  final String selectionType;
  final int minSelect;
  final int maxSelect;
  final bool isRequired;
  final List<CounterModifierOption> options;

  const CounterModifierGroup({
    required this.id,
    required this.code,
    required this.name,
    required this.selectionType,
    required this.minSelect,
    required this.maxSelect,
    required this.isRequired,
    required this.options,
  });

  factory CounterModifierGroup.fromApi(Map<String, dynamic> json) {
    final options = (json['options'] as List? ?? const [])
        .map(
          (option) => CounterModifierOption.fromApi(
            Map<String, dynamic>.from(option as Map),
          ),
        )
        .toList();

    return CounterModifierGroup(
      id: (json['id'] as num).toInt(),
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      selectionType: json['selection_type'] as String? ?? 'single',
      minSelect: (json['min_select'] as num?)?.toInt() ?? 0,
      maxSelect: (json['max_select'] as num?)?.toInt() ?? 1,
      isRequired: json['is_required'] as bool? ?? false,
      options: options,
    );
  }
}

class CounterMenuItem {
  final String id;
  final String name;
  final double priceRm;
  final String? imageUrl;
  final bool isAvailable;
  final String? categoryName;
  final bool isHandcraftedDrink;
  final bool allowChoiceOfBeans;
  final bool allowEspressoShot;
  final bool allowChoiceOfMilk;
  final bool allowChoiceOfSweetness;
  final bool allowIceLevel;
  final bool allowTemperature;
  final List<CounterModifierGroup> modifierGroups;
  final Map<String, dynamic> source;

  const CounterMenuItem({
    required this.id,
    required this.name,
    required this.priceRm,
    required this.imageUrl,
    required this.isAvailable,
    this.categoryName,
    this.isHandcraftedDrink = false,
    this.allowChoiceOfBeans = false,
    this.allowEspressoShot = false,
    this.allowChoiceOfMilk = false,
    this.allowChoiceOfSweetness = false,
    this.allowIceLevel = false,
    this.allowTemperature = false,
    this.modifierGroups = const [],
    required this.source,
  });

  factory CounterMenuItem.fromApi(
    Map<String, dynamic> json, {
    String? categoryName,
  }) {
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
      categoryName:
          categoryName ??
          json['product_kind_name']?.toString() ??
          json['subcategory_name']?.toString(),
      isHandcraftedDrink: json['is_handcrafted_drink'] as bool? ?? false,
      allowChoiceOfBeans: json['allow_choice_of_beans'] as bool? ?? false,
      allowEspressoShot: json['allow_espresso_shot'] as bool? ?? false,
      allowChoiceOfMilk: json['allow_choice_of_milk'] as bool? ?? false,
      allowChoiceOfSweetness:
          json['allow_choice_of_sweetness'] as bool? ?? false,
      allowIceLevel: json['allow_ice_level'] as bool? ?? false,
      allowTemperature: json['allow_temperature'] as bool? ?? false,
      modifierGroups: (json['modifier_groups'] as List? ?? const [])
          .map(
            (group) => CounterModifierGroup.fromApi(
              Map<String, dynamic>.from(group as Map),
            ),
          )
          .toList(),
      source: Map<String, dynamic>.from(json),
    );
  }
}

List<CounterMenuItem> parseCounterMenu(Object? decoded) {
  final parsed = <CounterMenuItem>[];
  if (decoded is List) {
    for (final rawItem in decoded) {
      if (rawItem is! Map) continue;
      try {
        final item = CounterMenuItem.fromApi(
          Map<String, dynamic>.from(rawItem),
        );
        if (item.isAvailable) parsed.add(item);
      } on FormatException {
        // Ignore malformed products while keeping the remaining menu usable.
      }
    }
  } else if (decoded is Map) {
    final root = Map<String, dynamic>.from(decoded);
    if (root['items'] is List) {
      for (final rawItem in root['items'] as List) {
        if (rawItem is! Map) continue;
        try {
          final item = CounterMenuItem.fromApi(
            Map<String, dynamic>.from(rawItem),
          );
          if (item.isAvailable) parsed.add(item);
        } on FormatException {
          // Ignore malformed products while keeping the remaining menu usable.
        }
      }
    }
    if (root['categories'] is List) {
      for (final rawCategory in root['categories'] as List) {
        if (rawCategory is! Map) continue;
        final categoryName = rawCategory['name']?.toString();
        final items = rawCategory['items'];
        if (items is List) {
          for (final rawItem in items) {
            if (rawItem is! Map) continue;
            try {
              final item = CounterMenuItem.fromApi(
                Map<String, dynamic>.from(rawItem),
                categoryName: categoryName,
              );
              if (item.isAvailable) parsed.add(item);
            } on FormatException {
              // Ignore malformed products while keeping the remaining menu usable.
            }
          }
        }
      }
    }
  }

  return parsed;
}
