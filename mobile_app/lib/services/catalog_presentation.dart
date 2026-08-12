import 'catalog_api_service.dart';

class CatalogPresentation {
  CatalogPresentation._();

  static Map<String, dynamic> toLegacyItem(
    CatalogMenuItem item,
    String categoryName,
  ) {
    final assetPath = _assetByNormalizedName[_normalize(item.name)];
    final isMerchandise = _isMerchandiseCategory(categoryName, item.name);
    final isCandle = _isCandleCategory(categoryName, item.name);

    return {
      'id': item.id,
      'code': item.code,
      'name': item.name,
      'price': 'RM ${item.basePriceRm}',
      'image': assetPath ?? '',
      'image_url': item.imageUrl,
      'desc': item.description ?? '',
      'category': categoryName,
      'isDrink': item.isHandcraftedDrink || (!isMerchandise && !isCandle),
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

  static const Map<String, String> _assetByNormalizedName = {
    'mont broga': 'assets/images/drinks/MONT BROGA.png',
    'shakerato bianco': 'assets/images/drinks/SHAKERATO BIANCO.png',
    'yuzukano': 'assets/images/drinks/YUZUKANO.png',
    'senja di broga': 'assets/images/drinks/SENJA DI BROGA.png',
    'espresso bomb': 'assets/images/drinks/ESPRESSO BOMB.png',
    'v60 brew': 'assets/images/drinks/V60 BREW.png',
    'boijito': 'assets/images/drinks/BOIJITO.png',
    'bloody peach': 'assets/images/drinks/BLOODY PEACH.png',
    'fuji fizz': 'assets/images/drinks/FUJI FIZZ.png',
    'spicy mimosa': 'assets/images/drinks/SPICY MIMOSA.png',
    'onde2pop': 'assets/images/drinks/ONDE-ONDE SODA.png',
    'matcha latte': 'assets/images/drinks/MATCHA LATTE.png',
    'monkey matcha': 'assets/images/drinks/MONKEY MATCHA.png',
    'pinky promise matcha': 'assets/images/drinks/PINKY PROMISE MATCHA.png',
    'milk chocolate': 'assets/images/drinks/MILK CHOCOLATE.png',
    'nutty chocolate': 'assets/images/drinks/NUTTY CHOCOLATE.png',
    'espresso': 'assets/images/drinks/ESPRESSO.png',
    'pocco locco': 'assets/images/drinks/POCCO LOCCO.png',
    'latte': 'assets/images/drinks/LATTE.png',
    'flat white': 'assets/images/drinks/FLAT WHITE.png',
    'cappuccino': 'assets/images/drinks/CAPPUCCINO.png',
    'butterscotch latte': 'assets/images/drinks/BUTTERSCOTH LATTE.png',
    'hazelnut latte': 'assets/images/drinks/HAZELNUT LATTE.png',
    'vanilla latte': 'assets/images/drinks/VANILLA LATTE.png',
    'blue cloud coconut coffee':
        'assets/images/drinks/BLUE CLOUD COCONUT COFFEE.png',
    'mocha': 'assets/images/drinks/MOCHA.png',
    'lamb curry puff': 'assets/images/pastries/curry puff.png',
    'c2 cup cream': 'assets/images/merchandies/cream.png',
    'c2 cup dark blue': 'assets/images/merchandies/dark blue.png',
    'c2 cup green': 'assets/images/merchandies/green.png',
    'c2 cup light purple': 'assets/images/merchandies/light purple.png',
    'c2 cup light blue': 'assets/images/merchandies/light blue.png',
    'gunung candle': 'assets/images/candles/gunung.png',
    'crushed lime seasalt':
        'assets/images/candles/crushed lime and seasalt.png',
    'crushed lime seasalt candle':
        'assets/images/candles/crushed lime and seasalt.png',
    'fresh sage driftwood':
        'assets/images/candles/fresh sage and driftwood.png',
    'fresh sage driftwood candle':
        'assets/images/candles/fresh sage and driftwood.png',
    'tobacco vanilla': 'assets/images/candles/tobacco vanilla.png',
  };
}
