import 'dart:async';
import 'package:counter_app/widgets/top_notice.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'current_order_page.dart';
import '../widgets/floating_bottom_nav.dart';

import 'settings_page.dart';
import 'side_work_page.dart';
import 'timetable_page.dart';
import '../services/api_service.dart';
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
  String? _lastShiftAlertKey;
  final Set<int> _alertedSideWorkTaskIds = <int>{};

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
      if (access.accessState == 'closing' || access.accessState == 'handover') {
        final alertKey =
            '${access.scheduleDate}:${access.accessState}:${access.missingStaff.map((staff) => staff.baristaId).join(',')}';
        if (_lastShiftAlertKey != alertKey) {
          _lastShiftAlertKey = alertKey;
          await SystemSound.play(SystemSoundType.alert);
        }
      } else if (access.accessState == 'unlocked') {
        _lastShiftAlertKey = null;
      }
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
                ? 'Side work is due: ${newlyDue.single.title}'
                : '${newlyDue.length} side-work tasks are due.',
          );
        }
      }
    } catch (error) {
      debugPrint('Failed to refresh side-work alerts: $error');
    } finally {
      _isRefreshingSideWork = false;
    }
  }

  Future<void> _clockInFromGate(WorkstationAccessState access) async {
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
    final missingIds = access.missingStaff
        .map((item) => item.baristaId)
        .toSet();
    var choices = attendance.baristas
        .where(
          (item) =>
              item.pinConfigured &&
              !activeIds.contains(item.id) &&
              (missingIds.isEmpty || missingIds.contains(item.id)),
        )
        .toList();
    if (choices.isEmpty) {
      choices = attendance.baristas
          .where((item) => item.pinConfigured && !activeIds.contains(item.id))
          .toList();
    }
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
      final fetchedOrders = result.orders;
      globalCurrentOrders.value = fetchedOrders
          .where(
            (o) =>
                o.status != OrderStatus.completed &&
                o.status != OrderStatus.readyForPickup,
          )
          .toList();
      globalHistoryOrders.value = fetchedOrders
          .where((o) => o.status == OrderStatus.completed)
          .toList();
      globalOrderSyncError.value = null;
      globalLastOrderSync.value = DateTime.now();
    } catch (e) {
      debugPrint('Failed to fetch initial orders: $e');
    } finally {
      _isRefreshingOrders = false;
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
    final activePage = NavPage.values[_currentIndex];

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          Positioned(
            top: 110,
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
                CurrentOrderPage(onSettingsTap: () => _onTabSelected(3)),
                const TimetablePage(),
                const SideWorkPage(),
                SettingsPage(onSignedOut: widget.onSignedOut),
              ],
            ),
          ),
          const _WorkspaceHeader(),
          FloatingBottomNav(
            activePage: activePage,
            onTabSelected: _onTabSelected,
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
                  onClockIn: () => _clockInFromGate(access),
                  onRefresh: _refreshShiftAccess,
                );
              }
              if (access.accessState == 'handover' ||
                  access.accessState == 'closing') {
                return Positioned(
                  top: 112,
                  left: 18,
                  right: 18,
                  child: SafeArea(
                    child: _ShiftNotice(
                      access: access,
                      onClockIn: () => _clockInFromGate(access),
                    ),
                  ),
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
  const _WorkspaceHeader();

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
            const Spacer(),
            const BlinkingOnlineIndicator(),
          ],
        ),
      ),
    ),
  );
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
                      access.scheduleStatus == 'unpublished'
                          ? 'Timetable required'
                          : access.accessState == 'closed'
                          ? 'Shift closed'
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
                    if (access.scheduleStatus == 'published' &&
                        access.accessState != 'closed')
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
                      label: const Text('Refresh shift status'),
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

class _ShiftNotice extends StatelessWidget {
  const _ShiftNotice({required this.access, required this.onClockIn});
  final WorkstationAccessState access;
  final VoidCallback onClockIn;

  @override
  Widget build(BuildContext context) => Material(
    elevation: 8,
    borderRadius: BorderRadius.circular(16),
    color: const Color(0xFFFFF4E5),
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          const Icon(
            Icons.notifications_active_outlined,
            color: Color(0xFF8A5A13),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              access.message,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          if (access.accessState == 'handover')
            TextButton(onPressed: onClockIn, child: const Text('Clock in')),
        ],
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
          const Text(
            'Each scheduled barista clocks in once with their own six-digit PIN.',
          ),
          const SizedBox(height: 18),
          if (widget.baristas.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Text(
                'No eligible scheduled profile with a PIN is available. Ask an administrator to check the timetable and PIN setup.',
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
