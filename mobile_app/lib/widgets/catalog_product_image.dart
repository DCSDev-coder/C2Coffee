import 'package:cached_network_image/cached_network_image.dart';
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
      return CachedNetworkImage(
        imageUrl: imageUrl!,
        width: width,
        height: height,
        fit: fit,
        memCacheWidth: _cacheDimension,
        memCacheHeight: _cacheDimension,
        maxWidthDiskCache: 1200,
        maxHeightDiskCache: 1200,
        fadeInDuration: const Duration(milliseconds: 120),
        filterQuality: FilterQuality.low,
        placeholder: (_, __) => C2ImageSkeleton(
          width: width,
          height: height,
          borderRadius: BorderRadius.circular(14),
        ),
        errorWidget: (_, __, ___) => _placeholder(),
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

class C2ImageSkeleton extends StatefulWidget {
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  const C2ImageSkeleton({
    super.key,
    this.width,
    this.height,
    this.borderRadius,
  });

  @override
  State<C2ImageSkeleton> createState() => _C2ImageSkeletonState();
}

class _C2ImageSkeletonState extends State<C2ImageSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: ClipRRect(
        borderRadius: widget.borderRadius ?? BorderRadius.circular(14),
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final position = -1.5 + (_controller.value * 3);
            return DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment(position - 1, 0),
                  end: Alignment(position + 1, 0),
                  colors: const [
                    Color(0xFFEAF1EF),
                    Color(0xFFF8FBFA),
                    Color(0xFFEAF1EF),
                  ],
                ),
              ),
              child: const SizedBox.expand(),
            );
          },
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
        CachedNetworkImageProvider(
          url,
          maxWidth: CatalogProductImage._cacheDimension,
          maxHeight: CatalogProductImage._cacheDimension,
        ),
        context,
      ),
    ),
  );
}
