import 'dart:async';
import 'package:counter_app/widgets/top_notice.dart';
import 'package:flutter/material.dart';
import 'current_order_page.dart';
import 'order_history_page.dart';
import 'menu_availability_page.dart';
import 'marketing_drink_page.dart';
import 'inventory_page.dart';

import 'settings_page.dart';
import 'side_work_page.dart';
import 'timetable_page.dart';
import '../services/api_service.dart';
import '../order_queue_partition.dart';
import '../order_alert_timing.dart';
import '../services/push_notification_service.dart';
import '../services/barista_sound_service.dart';
import '../widgets/blinking_online_indicator.dart';
import '../widgets/order_card.dart';
import '../main.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key, required this.onSignedOut});

  final VoidCallback onSignedOut;

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  // Start on Current Orders (index 0)
  int _currentIndex = 0;
  late final PageController _pageController;
  Timer? _refreshTimer;
  bool _isRefreshingOrders = false;
  bool _isRefreshingAccess = false;
  bool _isRefreshingSideWork = false;
  bool _showHeaderMenu = false;
  bool _hasLoadedSideWork = false;
  final Set<int> _knownSideWorkTaskIds = <int>{};
  final Set<int> _alertedSideWorkTaskIds = <int>{};
  final Set<String> _alertedOrderEvents = <String>{};

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
    PushNotificationService.instance.setNewOrderHandler(_handleNewOrderPush);
    _loadInitialOrders();
    _refreshShiftAccess();
    // Keep the queue current without relying on a manual refresh.
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _loadInitialOrders();
      _refreshShiftAccess();
    });
  }

  Future<void> _refreshShiftAccess() async {
    if (_isRefreshingAccess) return;
    _isRefreshingAccess = true;
    try {
      final access = await ApiService.fetchWorkstationAccessState();
      globalWorkstationAccess.value = access;
      BaristaSoundService.instance.configure(access.soundSettings);
      await _refreshSideWorkAlerts();
    } catch (error) {
      debugPrint('Failed to refresh shift access: $error');
    } finally {
      _isRefreshingAccess = false;
    }
  }

  Future<void> _refreshSideWorkAlerts() async {
    if (_isRefreshingSideWork) return;
    _isRefreshingSideWork = true;
    try {
      final tasks = await ApiService.fetchSideWork();
      final incomingTasks = _hasLoadedSideWork
          ? tasks.where(
              (task) =>
                  !_knownSideWorkTaskIds.contains(task.id) && !task.isCompleted,
            )
          : const <BaristaSideWorkTask>[];
      if (incomingTasks.isNotEmpty) {
        globalSideWorkAttention.value = true;
      }
      _knownSideWorkTaskIds
        ..clear()
        ..addAll(tasks.map((task) => task.id));
      _hasLoadedSideWork = true;
      final newlyDue = tasks
          .where(
            (task) =>
                task.isDue &&
                !task.isCompleted &&
                !_alertedSideWorkTaskIds.contains(task.id),
          )
          .toList();
      _alertedSideWorkTaskIds.addAll(newlyDue.map((task) => task.id));
      if (newlyDue.isNotEmpty) {
        await BaristaSoundService.instance.play(BaristaSoundEvent.sideWork);
        if (mounted) {
          TopNotice.info(
            context,
            newlyDue.length == 1
                ? 'Task is due: ${newlyDue.single.title}'
                : '${newlyDue.length} tasks are due.',
          );
        }
      }
    } catch (error) {
      debugPrint('Failed to refresh side-work alerts: $error');
    } finally {
      _isRefreshingSideWork = false;
    }
  }

  Future<void> _clockInFromGate() async {
    BaristaAttendanceStatus attendance;
    try {
      attendance = await ApiService.fetchAttendanceStatus();
    } catch (_) {
      if (!mounted) return;
      TopNotice.error(
        context,
        'Unable to load staff profiles. Check the connection and try again.',
      );
      return;
    }
    if (!mounted) return;
    final activeIds = attendance.activeAttendance
        .map((item) => item.baristaId)
        .toSet();
    final choices = attendance.baristas
        .where((item) => item.pinConfigured && !activeIds.contains(item.id))
        .toList();
    final action = await showModalBottomSheet<_GateClockInAction>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _GateClockInSheet(baristas: choices),
    );
    if (action == null || !mounted) return;
    final result = await ApiService.updateAttendance(
      clockIn: true,
      baristaId: action.barista.id,
      pin: action.pin,
    );
    if (!mounted) return;
    if (!result.isSuccess) {
      TopNotice.error(context, result.errorMessage!);
      return;
    }
    await BaristaSoundService.instance.play(BaristaSoundEvent.clockIn);
    await _refreshShiftAccess();
  }

  Future<void> _loadInitialOrders() async {
    if (_isRefreshingOrders) return;
    _isRefreshingOrders = true;
    try {
      final result = await ApiService.fetchOrders();
      if (!result.isSuccess) {
        globalOrderSyncError.value = result.errorMessage;
        return;
      }
      final partition = partitionTodayOrders(result.orders);
      globalCurrentOrders.value = partition.active;
      globalHistoryOrders.value = partition.history;
      globalOrderSyncError.value = null;
      globalLastOrderSync.value = DateTime.now();
      await _evaluateOrderAlerts(partition.active);
    } catch (e) {
      debugPrint('Failed to fetch initial orders: $e');
    } finally {
      _isRefreshingOrders = false;
    }
  }

  Future<void> _evaluateOrderAlerts(List<CurrentOrder> orders) async {
    final settings = BaristaSoundService.instance.settings;
    final now = DateTime.now();
    for (final order in orders) {
      final cancellation = order.cancellationRequestStatus;
      if ((cancellation == 'pending' || cancellation == 'refund_pending') &&
          _alertedOrderEvents.add('cancel:${order.orderId}:$cancellation')) {
        await BaristaSoundService.instance.play(BaristaSoundEvent.cancellation);
        if (mounted) {
          TopNotice.error(
            context,
            'Cancellation request for ${order.orderId}. Review before preparing.',
          );
        }
      }

      final ageMinutes = orderAlertAgeMinutes(
        now: now,
        fallbackCreatedAt: order.orderDate,
        statusStartedAt: order.status == OrderStatus.preparing
            ? order.statusStartedAt
            : null,
      );
      if (order.status == OrderStatus.newOrder &&
          settings.waitingAlertEnabled &&
          ageMinutes >= settings.waitingAlertAfterMinutes) {
        final interval = settings.waitingAlertRepeatMinutes.clamp(1, 120);
        final bucket =
            (ageMinutes - settings.waitingAlertAfterMinutes) ~/ interval;
        if (_alertedOrderEvents.add('waiting:${order.orderId}:$bucket')) {
          await BaristaSoundService.instance.play(
            BaristaSoundEvent.waitingOrder,
          );
          if (mounted) {
            TopNotice.info(
              context,
              '${order.orderId} has been waiting $ageMinutes minutes.',
            );
          }
        }
      }
      if (order.status == OrderStatus.preparing &&
          settings.preparingAlertEnabled &&
          ageMinutes >= settings.preparingAlertAfterMinutes) {
        final interval = settings.preparingAlertRepeatMinutes.clamp(1, 120);
        final bucket =
            (ageMinutes - settings.preparingAlertAfterMinutes) ~/ interval;
        if (_alertedOrderEvents.add('preparing:${order.orderId}:$bucket')) {
          await BaristaSoundService.instance.play(
            BaristaSoundEvent.preparingTooLong,
          );
          if (mounted) {
            TopNotice.info(
              context,
              '${order.orderId} has been preparing $ageMinutes minutes.',
            );
          }
        }
      }
    }
    if (_alertedOrderEvents.length > 1000) {
      _alertedOrderEvents.removeWhere(
        (key) => !orders.any((order) => key.contains(order.orderId)),
      );
    }
  }

  Future<void> _handleNewOrderPush() async {
    await _loadInitialOrders();
    if (!mounted) return;
    TopNotice.info(context, 'A new order is waiting to be prepared.');
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    PushNotificationService.instance.setNewOrderHandler(null);
    _pageController.dispose();
    super.dispose();
  }

  void _onTabSelected(int index) {
    if (_currentIndex == index) return;
    if (index == 6) {
      globalSideWorkAttention.value = false;
    }
    setState(() {
      _currentIndex = index;
    });
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Positioned(
            top: 128,
            left: 0,
            right: 0,
            bottom: 0,
            child: PageView(
              physics: const BouncingScrollPhysics(),
              controller: _pageController,
              onPageChanged: (index) {
                setState(() {
                  _currentIndex = index;
                });
              },
              children: [
                CurrentOrderPage(onSettingsTap: () => _onTabSelected(7)),
                OrderHistoryPage(onSettingsTap: () => _onTabSelected(7)),
                const MenuAvailabilityPage(),
                const MarketingDrinkPage(),
                const InventoryPage(),
                const TimetablePage(),
                const SideWorkPage(),
                SettingsPage(onSignedOut: widget.onSignedOut),
              ],
            ),
          ),
          _WorkspaceHeader(
            currentIndex: _currentIndex,
            onTabSelected: _onTabSelected,
            menuOpen: _showHeaderMenu,
            onMenuToggle: () =>
                setState(() => _showHeaderMenu = !_showHeaderMenu),
          ),
          ValueListenableBuilder<WorkstationAccessState?>(
            valueListenable: globalWorkstationAccess,
            builder: (context, access, _) {
              if (access == null) {
                return const _ShiftAccessLoadingGate();
              }
              if (!access.canPrepareOrders) {
                return _ShiftAccessGate(
                  access: access,
                  onClockIn: _clockInFromGate,
                  onRefresh: _refreshShiftAccess,
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
    );
  }
}

class _WorkspaceHeader extends StatelessWidget {
  const _WorkspaceHeader({
    required this.currentIndex,
    required this.onTabSelected,
    required this.menuOpen,
    required this.onMenuToggle,
  });

  final int currentIndex;
  final ValueChanged<int> onTabSelected;
  final bool menuOpen;
  final VoidCallback onMenuToggle;

  @override
  Widget build(BuildContext context) => Positioned(
    top: 0,
    left: 0,
    right: 0,
    child: Container(
      height: 110,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: BoxDecoration(
        color: const Color(0xFF203E32),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF203E32).withValues(alpha: .16),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            Image.asset('assets/images/c2_logo.png', height: 40),
            const SizedBox(width: 16),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: _HeaderNavBar(
                    currentIndex: currentIndex,
                    onTabSelected: onTabSelected,
                    showSecondary: menuOpen,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            const BlinkingOnlineIndicator(),
            IconButton(
              onPressed: onMenuToggle,
              tooltip: menuOpen ? 'Hide navigation' : 'Show navigation',
              color: Colors.white,
              icon: Icon(menuOpen ? Icons.close_rounded : Icons.menu_rounded),
              iconSize: 28,
            ),
          ],
        ),
      ),
    ),
  );
}

