import 'package:flutter/material.dart';

class CatalogProductImage extends StatelessWidget {
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
      return Image.network(
        imageUrl!,
        width: width,
        height: height,
        fit: fit,
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
      child: const Center(
        child: Icon(
          Icons.image_outlined,
          size: 32,
          color: Colors.grey,
        ),
      ),
    );
  }
}
