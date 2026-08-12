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
    final isCandle =
        normalizedCategoryCode == 'candles' || _isCandleCategory(categoryName, item.name);
    final isFood = normalizedCategoryCode == 'food';

    return {
      'id': item.id,
      'code': item.code,
      'name': item.name,
      'price': 'RM ${item.basePriceRm}',
      'image': '',
      'image_url': item.imageUrl,
      'desc': item.description ?? '',
      'categoryCode': categoryCode,
      'category': categoryName,
      'isDrink': item.isHandcraftedDrink,
      'isFood': isFood,
      'isMerchandise': isMerchandise,
      'isCandle': isCandle,
      'isAvailable': item.isAvailable,
    };
  }

  static String sidebarLabel(String categoryName) {
    final words = categoryName.trim().split(RegExp(r'\s+'));
    if (words.length <= 1) return categoryName.toUpperCase();
    if (words.length == 2) {
      return '${words[0].toUpperCase()}\n${words[1].toUpperCase()}';
    }
    return '${words.take(2).join(' ').toUpperCase()}\n${words.skip(2).join(' ').toUpperCase()}';
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
