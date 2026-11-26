import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';

import '../services/api_config.dart';
import '../services/catalog_api_service.dart';

/// Keeps the last successfully decoded artwork separately for each tier.
class TierArtwork extends StatefulWidget {
  const TierArtwork(
      {super.key, required this.tierCode, required this.imageUrl});

  final String? tierCode;
  final String? imageUrl;

  @override
  State<TierArtwork> createState() => _TierArtworkState();
}

class _TierArtworkState extends State<TierArtwork> {
  Uint8List? _bytes;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant TierArtwork oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tierCode != widget.tierCode ||
        oldWidget.imageUrl != widget.imageUrl) {
      if (oldWidget.tierCode != widget.tierCode) _bytes = null;
      _load();
    }
  }

  Future<bool> _isImage(Uint8List bytes) async {
    try {
      final codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      frame.image.dispose();
      codec.dispose();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _load() async {
    final generation = ++_generation;
    final code = widget.tierCode?.trim().toLowerCase() ?? '';
    if (code.isEmpty) return;
    final key = 'tier-artwork:${ApiConfig.baseUrl}:$code';
    final cache = DefaultCacheManager();
    try {
      final cached = await cache.getFileFromCache(key);
      if (cached != null) {
        final bytes = await cached.file.readAsBytes();
        if (await _isImage(bytes) && mounted && generation == _generation) {
          setState(() => _bytes = bytes);
        }
      }
    } catch (_) {
      // A missing or evicted cache entry is normal.
    }

    final url = widget.imageUrl?.trim();
    if (!isSecureRemoteImageSource(url)) return;
    try {
      final file = await cache.getSingleFile(url!);
      final bytes = await file.readAsBytes();
      if (!await _isImage(bytes) || !mounted || generation != _generation) {
        return;
      }
      setState(() => _bytes = bytes);
      await cache.putFile(key, bytes, key: key);
    } catch (_) {
      // Keep the previous image for this tier if the new one cannot load.
    }
  }

  @override
  Widget build(BuildContext context) {
    final bytes = _bytes;
    if (bytes != null) return Image.memory(bytes, fit: BoxFit.contain);
    return const Center(
      child: Icon(Icons.image_outlined, color: Colors.black26, size: 48),
    );
  }
}
