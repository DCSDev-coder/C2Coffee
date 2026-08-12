import 'package:flutter/material.dart';

class CatalogProductImage extends StatelessWidget {
  static const String _placeholderAsset = 'assets/images/c2_logo.png';
  static const int _cacheDimension = 640;

  final String? assetPath;
  final String? imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;

  const CatalogProductImage({
    super.key,
    this.assetPath,
    this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
  });

  bool get _hasRemoteImage =>
      imageUrl != null &&
      imageUrl!.isNotEmpty &&
      (imageUrl!.startsWith('http://') || imageUrl!.startsWith('https://'));

  bool get _hasAssetImage => assetPath != null && assetPath!.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    if (_hasRemoteImage) {
      final imageProvider = ResizeImage(
        NetworkImage(imageUrl!),
        width: _cacheDimension,
        height: _cacheDimension,
      );

      return Image(
        image: imageProvider,
        width: width,
        height: height,
        fit: fit,
        gaplessPlayback: true,
        filterQuality: FilterQuality.low,
        frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
          if (wasSynchronouslyLoaded || frame != null) {
            return child;
          }
          return _placeholder();
        },
        errorBuilder: (_, __, ___) => _placeholder(),
      );
    }

    if (_hasAssetImage) {
      return Image.asset(
        assetPath!,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => _placeholder(),
      );
    }

    return _placeholder();
  }

  Widget _placeholder() {
    return SizedBox(
      width: width,
      height: height,
      child: Center(
        child: Opacity(
          opacity: 0.24,
          child: Image.asset(
            _placeholderAsset,
            width: (width ?? 72) * 0.42,
            height: (height ?? 72) * 0.42,
            fit: BoxFit.contain,
          ),
        ),
      ),
    );
  }
}

Future<void> precacheCatalogProductImages(
  BuildContext context,
  Iterable<String?> imageUrls,
) async {
  final uniqueUrls = <String>{};
  for (final rawUrl in imageUrls) {
    final url = rawUrl?.trim();
    if (url == null || url.isEmpty) continue;
    if (!url.startsWith('http://') && !url.startsWith('https://')) continue;
    uniqueUrls.add(url);
  }

  if (uniqueUrls.isEmpty) return;

  await Future.wait(
    uniqueUrls.map(
      (url) => precacheImage(
        ResizeImage(
          NetworkImage(url),
          width: CatalogProductImage._cacheDimension,
          height: CatalogProductImage._cacheDimension,
        ),
        context,
      ),
    ),
  );
}
