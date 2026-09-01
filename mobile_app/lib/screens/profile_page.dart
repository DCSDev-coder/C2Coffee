import 'dart:io';
import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../services/catalog_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../widgets/custom_bottom_nav.dart';
import '../services/app_session_service.dart';
import '../services/user_service.dart';
import 'home_page.dart';
import 'menu_page.dart';
import 'loading_order_page.dart';
import 'orders_page.dart';
import 'order_details_page.dart';
import 'top_up_wallet_page.dart';
import 'notification_page.dart';
import 'settings_page.dart';
import 'rewards_page.dart';
import 'my_rewards_page.dart';
import 'referral_page.dart';
import '../widgets/order_status_banner.dart';
import '../utils/app_colors.dart';
import '../widgets/app_page_shell.dart';

class ProfilePage extends StatefulWidget {
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;
  final bool initialScrollToCalendar;

  const ProfilePage({
    super.key,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
    this.initialScrollToCalendar = false,
  });

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final AppSessionService _session = AppSessionService.instance;
  final ScrollController _scrollController = ScrollController();
  final GlobalKey _calendarSectionKey = GlobalKey();
  Set<DateTime> _calendarOrderDates = {};
  Set<DateTime> _calendarEventDates = {};
  Map<DateTime, List<CustomerOrder>> _calendarOrdersByDate = {};
  Map<DateTime, List<String>> _calendarOrderTitlesByDate = {};
  Map<DateTime, List<String>> _calendarEventTitlesByDate = {};
  bool _calendarLoading = true;
  File? _persistedPickedImage;
  String? _persistedPresetPath;
  String _username = 'C2 Member';

  Color get orangeColor => AppColors.deepTeal;
  final Color bgColor = Colors.white;

