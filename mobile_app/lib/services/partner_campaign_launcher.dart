import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../utils/app_colors.dart';
import 'catalog_api_service.dart';

class PartnerCampaignLauncher {
  const PartnerCampaignLauncher._();

  static Future<bool> open(
    BuildContext context,
    HomeBanner banner,
  ) async {
    final value = banner.actionValue?.trim() ?? '';
    if (banner.actionType == 'none' || value.isEmpty) return false;

    final uri = banner.actionType == 'email'
        ? Uri(scheme: 'mailto', path: value, queryParameters: {
            'subject': 'C2 Coffee Partnership: ${banner.title}',
          })
        : Uri.tryParse(value);
    if (uri == null ||
        (banner.actionType == 'external_url' && uri.scheme != 'https')) {
      return false;
    }

    if (banner.actionType == 'external_url') {
      if (!context.mounted) return false;
      final confirmed = await showDialog<bool>(
        context: context,
        barrierDismissible: true,
        builder: (dialogContext) {
          final partnerDisplayName = banner.partnerName?.trim().isNotEmpty == true
              ? banner.partnerName!.trim()
              : banner.title.trim();
          final isSocial = banner.bannerType == 'social';

          return Dialog(
            backgroundColor: Colors.white,
            elevation: 10,
            shadowColor: Colors.black.withValues(alpha: 0.20),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Brand/Partner Icon Badge
                    Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.10),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.16),
                          width: 1.5,
                        ),
                      ),
                      child: Center(
                        child: Icon(
                          isSocial
                              ? Icons.share_rounded
                              : Icons.storefront_rounded,
                          size: 28,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Dialog Title
                    Text(
                      isSocial
                          ? 'Open external link?'
                          : (partnerDisplayName.isNotEmpty
                              ? 'Visit $partnerDisplayName'
                              : 'Visit partner website?'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 21,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Subtitle
                    const Text(
                      'You are leaving the C2 Coffee app to browse this partner website.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 15,
                        color: Colors.black54,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Verified Link Chip
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 9,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF6F8F7),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.14),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.lock_outline_rounded,
                            size: 14,
                            color: Color(0xFF2E7D32),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              uri.host,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            Icons.arrow_outward_rounded,
                            size: 13,
                            color: AppColors.primary.withValues(alpha: 0.65),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Action Buttons (Cancel & Continue)
                    Row(
                      children: [
                        Expanded(
                          child: SizedBox(
                            height: 46,
                            child: OutlinedButton(
                              onPressed: () => Navigator.pop(dialogContext, false),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF555555),
                                side: BorderSide(
                                  color: Colors.black.withValues(alpha: 0.15),
                                  width: 1,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(23),
                                ),
                              ),
                              child: const Text(
                                'Cancel',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: SizedBox(
                            height: 46,
                            child: FilledButton(
                              onPressed: () => Navigator.pop(dialogContext, true),
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(23),
                                ),
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'Continue',
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  SizedBox(width: 4),
                                  Icon(Icons.arrow_outward_rounded, size: 14),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
      if (confirmed != true) return false;
    }

    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
