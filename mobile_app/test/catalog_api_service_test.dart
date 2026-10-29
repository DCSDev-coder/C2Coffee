import 'package:c2_coffee/services/catalog_api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('catalog calories accept numeric database values and decimal strings',
      () {
    expect(readCatalogInt(42), 42);
    expect(readCatalogInt('42'), 42);
    expect(readCatalogInt('invalid'), 0);
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
}
