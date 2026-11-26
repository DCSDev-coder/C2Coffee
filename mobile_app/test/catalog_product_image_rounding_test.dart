import 'package:c2_coffee/widgets/catalog_product_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('rounds the fitted portrait image instead of its square box',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Center(
        child: SizedBox(
          width: 200,
          height: 200,
          child: CatalogProductImage(
            assetPath: 'assets/images/background.png',
            imageCornerRadius: 12,
          ),
        ),
      ),
    ));
    await tester.runAsync(() async {
      await precacheImage(
        const AssetImage('assets/images/background.png'),
        tester.element(find.byType(CatalogProductImage)),
      );
    });
    await tester.pumpAndSettle();

    final clip = tester.widget<ClipRRect>(find.byType(ClipRRect).first);
    final shape = clip.clipper!.getClip(const Size(200, 200));
    expect(shape.height, closeTo(200, 0.01));
    expect(shape.width, closeTo(200 * 402 / 873, 0.1));
    expect(shape.tlRadiusX, 12);
    expect(shape.left, greaterThan(0));
  });
}
