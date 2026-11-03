import 'counter_menu.dart';

List<Map<String, dynamic>> buildCounterCartModifiers({
  required CounterMenuItem item,
  required Map<String, dynamic> customization,
  String? orderType,
}) {
  final modifiers = <Map<String, dynamic>>[];
  final rawSelections = customization['librarySelections'];
  final selections = <int, List<int>>{};
  if (rawSelections is Map) {
    for (final entry in rawSelections.entries) {
      final groupId = entry.key is int
          ? entry.key as int
          : int.tryParse(entry.key.toString());
      if (groupId == null || entry.value is! List) continue;
      selections[groupId] = (entry.value as List)
          .map((value) => value is int ? value : int.tryParse(value.toString()))
          .whereType<int>()
          .toList();
    }
  }

  final selectedOptionIdSet = selections.values
      .expand((ids) => ids)
      .toSet();

  for (final group in item.modifierGroups) {
    if (group.hiddenWhenOptionIds.isNotEmpty) {
      if (group.hiddenWhenOptionIds.any(selectedOptionIdSet.contains)) {
        continue;
      }
      final parentGroupsWithRule = item.modifierGroups.where(
        (otherGroup) =>
            otherGroup.id != group.id &&
            otherGroup.options.any(
              (opt) => group.hiddenWhenOptionIds.contains(opt.id),
            ),
      );
      final missingParentSelection = parentGroupsWithRule.any(
        (parentGroup) => (selections[parentGroup.id] ?? const []).isEmpty,
      );
      if (missingParentSelection) {
        continue;
      }
    }
    var selectedOptionIds = selections[group.id] ?? const <int>[];
    if (_normalize(group.name) == 'order type' && orderType != null) {
      final selectedOrderType = group.options.where(
        (option) {
          final optNorm = _normalize(option.name);
          final orderNorm = _normalize(orderType);
          if (optNorm == orderNorm) return true;
          final isDineIn =
              orderNorm == 'dine in' ||
              orderNorm == 'self-pickup' ||
              orderNorm == 'self pickup';
          final isOptDineIn =
              optNorm == 'dine in' ||
              optNorm == 'self-pickup' ||
              optNorm == 'self pickup';
          return isDineIn && isOptDineIn;
        },
      );
      if (selectedOrderType.isNotEmpty) {
        selectedOptionIds = [selectedOrderType.first.id];
      }
    }
    for (final optionId in selectedOptionIds) {
      final matches = group.options.where((option) => option.id == optionId);
      if (matches.isEmpty) continue;
      final option = matches.first;
      modifiers.add(
        _modifier(
          group.name,
          option.name,
          double.tryParse(option.priceDeltaRm) ?? 0,
        ),
      );
    }
  }

  void addFallback(
    bool enabled,
    String keyword,
    String groupName,
    String customizationKey, {
    double Function(String value)? price,
  }) {
    if (!enabled || counterHasLibraryGroup(item, keyword)) return;
    final value = customization[customizationKey]?.toString().trim();
    if (value == null || value.isEmpty) return;
    modifiers.add(_modifier(groupName, value, price?.call(value) ?? 0));
  }

  addFallback(item.allowChoiceOfBeans, 'bean', 'Choice of Beans', 'bean');
  addFallback(
    item.allowEspressoShot,
    'espresso',
    'Espresso Shot',
    'espressoShots',
    price: (value) {
      final shots =
          int.tryParse(RegExp(r'\d+').firstMatch(value)?.group(0) ?? '') ?? 1;
      if (shots == 2) return 3;
      if (shots == 3) return 6;
      return 0;
    },
  );
  addFallback(
    item.allowTemperature,
    'temperature',
    'Choice of Temperature',
    'temperature',
  );
  addFallback(
    item.allowChoiceOfMilk,
    'milk',
    'Choice of Milk',
    'milk',
    price: (value) => _normalize(value) == 'oat milk' ? 3 : 0,
  );
  addFallback(
    item.allowChoiceOfSweetness,
    'sweet',
    'Choice of Sweetness',
    'sweetness',
  );
  final temperature = customization['temperature']?.toString();
  if (temperature == null || _normalize(temperature) == 'cold') {
    addFallback(item.allowIceLevel, 'ice', 'Ice Level', 'iceLevel');
  }

  return modifiers;
}

double counterCartModifierTotal(List<Map<String, dynamic>> modifiers) {
  return modifiers.fold<double>(
    0,
    (sum, modifier) =>
        sum + ((modifier['price_delta_rm'] as num?)?.toDouble() ?? 0),
  );
}

Map<String, dynamic> _modifier(
  String groupName,
  String optionName,
  double price,
) {
  return {
    'group_name': groupName,
    'option_name': optionName,
    'price_delta_rm': price,
    'token_price_delta': 0,
    'calorie_delta_kcal': 0,
  };
}

String _normalize(String value) => value.trim().toLowerCase();

bool counterHasLibraryGroup(CounterMenuItem item, String keyword) {
  final normalizedKeyword = _normalize(keyword);
  return item.modifierGroups.any((group) {
    if (group.options.isEmpty) return false;
    final words = _normalize(
      group.name,
    ).split(RegExp(r'[^a-z0-9]+')).where((word) => word.isNotEmpty);
    return words.any((word) => word.startsWith(normalizedKeyword));
  });
}
