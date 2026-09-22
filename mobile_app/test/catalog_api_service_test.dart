import 'package:c2_coffee/services/catalog_api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('catalog calories accept numeric database values and decimal strings', () {
    expect(readCatalogInt(42), 42);
    expect(readCatalogInt('42'), 42);
    expect(readCatalogInt('invalid'), 0);
  });
}
