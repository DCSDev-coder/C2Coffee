import 'catalog_api_service.dart';

class CatalogPresentation {
  CatalogPresentation._();

  static Map<String, dynamic> toLegacyItem(
    CatalogMenuItem item,
    String categoryCode,
    String categoryName,
  ) {
    final normalizedCategoryCode = _normalize(categoryCode);
    final isMerchandise = normalizedCategoryCode == 'merchandise' ||
        _isMerchandiseCategory(categoryName, item.name);
    final isCandle = normalizedCategoryCode == 'candles' ||
        _isCandleCategory(categoryName, item.name);
    final isFood = normalizedCategoryCode == 'food';
    final startingOptions = _defaultActiveLibraryOptions(item);
    final startingPriceRm = (double.tryParse(item.basePriceRm) ?? 0) +
        startingOptions.fold<double>(
          0,
          (sum, option) => sum + (double.tryParse(option.priceDeltaRm) ?? 0),
        );
    final startingTokenPrice = item.basePriceToken +
        startingOptions.fold<int>(
          0,
          (sum, option) => sum + option.tokenPriceDelta,
        );

    return {
      'id': item.id,
      'code': item.code,
      'name': item.name,
      'price': 'RM ${item.basePriceRm}',
      'basePriceRm': item.basePriceRm,
      'tokenPrice': item.basePriceToken,
      'basePriceToken': item.basePriceToken,
      // The menu advertises the price a customer pays with the selections
      // preselected by the customization screen, not only the item base.
      'displayPriceRm': startingPriceRm.toStringAsFixed(2),
      'displayTokenPrice': startingTokenPrice,
      'baseCaloriesKcal': item.baseCaloriesKcal,
      'tokenPrices': item.tokenPrices,
      'image': '',
      'image_url': item.imageUrl,
      'desc': item.description ?? '',
      'categoryCode': categoryCode,
      'category': categoryName,
      'subcategoryCode': item.subcategoryCode,
      'subcategory': item.subcategoryName,
      'productKindCode': item.productKindCode,
      'productKind': item.productKindName,
      'isDrink': item.isHandcraftedDrink,
      'isFood': isFood,
      'isMerchandise': isMerchandise,
      'isCandle': isCandle,
      'isAvailable': item.isAvailable,
      'allowChoiceOfBeans': item.allowChoiceOfBeans,
      'allowEspressoShot': item.allowEspressoShot,
      'allowChoiceOfMilk': item.allowChoiceOfMilk,
      'allowChoiceOfSweetness': item.allowChoiceOfSweetness,
      'allowIceLevel': item.allowIceLevel,
      'allowTemperature': item.allowTemperature,
      'allowSparklingMixer': item.allowSparklingMixer,
      'allowOrderType': item.allowOrderType,
      'allowRemarks': item.allowRemarks,
      'modifierGroups': item.modifierGroups
          .map((group) => {
                'id': group.id,
                'code': group.code,
                'name': group.name,
                'selectionType': group.selectionType,
                'minSelect': group.minSelect,
                'maxSelect': group.maxSelect,
                'isRequired': group.isRequired,
                'sortOrder': group.sortOrder,
                'source': group.source,
                'hiddenWhenOptionIds': group.hiddenWhenOptionIds,
                'options': group.options
                    .map((option) => {
                          'id': option.id,
                          'code': option.code,
                          'name': option.name,
                          'priceDeltaRm': option.priceDeltaRm,
                          'tokenPriceDelta': option.tokenPriceDelta,
                          'calorieDeltaKcal': option.calorieDeltaKcal,
                          'imageUrl': option.imageUrl,
                          'colorHex': option.colorHex,
                          'gradientEndHex': option.gradientEndHex,
                          'gradientDirection': option.gradientDirection,
                          'isActive': option.isActive,
                          'isDefault': option.isDefault,
                          'sortOrder': option.sortOrder,
                        })
                    .toList(),
              })
          .toList(),
    };
  }

  static List<CatalogModifierOption> _defaultActiveLibraryOptions(
    CatalogMenuItem item,
  ) {
    final groups = item.modifierGroups
        .where((group) => group.source == 'library')
        .toList();
    final selections = <int, List<CatalogModifierOption>>{};

    for (final group in groups) {
      final selected = group.options.where((option) => option.isDefault).toList();
      final requiredMinimum = group.isRequired
          ? (group.minSelect > 0 ? group.minSelect : 1)
          : group.minSelect;
      if (selected.length < requiredMinimum) {
        selected.addAll(group.options
            .where((option) => !selected.contains(option))
            .take(requiredMinimum - selected.length));
      }
      selections[group.id] = selected.take(group.maxSelect).toList();
    }

    final selectedOptionIds =
        selections.values.expand((options) => options).map((option) => option.id).toSet();
    final temperatureGroups = groups
        .where((group) => group.name.toLowerCase().contains('temperature'))
        .toList();
    final hasTemperatureSelection = temperatureGroups.any(
      (group) => selections.containsKey(group.id),
    );
    final isCold = temperatureGroups.any(
      (group) => selections[group.id]
              ?.any((option) => option.name.trim().toLowerCase() == 'cold') ??
          false,
    );

    return groups
        .where((group) {
          if (group.hiddenWhenOptionIds.isNotEmpty) {
            return !group.hiddenWhenOptionIds.any(selectedOptionIds.contains);
          }
          final isIceGroup =
              RegExp(r'\bice\b', caseSensitive: false).hasMatch(group.name);
          return !isIceGroup || !hasTemperatureSelection || isCold;
        })
        .expand<CatalogModifierOption>(
          (group) => selections[group.id] ?? const <CatalogModifierOption>[],
        )
        .toList();
  }

  static String sidebarLabel(String categoryName) {
    final displayName = displayCategoryName(categoryName);
    final words = displayName.trim().split(RegExp(r'\s+'));
    if (words.length <= 1) return displayName.toUpperCase();
    if (words.length == 2) {
      return '${words[0].toUpperCase()}\n${words[1].toUpperCase()}';
    }
    return '${words.take(2).join(' ').toUpperCase()}\n${words.skip(2).join(' ').toUpperCase()}';
  }

  static String displayCategoryName(String categoryName) {
    return categoryName;
  }

  static bool isDrinkCategory(String categoryName, CatalogMenuItem item) {
    return item.isHandcraftedDrink &&
        !_isMerchandiseCategory(categoryName, item.name) &&
        !_isCandleCategory(categoryName, item.name);
  }

  static bool isLifestyleCategory(String categoryName, CatalogMenuItem item) {
    return _isMerchandiseCategory(categoryName, item.name) ||
        _isCandleCategory(categoryName, item.name);
  }

  static bool _isMerchandiseCategory(String categoryName, String itemName) {
    final value = '${categoryName.toLowerCase()} ${itemName.toLowerCase()}';
    return value.contains('merch') || value.contains('cup');
  }

  static bool _isCandleCategory(String categoryName, String itemName) {
    final value = '${categoryName.toLowerCase()} ${itemName.toLowerCase()}';
    return value.contains('candle');
  }

  static String _normalize(String value) =>
      value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();
}