class _HeaderNavBar extends StatelessWidget {
  const _HeaderNavBar({
    required this.currentIndex,
    required this.onTabSelected,
    required this.showSecondary,
  });

  final int currentIndex;
  final ValueChanged<int> onTabSelected;
  final bool showSecondary;

  static const _coreNavItems = [
    (
      Icons.shopping_basket_outlined,
      Icons.shopping_basket_rounded,
      'Orders',
      0,
    ),
    (Icons.history_outlined, Icons.history_rounded, 'History', 1),
    (Icons.restaurant_menu_outlined, Icons.restaurant_menu_rounded, 'Menu', 2),
    (Icons.checklist_outlined, Icons.task_alt_rounded, 'Tasks', 6),
  ];

  static const _secondaryNavItems = [
    (Icons.campaign_outlined, Icons.campaign_rounded, 'Marketing', 3),
    (Icons.inventory_2_outlined, Icons.inventory_2_rounded, 'Inventory', 4),
    (
      Icons.calendar_month_outlined,
      Icons.calendar_month_rounded,
      'Timetable',
      5,
    ),
    (Icons.settings_outlined, Icons.settings_rounded, 'Settings', 7),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.12),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ..._buildItems(_coreNavItems),
          if (showSecondary) ..._buildItems(_secondaryNavItems),
        ],
      ),
    );
  }

  List<Widget> _buildItems(List<(IconData, IconData, String, int)> items) {
    return List.generate(items.length, (index) {
      final pageIndex = items[index].$4;
      final isSelected = currentIndex == pageIndex;
      final item = items[index];

      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => onTabSelected(pageIndex),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                boxShadow: isSelected
                    ? [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.14),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isSelected ? item.$2 : item.$1,
                    color: isSelected
                        ? const Color(0xFF203E32)
                        : Colors.white.withValues(alpha: 0.8),
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    item.$3,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      color: isSelected
                          ? const Color(0xFF203E32)
                          : Colors.white.withValues(alpha: 0.85),
                      fontSize: 14.5,
                      fontWeight: isSelected
                          ? FontWeight.w800
                          : FontWeight.w600,
                      letterSpacing: 0.2,
                    ),
                  ),
                  if (pageIndex == 0 || pageIndex == 6) ...[
                    ValueListenableBuilder<List<CurrentOrder>>(
                      valueListenable: globalCurrentOrders,
                      builder: (context, orders, _) {
                        return ValueListenableBuilder<bool>(
                          valueListenable: globalSideWorkAttention,
                          builder: (context, hasTaskAlert, _) {
                            final showDot = pageIndex == 0
                                ? orders.any(
                                    (order) =>
                                        order.status == OrderStatus.newOrder,
                                  )
                                : hasTaskAlert;
                            return showDot
                                ? Container(
                                    margin: const EdgeInsets.only(left: 6),
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFE53935),
                                      shape: BoxShape.circle,
                                    ),
                                  )
                                : const SizedBox.shrink();
                          },
                        );
                      },
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      );
    });
  }
}

