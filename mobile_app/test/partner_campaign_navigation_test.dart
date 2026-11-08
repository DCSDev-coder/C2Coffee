import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('home partnership tap preserves campaign context in the menu', () {
    final homeSource = File('lib/screens/home_page.dart').readAsStringSync();
    final bannerHandler = homeSource.substring(
      homeSource.indexOf('void _handleBannerTap(HomeBanner banner)'),
      homeSource.indexOf('Future<void> _recordPartnerEngagement'),
    );

    expect(bannerHandler, contains("banner.bannerType == 'partner'"));
    expect(bannerHandler, contains('_openPartnerOrMenu(banner)'));
    expect(
      homeSource,
      contains(
        'final category = banner.resolvePartnerMenuCategory('
        '_session.menuCategories);',
      ),
    );
    expect(homeSource, contains('initialCategoryCode: category.code'));
    expect(homeSource, contains('partnerBanner: banner'));
  });

  test('Visit Us is rendered beside the main category title', () {
    final menuSource = File('lib/screens/menu_page.dart').readAsStringSync();
    final sectionBuilder = menuSource.substring(
      menuSource.indexOf('Widget _buildSection('),
      menuSource.indexOf(
          'GridView.builder(', menuSource.indexOf('Widget _buildSection(')),
    );

    final titlePosition = sectionBuilder.indexOf('Expanded(');
    final visitButtonPosition =
        sectionBuilder.indexOf('if (showsPartnerVisit)');
    expect(sectionBuilder, contains('child: Row('));
    expect(titlePosition, greaterThanOrEqualTo(0));
    expect(visitButtonPosition, greaterThan(titlePosition));
    expect(sectionBuilder, contains("label: const Text('Visit Us')"));
    expect(menuSource, contains('_partnerBannerForSection(section)'));
    expect(menuSource, contains('_session.homeBanners'));
  });

  test('partnership cards show one title without sponsorship clutter', () {
    final homeSource = File('lib/screens/home_page.dart').readAsStringSync();
    final homeSection = homeSource.substring(
      homeSource.indexOf('Widget _buildPartnerSpotlightSection'),
      homeSource.indexOf('Widget _buildProductSection'),
    );
    final profileSource =
        File('lib/screens/profile_page.dart').readAsStringSync();
    final profileSection = profileSource.substring(
      profileSource.indexOf('Widget _buildPartnerSpotlightSection'),
      profileSource.indexOf('Future<void> _recordPartnerEngagement'),
    );

    expect(homeSection, isNot(contains('SPONSORED')));
    expect(homeSection, isNot(contains('banner.partnerName')));
    expect(profileSection, isNot(contains('SPONSORED')));
    expect(profileSection, isNot(contains('banner.partnerName')));
  });

  test('customer cannot manually resend an order receipt', () {
    final statusSource =
        File('lib/screens/order_status_detail_page.dart').readAsStringSync();
    final checkoutSource =
        File('lib/services/checkout_api_service.dart').readAsStringSync();
    expect(statusSource, isNot(contains('EMAIL RECEIPT')));
    expect(statusSource, isNot(contains('emailOrderReceipt')));
    expect(statusSource, isNot(contains('_isEmailingReceipt')));
    expect(checkoutSource, isNot(contains('receipt-email')));
    expect(checkoutSource, isNot(contains('emailOrderReceipt')));
  });
}
