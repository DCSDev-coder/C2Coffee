import 'package:c2_coffee/services/catalog_api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('catalog calories accept numeric database values and decimal strings',
      () {
    expect(readCatalogInt(42), 42);
    expect(readCatalogInt('42'), 42);
    expect(readCatalogInt('invalid'), 0);
  });

  test('catalog image sources only allow HTTPS remote URLs', () {
    expect(
        isSecureRemoteImageSource('https://cdn.example.com/item.webp'), isTrue);
    expect(
        isSecureRemoteImageSource('http://cdn.example.com/item.webp'), isFalse);
    expect(isSecureRemoteImageSource('https://user:pass@cdn.example.com/a'),
        isFalse);
    expect(
        resolveCatalogImageSource('http://cdn.example.com/item.webp'), isNull);
  });

  test('home banners preserve independent display orders from the API', () {
    final banner = HomeBanner.fromApi({
      'id': 7,
      'code': 'campaign',
      'title': 'Campaign',
      'subtitle': '',
      'image_source': '/campaign.webp',
      'sort_order': 90,
      'home_sort_order': 10,
      'floating_sort_order': 30,
      'partnership_sort_order': 20,
    });

    expect(banner.sortOrder, 90);
    expect(banner.homeSortOrder, 10);
    expect(banner.floatingSortOrder, 30);
    expect(banner.partnershipSortOrder, 20);
  });

  test('partner banner resolves a targeted category with visible items', () {
    final banner = HomeBanner.fromApi({
      'id': 8,
      'code': '5luxe-campaign',
      'title': '5Luxe',
      'subtitle': 'Partner products',
      'image_source': '/5luxe.webp',
      'banner_type': 'partner',
      'destination_type': 'menu',
      'target_value': '5luxe',
    });
    final category = MenuCategoryGroup.fromApi({
      'id': 3,
      'code': '5Luxe',
      'name': '5Luxe Scents Co.',
      'items': [
        {
          'id': 21,
          'code': 'amber-jar',
          'name': 'Amber Jar Candle',
          'is_available': true,
          'availability_status': 'available',
        },
      ],
    });

    expect(banner.partnerMenuCategoryCode, '5luxe');
    expect(banner.resolvePartnerMenuCategory([category]), same(category));
  });

  test('partner banner falls back when its category has no visible items', () {
    final banner = HomeBanner.fromApi({
      'id': 9,
      'code': 'empty-partner',
      'title': 'Partner',
      'subtitle': 'Visit partner',
      'image_source': '/partner.webp',
      'banner_type': 'partner',
      'destination_type': 'menu',
      'target_value': 'partner-products',
    });
    final category = MenuCategoryGroup.fromApi({
      'id': 4,
      'code': 'partner-products',
      'name': 'Partner Products',
      'items': [
        {
          'id': 22,
          'code': 'coming-soon',
          'name': 'Coming Soon',
          'is_available': true,
          'availability_status': 'coming_soon',
        },
      ],
    });

    expect(banner.resolvePartnerMenuCategory([category]), isNull);
  });
}
