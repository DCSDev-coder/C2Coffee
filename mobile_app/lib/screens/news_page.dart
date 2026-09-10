import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../services/catalog_api_service.dart';
import '../utils/app_colors.dart';
import '../widgets/catalog_product_image.dart';

class NewsPage extends StatefulWidget {
  final List<HomeBanner> banners;
  final int initialIndex;

  const NewsPage({
    super.key,
    required this.banners,
    required this.initialIndex,
  });

  @override
  State<NewsPage> createState() => _NewsPageState();
}

class _NewsPageState extends State<NewsPage> {
  late final PageController _controller;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex < 0
        ? 0
        : widget.initialIndex >= widget.banners.length
            ? widget.banners.length - 1
            : widget.initialIndex;
    _controller = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        automaticallyImplyLeading: false,
        leading: IconButton(
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text(
          'NEWS & OFFERS',
          style: TextStyle(
            fontFamily: 'Recoleta',
            fontWeight: FontWeight.w800,
            letterSpacing: 0.8,
          ),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
            child: Text(
              '${_currentIndex + 1} of ${widget.banners.length} offers · Swipe to browse',
              style: TextStyle(
                color: AppColors.textMuted,
                fontFamily: 'Afacad',
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: PageView.builder(
              controller: _controller,
              itemCount: widget.banners.length,
              onPageChanged: (index) => setState(() => _currentIndex = index),
              itemBuilder: (context, index) =>
                  _NewsDetail(banner: widget.banners[index]),
            ),
          ),
        ],
      ),
    );
  }
}

class _NewsDetail extends StatelessWidget {
  final HomeBanner banner;

  const _NewsDetail({required this.banner});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 48),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: AspectRatio(
              aspectRatio: 4 / 5,
              child: _PosterImage(source: banner.imageSource),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            banner.title,
            style: TextStyle(
              color: AppColors.brandText,
              fontFamily: 'Recoleta',
              fontSize: 30,
              fontWeight: FontWeight.w800,
              height: 1.05,
            ),
          ),
          if (banner.subtitle.trim().isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              banner.subtitle,
              style: TextStyle(
                color: AppColors.textMuted,
                fontFamily: 'Afacad',
                fontSize: 20,
                height: 1.38,
              ),
            ),
          ],
          if (banner.startsAt != null) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              decoration: BoxDecoration(
                color: AppColors.supportingSurface,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                _scheduleLabel(context, banner),
                style: TextStyle(
                  color: AppColors.supportingText,
                  fontFamily: 'Afacad',
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _scheduleLabel(BuildContext context, HomeBanner value) {
    final material = MaterialLocalizations.of(context);
    final start = material.formatMediumDate(value.startsAt!.toLocal());
    if (value.endsAt == null) return 'Available from $start';
    final end = material.formatMediumDate(value.endsAt!.toLocal());
    return '$start - $end';
  }
}

class _PosterImage extends StatelessWidget {
  final String source;

  const _PosterImage({required this.source});

  @override
  Widget build(BuildContext context) {
    final resolved = resolveCatalogImageSource(source);
    if (resolved == null) return const C2ImageSkeleton();
    if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
      return CachedNetworkImage(
        imageUrl: resolved,
        fit: BoxFit.cover,
        placeholder: (_, __) => const C2ImageSkeleton(),
        errorWidget: (_, __, ___) => const C2ImageSkeleton(),
      );
    }
    return Image.asset(resolved, fit: BoxFit.cover);
  }
}