  @override
  void initState() {
    super.initState();
    _session.addListener(_handleSessionChanged);
    _loadAvatarState();
    Future.microtask(() async {
      try {
        await _session.loadAuthenticatedState();
      } catch (_) {}
      await _loadCalendarMarkers();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.initialScrollToCalendar) {
        _scrollToCalendarSection();
      }
    });
  }

  void _handleSessionChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _loadAvatarState() async {
    final avatarData = await UserService.getAvatar();
    final profileData = await UserService.getUserProfile();
    final sessionProfile = _session.userProfileSnapshot;
    if (!mounted) return;
    setState(() {
      if (avatarData['pickedImagePath'] != null) {
        _persistedPickedImage = File(avatarData['pickedImagePath']!);
      } else {
        _persistedPickedImage = null;
      }
      _persistedPresetPath = avatarData['presetPath'];

      _username = sessionProfile['username']?.trim().isNotEmpty == true
          ? sessionProfile['username']!
          : ((profileData['username']?.isNotEmpty == true)
              ? profileData['username']!
              : 'C2 Member');
    });
  }

  @override
  void dispose() {
    _session.removeListener(_handleSessionChanged);
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToCalendarSection() {
    final calendarContext = _calendarSectionKey.currentContext;
    if (calendarContext == null) return;

    Scrollable.ensureVisible(
      calendarContext,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
      alignment: 0.08,
    );
  }

  DateTime _dateOnly(DateTime value) {
    return DateTime(value.year, value.month, value.day);
  }

  void _addCalendarTitle(
    Map<DateTime, List<String>> titlesByDate,
    DateTime date,
    String title,
  ) {
    final normalizedDate = _dateOnly(date);
    final normalizedTitle = title.trim();
    if (normalizedTitle.isEmpty) return;

    final titles = titlesByDate.putIfAbsent(normalizedDate, () => <String>[]);
    if (!titles.contains(normalizedTitle)) {
      titles.add(normalizedTitle);
    }
  }

  Map<DateTime, List<String>> _buildEventTitlesByDate() {
    final titlesByDate = <DateTime, List<String>>{};

    for (final banner in _session.homeBanners) {
      if (banner.bannerType != 'event' || banner.startsAt == null) {
        continue;
      }

      final start = _dateOnly(banner.startsAt!.toLocal());
      final end = _dateOnly((banner.endsAt ?? banner.startsAt!).toLocal());
      if (end.isBefore(start)) {
        continue;
      }

      final title = banner.title.trim();
      if (title.isEmpty) {
        continue;
      }

      var cursor = start;
      while (!cursor.isAfter(end)) {
        _addCalendarTitle(titlesByDate, cursor, title);
        cursor = cursor.add(const Duration(days: 1));
      }
    }

    return titlesByDate;
  }

  List<String> _orderTitlesForOrder(CustomerOrder order) {
    final primaryTitle = order.primaryItemName?.trim();
    if (primaryTitle != null && primaryTitle.isNotEmpty) {
      return [primaryTitle];
    }

    final itemTitles = order.items
        .map((item) => item.name.trim())
        .where((title) => title.isNotEmpty)
        .toList();
    if (itemTitles.isNotEmpty) {
      return itemTitles;
    }

    return ['Order ${order.dailyOrderNumber}'];
  }

  Future<void> _loadCalendarMarkers() async {
    if (!mounted) return;

    setState(() {
      _calendarLoading = true;
    });

    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();

      final orderDates = <DateTime>{};
      final ordersByDate = <DateTime, List<CustomerOrder>>{};
      final orderTitlesByDate = <DateTime, List<String>>{};
      if (accessToken != null && accessToken.isNotEmpty) {
        final snapshot = await CustomerDataService.instance.getOrders(
          accessToken: accessToken,
          limit: 100,
        );

        final allOrders = <CustomerOrder>[
          ...snapshot.orders,
          if (snapshot.activeOrder != null) snapshot.activeOrder!,
        ];

        for (final order in allOrders) {
          final orderDate = _dateOnly(order.createdAt.toLocal());
          orderDates.add(orderDate);
          ordersByDate.putIfAbsent(orderDate, () => <CustomerOrder>[]).add(order);
          for (final title in _orderTitlesForOrder(order)) {
            _addCalendarTitle(orderTitlesByDate, orderDate, title);
          }
        }
      }

      final eventTitlesByDate = _buildEventTitlesByDate();
      final eventDates = eventTitlesByDate.keys.toSet();

      if (!mounted) return;
      setState(() {
        _calendarOrderDates = orderDates;
        _calendarEventDates = eventDates;
        _calendarOrdersByDate = ordersByDate;
        _calendarOrderTitlesByDate = orderTitlesByDate;
        _calendarEventTitlesByDate = eventTitlesByDate;
        _calendarLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _calendarOrderDates = {};
        _calendarOrdersByDate = {};
        _calendarOrderTitlesByDate = {};
        _calendarEventTitlesByDate = _buildEventTitlesByDate();
        _calendarEventDates = _calendarEventTitlesByDate.keys.toSet();
        _calendarLoading = false;
      });
    }
  }

  void _onBottomNavTapped(int index) {
    if (index == 4) return;
    if (index == 0) {
      CustomBottomNav.switchTab(
        context,
        HomePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    } else if (index == 1) {
      CustomBottomNav.switchTab(context, const MenuPage());
    } else if (index == 2) {
      CustomBottomNav.switchTab(
        context,
        OrdersPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    } else if (index == 3) {
      CustomBottomNav.switchTab(
        context,
        RewardsPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    }
  }

  Widget _buildAvatar() {
    if (_persistedPickedImage != null) {
      return CircleAvatar(
        radius: 28,
        backgroundImage: kIsWeb
            ? NetworkImage(_persistedPickedImage!.path)
            : FileImage(_persistedPickedImage!) as ImageProvider,
        backgroundColor: Colors.transparent,
      );
    } else if (_persistedPresetPath != null) {
      return CircleAvatar(
        radius: 28,
        backgroundImage: AssetImage(_persistedPresetPath!),
        backgroundColor:
            AppColors.deepTeal, // Add the dark green background back
      );
    } else {
      return CircleAvatar(
        radius: 28,
        backgroundColor: orangeColor,
        child: const Icon(Icons.person, size: 36, color: Colors.white),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPageShell(
      title: 'PROFILE',
      onBack: () => InteractiveFillingLoader.showPop(context),
      backgroundColor: bgColor,
      extendBody: true,
      scrollController: _scrollController,
      bodyPadding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 20,
        bottom: 180 + MediaQuery.paddingOf(context).bottom,
      ),
      bottomNavigationBar: CustomBottomNav(
        selectedIndex: 4,
        onItemTapped: _onBottomNavTapped,
        scrollController: _scrollController,
      ),
      trailing: GestureDetector(
            onTap: () {
              InteractiveFillingLoader.show(
                context,
                targetPage: const NotificationPage(),
              );
            },
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_outlined,
                    color: Colors.white, size: 26),
                Positioned(
                  top: 1,
                  right: 1,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: AppColors.accent,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ),
          ),
      overlay: OrderStatusBanner(
        bottomOffset: 90 + MediaQuery.paddingOf(context).bottom,
      ),
      child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Profile Card
                GestureDetector(
                  onTap: () async {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => SettingsPage(
                          onProfileUpdated: _loadAvatarState,
                          returnPage: const ProfilePage(),
                        ),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: AppColors.border,
                        width: 1,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.03),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        )
                      ],
                    ),
                    child: Row(
                      children: [
                        _buildAvatar(),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Text(
                            'Hey $_username,',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Icon(
                          Icons.arrow_forward_ios,
                          size: 16,
                          color: AppColors.deepTeal.withValues(alpha: 0.5),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Dashboard Grid
                Column(
                  children: [
                    // Wallet Box
                    Container(
                      width: double.infinity,
                      clipBehavior: Clip.hardEdge,
                      decoration: BoxDecoration(
                        color: AppColors.deepTeal,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.deepTeal.withValues(alpha: 0.4),
                            blurRadius: 16,
                            offset: const Offset(0, 8),
                          )
                        ],
                      ),
                      child: Stack(
                        children: [
                          // Large background logo partially hidden
                          Positioned(
                            right: -10,
                            top: -10,
                            bottom: -10,
                            child: Opacity(
                              opacity: 0.5,
                              child: Image.asset(
                                'assets/images/c2_logo.png',
                                width: 150,
                                fit: BoxFit.contain,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          // Content
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Total Balance',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 16,
                                    color: Colors.white.withValues(alpha: 0.8),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      _session.tokenBalance.toStringAsFixed(2),
                                      style: const TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 36,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    const Padding(
                                      padding: EdgeInsets.only(bottom: 6),
                                      child: Text(
                                        'tokens',
                                        style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                GestureDetector(
                                  onTap: () {
                                    InteractiveFillingLoader.show(
                                      context,
                                      targetPage: const TopUpWalletPage(),
                                    );
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.add, color: Colors.white, size: 18),
                                        SizedBox(width: 8),
                                        Text(
                                          'Add Balance',
                                          style: TextStyle(
                                            fontFamily: 'Afacad',
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Rewards & Referrals
                    Row(
                      children: [
                        // My Reward
                        Expanded(
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: AppColors.border,
                                width: 1,
                              ),
                              boxShadow: [
                                BoxShadow(
                                    color: Colors.black
                                        .withValues(alpha: 0.03),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2))
                              ],
                            ),
                            child: Material(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(20),
                                onTap: () {
                                  InteractiveFillingLoader.show(
                                    context,
                                    targetPage: const MyRewardsPage(),
                                  );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 20, horizontal: 16),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.center,
                                    children: [
                                      Text('My Reward',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                              fontFamily: 'Recoleta',
                                              fontSize: 18,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.deepTeal)),
                                      const SizedBox(height: 16),
                                      Image.asset(
                                          'assets/images/Surprise reward gift box with star popping out.png',
                                          height: 95),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        // My Referrals
                        Expanded(
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: AppColors.border,
                                width: 1,
                              ),
                              boxShadow: [
                                BoxShadow(
                                    color: Colors.black
                                        .withValues(alpha: 0.03),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2))
                              ],
                            ),
                            child: Material(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(20),
                                onTap: () {
                                  InteractiveFillingLoader.show(
                                    context,
                                    targetPage: const ReferralPage(),
                                  );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 20, horizontal: 16),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.center,
                                    children: [
                                      Text('My Referrals',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                              fontFamily: 'Recoleta',
                                              fontSize: 18,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.deepTeal)),
                                      const SizedBox(height: 16),
                                      Image.asset(
                                          'assets/images/Community friends laughing together waving hands and giving thumbs.png',
                                          height: 95),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // News Section
                Text(
                  'News',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
                const SizedBox(height: 12),
                _buildNewsSection(),
                const SizedBox(height: 24),

                // Calendar Section
                Container(
                  key: _calendarSectionKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Calendar',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal)),
                      const SizedBox(height: 12),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 24.0),
                        child: CustomCalendarWidget(
                          orderDates: _calendarOrderDates,
                          eventDates: _calendarEventDates,
                          ordersByDate: _calendarOrdersByDate,
                          orderTitlesByDate: _calendarOrderTitlesByDate,
                          eventTitlesByDate: _calendarEventTitlesByDate,
                          isLoading: _calendarLoading,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Our Promise Section
                Text('Our Promise',
                    style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal)),
                const SizedBox(height: 12),
                const SizedBox(
                  height: 140, // Increased from 100
                  child: OurPromiseCarousel(),
                ),
              ],
      ),
    );
  }

  Widget _buildNewsSection() {
    final banners = _session.homeBanners
        .where((banner) => banner.appearsOnProfile)
        .toList();

    if (banners.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.border,
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Text(
          'News and promotions will appear here once marketing updates them.',
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 15,
            color: Colors.grey,
          ),
        ),
      );
    }

    return Column(
      children: [
        for (var i = 0; i < banners.length; i++) ...[
          _buildNewsCard(banners[i]),
          if (i < banners.length - 1) const SizedBox(height: 16),
        ],
      ],
    );
  }

  Widget _buildNewsCard(dynamic banner) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.border,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: _buildBannerImage(banner.imageSource),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  banner.title,
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  banner.subtitle,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 16,
                    color: Colors.grey,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBannerImage(String source) {
    final resolvedSource = resolveCatalogImageSource(source);
    final image = resolvedSource == null
        ? _buildBannerFallback()
        : (resolvedSource.startsWith('http://') ||
                resolvedSource.startsWith('https://'))
            ? Image.network(
                resolvedSource,
                width: 100,
                height: 100,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    _buildBannerFallback(),
              )
            : Image.asset(
                resolvedSource,
                width: 100,
                height: 100,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    _buildBannerFallback(),
              );

    return image;
  }

  Widget _buildBannerFallback() {
    return Container(
      width: 100,
      height: 100,
      color: const Color(0xFFF6F7F8),
      alignment: Alignment.center,
      child: Image.asset(
        'assets/images/c2_logo.png',
        width: 48,
        height: 48,
        fit: BoxFit.contain,
      ),
    );
  }
}

class CustomCalendarWidget extends StatefulWidget {
  final Set<DateTime> orderDates;
  final Set<DateTime> eventDates;
  final Map<DateTime, List<CustomerOrder>> ordersByDate;
  final Map<DateTime, List<String>> orderTitlesByDate;
  final Map<DateTime, List<String>> eventTitlesByDate;
  final bool isLoading;

  const CustomCalendarWidget({
    super.key,
    this.orderDates = const {},
    this.eventDates = const {},
    this.ordersByDate = const {},
    this.orderTitlesByDate = const {},
    this.eventTitlesByDate = const {},
    this.isLoading = false,
  });

  @override
  State<CustomCalendarWidget> createState() => _CustomCalendarWidgetState();
}

class _CustomCalendarWidgetState extends State<CustomCalendarWidget> {
  DateTime _currentMonth = DateTime.now();

  void _previousMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    });
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    });
  }

  bool _hasOrder(DateTime date) {
    return widget.orderDates.contains(DateTime(date.year, date.month, date.day));
  }

  bool _hasEvent(DateTime date) {
    return widget.eventDates.contains(DateTime(date.year, date.month, date.day));
  }

  List<CustomerOrder> _ordersForDate(DateTime date) {
    return widget.ordersByDate[DateTime(date.year, date.month, date.day)] ??
        const [];
  }

  void _openOrderForDate(BuildContext context, CustomerOrder order) {
    InteractiveFillingLoader.show(
      context,
      targetPage: OrderDetailsPage(order: order),
    );
  }

  @override
  Widget build(BuildContext context) {
    final int daysInMonth =
        DateUtils.getDaysInMonth(_currentMonth.year, _currentMonth.month);
    final int firstWeekday =
        DateTime(_currentMonth.year, _currentMonth.month, 1).weekday;

    // adjust for Monday=1, Sunday=7 in dart.
    // We want Monday to be the first column (index 0)
    final int emptySlots = firstWeekday - 1;

    final List<String> monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ];
    final List<String> dayNames = [
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
      "SUN"
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.border,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: widget.isLoading
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Center(
                child: CircularProgressIndicator(),
              ),
            )
          : Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: Icon(Icons.chevron_left, color: AppColors.deepTeal),
                      onPressed: _previousMonth,
                    ),
                    Text(
                      '${monthNames[_currentMonth.month - 1]} ${_currentMonth.year}',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.deepTeal,
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.chevron_right, color: AppColors.deepTeal),
                      onPressed: _nextMonth,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: dayNames
                      .map(
                        (day) => SizedBox(
                          width: 30,
                          child: Center(
                            child: Text(
                              day,
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Colors.grey,
                              ),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 12),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: daysInMonth + emptySlots,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    childAspectRatio: 1.0,
                  ),
                  itemBuilder: (context, index) {
                    if (index < emptySlots) return const SizedBox();

                    final int day = index - emptySlots + 1;
                    final DateTime date =
                        DateTime(_currentMonth.year, _currentMonth.month, day);
                    final bool hasOrder = _hasOrder(date);
                    final bool hasEvent = _hasEvent(date);

                    final Color orderColor = AppColors.deepTeal;
                    const Color eventColor = Color(0xFFE5A93C);
                    final bool showCombinedMarker = hasOrder && hasEvent;
                    final bool showOrderMarker = hasOrder || hasEvent;

                    return GestureDetector(
                      onTap: hasOrder
                          ? () {
                              final orders = _ordersForDate(date);
                              if (orders.isEmpty) return;
                              _openOrderForDate(context, orders.first);
                            }
                          : null,
                      onLongPress: (hasOrder || hasEvent)
                          ? () => _showDaySummary(context, date)
                          : null,
                      child: Container(
                        margin: const EdgeInsets.all(4),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            if (showOrderMarker)
                              Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: hasOrder
                                      ? orderColor.withValues(alpha: 0.14)
                                      : eventColor.withValues(alpha: 0.14),
                                  border: Border.all(
                                    color: hasOrder ? orderColor : eventColor,
                                    width: 1.8,
                                  ),
                                ),
                              ),
                            if (showCombinedMarker)
                              Container(
                                width: hasOrder ? 12 : 34,
                                height: hasOrder ? 12 : 34,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: eventColor,
                                  border: hasOrder
                                      ? Border.all(
                                          color: Colors.white,
                                          width: 1.5,
                                        )
                                      : Border.all(
                                        color: eventColor.withValues(alpha: 0.45),
                                        width: 1.5,
                                      ),
                                ),
                              ),
                            if (!showOrderMarker)
                              Container(
                                width: 34,
                                height: 34,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.transparent,
                                ),
                              ),
                            Text(
                              day.toString(),
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: hasOrder
                                    ? AppColors.deepTeal
                                    : hasEvent
                                        ? AppColors.deepTeal
                                        : Colors.black87,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
    );
  }

  void _showDaySummary(BuildContext context, DateTime date) {
    final orders = _ordersForDate(date);
    final eventTitles =
        widget.eventTitlesByDate[DateTime(date.year, date.month, date.day)] ??
            const [];

    if (orders.isEmpty && eventTitles.isEmpty) {
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 16,
            ),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 18,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Daily details',
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: AppColors.deepTeal,
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: () => Navigator.pop(sheetContext),
                            icon: const Icon(Icons.close),
                            color: Colors.grey,
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          color: Colors.grey.shade700,
                        ),
                      ),
                      if (orders.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        _buildSummarySection(
                          title: 'Orders',
                          icon: Icons.receipt_long_outlined,
                          color: AppColors.deepTeal,
                          titles: orders.map(_buildOrderTitle).toList(),
                          onTapTitle: (index) =>
                              _openOrderForDate(context, orders[index]),
                        ),
                      ],
                      if (eventTitles.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        _buildSummarySection(
                          title: 'Events',
                          icon: Icons.event_outlined,
                          color: const Color(0xFFE5A93C),
                          titles: eventTitles,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildSummarySection({
    required String title,
    required IconData icon,
    required Color color,
    required List<String> titles,
    void Function(int index)? onTapTitle,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (var index = 0; index < titles.length; index++) ...[
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: onTapTitle == null ? null : () => onTapTitle(index),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 7),
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        titles[index],
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          color: Colors.grey.shade900,
                          height: 1.25,
                        ),
                      ),
                    ),
                    if (onTapTitle != null)
                      Icon(
                        Icons.chevron_right,
                        size: 18,
                        color: color.withValues(alpha: 0.7),
                      ),
                  ],
                ),
              ),
            ),
          ],
          if (onTapTitle != null) ...[
            const SizedBox(height: 4),
            Text(
              'Tap an order to open details and reorder.',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 12,
                color: Colors.grey.shade700,
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _buildOrderTitle(CustomerOrder order) {
    final primaryTitle = order.primaryItemName?.trim();
    if (primaryTitle != null && primaryTitle.isNotEmpty) {
      return primaryTitle;
    }

    final itemTitle = order.items.isNotEmpty ? order.items.first.name.trim() : '';
    if (itemTitle.isNotEmpty) {
      return itemTitle;
    }

    return order.orderRef.isNotEmpty ? order.orderRef : 'Order ${order.id}';
  }
}

class OurPromiseCarousel extends StatefulWidget {
  const OurPromiseCarousel({super.key});

  @override
  State<OurPromiseCarousel> createState() => _OurPromiseCarouselState();
}

class _OurPromiseCarouselState extends State<OurPromiseCarousel> {
  final PageController _pageController =
      PageController(initialPage: 1, viewportFraction: 0.85);

  final List<String> _promises = [
    '100% certified muslim-made',
    'made with love',
    'playful sips, handcrafted joy',
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PageView.builder(
      controller: _pageController,
      itemCount: _promises.length,
      itemBuilder: (context, index) {
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.border,
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 6,
                  offset: const Offset(0, 2))
            ],
          ),
          child: Center(
            child: Text(
              _promises[index],
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 22, // increased from 16
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
          ),
        );
      },
    );
  }
}