class _ShiftAccessLoadingGate extends StatelessWidget {
  const _ShiftAccessLoadingGate();

  @override
  Widget build(BuildContext context) => Positioned.fill(
    child: ColoredBox(
      color: Colors.white.withValues(alpha: .92),
      child: const Center(child: CircularProgressIndicator()),
    ),
  );
}

class _ShiftAccessGate extends StatelessWidget {
  const _ShiftAccessGate({
    required this.access,
    required this.onClockIn,
    required this.onRefresh,
  });
  final WorkstationAccessState access;
  final VoidCallback onClockIn;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => Positioned.fill(
    child: ColoredBox(
      color: const Color(0xFFF7F6F1).withValues(alpha: .97),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFD3B17D)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x22000000),
                      blurRadius: 24,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.lock_clock_rounded,
                      size: 52,
                      color: Color(0xFF304A3A),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      access.accessState == 'closed'
                          ? 'Outlet unavailable'
                          : 'Clock in to unlock',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF203E32),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      access.message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 17, height: 1.4),
                    ),
                    if (access.missingStaff.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        alignment: WrapAlignment.center,
                        children: access.missingStaff
                            .map(
                              (staff) => Chip(
                                label: Text(staff.baristaName),
                                avatar: const Icon(
                                  Icons.person_outline_rounded,
                                  size: 18,
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ],
                    const SizedBox(height: 24),
                    // Opening hours describe customer trading availability; they
                    // must not prevent a barista from starting an early or late
                    // shift. Only an unavailable/emergency-closed outlet blocks
                    // the PIN clock-in action.
                    if (access.accessState != 'closed')
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: onClockIn,
                          icon: const Icon(Icons.pin_rounded),
                          label: const Text('Clock in with PIN'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF304A3A),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                        ),
                      ),
                    TextButton.icon(
                      onPressed: onRefresh,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Refresh workstation status'),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Orders continue to arrive and ring while preparation is locked.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.black54),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _GateClockInAction {
  const _GateClockInAction(this.barista, this.pin);
  final AttendanceBarista barista;
  final String pin;
}

class _GateClockInSheet extends StatefulWidget {
  const _GateClockInSheet({required this.baristas});
  final List<AttendanceBarista> baristas;

  @override
  State<_GateClockInSheet> createState() => _GateClockInSheetState();
}

class _GateClockInSheetState extends State<_GateClockInSheet> {
  AttendanceBarista? selected;
  String pin = '';

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        24,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Start your shift',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          const Text('Choose your name and enter your own six-digit PIN.'),
          const SizedBox(height: 18),
          if (widget.baristas.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Text(
                'No available barista profile has a PIN. Ask an administrator to check the barista profile and PIN setup.',
              ),
            )
          else ...[
            DropdownButtonFormField<AttendanceBarista>(
              initialValue: selected,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Your name',
                border: OutlineInputBorder(),
              ),
              items: widget.baristas
                  .map(
                    (barista) => DropdownMenuItem(
                      value: barista,
                      child: Text(barista.name),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() => selected = value),
            ),
            const SizedBox(height: 14),
            TextField(
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 6,
              onChanged: (value) =>
                  setState(() => pin = value.replaceAll(RegExp(r'[^0-9]'), '')),
              decoration: const InputDecoration(
                labelText: 'Six-digit PIN',
                border: OutlineInputBorder(),
                counterText: '',
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: selected == null || pin.length != 6
                  ? null
                  : () => Navigator.pop(
                      context,
                      _GateClockInAction(selected!, pin),
                    ),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF304A3A),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Text('Clock in'),
            ),
          ],
        ],
      ),
    ),
  );
}
