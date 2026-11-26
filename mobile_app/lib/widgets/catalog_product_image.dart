import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../services/catalog_api_service.dart';

class CatalogProductImage extends StatelessWidget {
  static const String _placeholderAsset = 'assets/images/c2_logo.png';
  static const int _cacheDimension = 640;

  final String? assetPath;
  final String? imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final double? imageCornerRadius;

  const CatalogProductImage({
    super.key,
    this.assetPath,
    this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.imageCornerRadius,
  });

  bool get _hasRemoteImage => isSecureRemoteImageSource(imageUrl);

  bool get _hasAssetImage => assetPath != null && assetPath!.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    if (_hasRemoteImage) {
      return CachedNetworkImage(
        imageUrl: imageUrl!,
        width: width,
        height: height,
        fit: fit,
        imageBuilder: imageCornerRadius == null
            ? null
            : (_, provider) => _RoundedVisibleImage(
                  provider: provider,
                  width: width,
                  height: height,
                  fit: fit,
                  radius: imageCornerRadius!,
                ),
        // Do not force non-square artwork through a square cache decode.
        // A width cap preserves the source aspect ratio for banners and posters.
        memCacheWidth: _cacheDimension,
        maxWidthDiskCache: 1200,
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
      if (imageCornerRadius != null) {
        return _RoundedVisibleImage(
          provider: AssetImage(assetPath!),
          width: width,
          height: height,
          fit: fit,
          radius: imageCornerRadius!,
          errorBuilder: (_, __, ___) => _placeholder(),
        );
      }
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

class _RoundedVisibleImage extends StatefulWidget {
  const _RoundedVisibleImage({
    required this.provider,
    required this.width,
    required this.height,
    required this.fit,
    required this.radius,
    this.errorBuilder,
  });

  final ImageProvider provider;
  final double? width;
  final double? height;
  final BoxFit fit;
  final double radius;
  final ImageErrorWidgetBuilder? errorBuilder;

  @override
  State<_RoundedVisibleImage> createState() => _RoundedVisibleImageState();
}

class _RoundedVisibleImageState extends State<_RoundedVisibleImage> {
  ImageStream? _stream;
  Size? _imageSize;
  late final ImageStreamListener _listener = ImageStreamListener((info, _) {
    final size =
        Size(info.image.width.toDouble(), info.image.height.toDouble());
    if (mounted && size != _imageSize) setState(() => _imageSize = size);
  }, onError: (_, __) {});

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _resolve();
  }

  @override
  void didUpdateWidget(covariant _RoundedVisibleImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.provider != widget.provider) {
      _imageSize = null;
      _resolve();
    }
  }

  void _resolve() {
    final stream =
        widget.provider.resolve(createLocalImageConfiguration(context));
    if (_stream?.key == stream.key) return;
    _stream?.removeListener(_listener);
    _stream = stream;
    stream.addListener(_listener);
  }

  @override
  void dispose() {
    _stream?.removeListener(_listener);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      clipper: _VisibleImageClipper(_imageSize, widget.fit, widget.radius),
      child: Image(
        image: widget.provider,
        width: widget.width,
        height: widget.height,
        fit: widget.fit,
        errorBuilder: widget.errorBuilder,
      ),
    );
  }
}

class _VisibleImageClipper extends CustomClipper<RRect> {
  const _VisibleImageClipper(this.imageSize, this.fit, this.radius);
  final Size? imageSize;
  final BoxFit fit;
  final double radius;

  @override
  RRect getClip(Size size) {
    final source = imageSize;
    final destination = source == null || size.isEmpty
        ? size
        : applyBoxFit(fit, source, size).destination;
    final rect = Alignment.center.inscribe(destination, Offset.zero & size);
    return RRect.fromRectAndRadius(rect, Radius.circular(radius));
  }

  @override
  bool shouldReclip(_VisibleImageClipper oldClipper) =>
      imageSize != oldClipper.imageSize ||
      fit != oldClipper.fit ||
      radius != oldClipper.radius;
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
    if (!isSecureRemoteImageSource(url)) continue;
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
