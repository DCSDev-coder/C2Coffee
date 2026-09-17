import 'package:flutter/material.dart';

import '../main.dart';
import '../services/api_service.dart';
import '../services/push_notification_service.dart';
import '../widgets/blinking_online_indicator.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  static const Color ink = Color(0xFF203E32);
  static const Color green = Color(0xFF304A3A);
  static const Color gold = Color(0xFFD3B17D);
  static const Color canvas = Color(0xFFF7F6F1);

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late Future<OperationsContext> _operationsContext;
  late Future<BaristaAttendanceStatus> _attendance;
  bool _attendanceUpdating = false;

  @override
  void initState() {
    super.initState();
    _operationsContext = ApiService.fetchOperationsContext();
    _attendance = ApiService.fetchAttendanceStatus();
  }

  void _refreshWorkstation() {
    setState(() {
      _operationsContext = ApiService.fetchOperationsContext();
      _attendance = ApiService.fetchAttendanceStatus();
    });
  }

  Future<void> _updateAttendance(bool clockIn, AttendanceBarista barista, String pin) async {
    if (_attendanceUpdating) return;
    setState(() => _attendanceUpdating = true);
    final result = await ApiService.updateAttendance(clockIn: clockIn, baristaId: barista.id, pin: pin);
    if (!mounted) return;
    setState(() {
      _attendanceUpdating = false;
      _attendance = ApiService.fetchAttendanceStatus();
    });
    if (!result.isSuccess) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.errorMessage!)));
    }
  }

  Future<void> _openAttendanceSheet(BaristaAttendanceStatus status, bool clockIn) async {
    final activeIds = status.activeAttendance.map((item) => item.baristaId).toSet();
    final choices = (clockIn ? status.baristas.where((item) => item.pinConfigured && !activeIds.contains(item.id)) : status.baristas.where((item) => activeIds.contains(item.id))).toList();
    final action = await showModalBottomSheet<_AttendanceAction>(context: context, isScrollControlled: true, builder: (_) => _AttendancePinSheet(clockIn: clockIn, baristas: choices));
    if (action != null && mounted) await _updateAttendance(clockIn, action.barista, action.pin);
  }

  Future<void> _openGuides(String type, String title) async {
    final guides = await ApiService.fetchGuides();
    if (!mounted) return;
    final visible = guides.where((guide) => guide.type == type).toList();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(sheetContext).height * .82,
          child: _StaffGuidesSheet(title: title, guides: visible),
        ),
      ),
    );
  }

  Future<void> _signOut(BuildContext context) async {
    final shouldSignOut = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => _SignOutSheet(
        onCancel: () => Navigator.pop(sheetContext, false),
        onConfirm: () => Navigator.pop(sheetContext, true),
      ),
    );

    if (shouldSignOut != true || !context.mounted) return;
    await PushNotificationService.instance.deactivateForCurrentSession();
    await ApiService.logout();
    if (!context.mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => const LoginPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SettingsPage.canvas,
      body: Stack(
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 800),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 132, 24, 148),
                children: [
                  const Text(
                    'Workstation',
                    style: TextStyle(
                      color: SettingsPage.ink,
                      fontSize: 34,
                      height: 1.05,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'View the weekly timetable and receipt delivery readiness.',
                    style: TextStyle(
                      color: SettingsPage.ink.withValues(alpha: 0.65),
                      fontSize: 16,
                      height: 1.4,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: _refreshWorkstation,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Refresh workstation'),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const _SectionLabel(label: 'OPERATIONS'),
                  const SizedBox(height: 12),
                  FutureBuilder<OperationsContext>(
                    future: _operationsContext,
                    builder: (context, snapshot) {
                      if (snapshot.hasError) {
                        return const _OperationsUnavailableCard();
                      }
                      if (!snapshot.hasData) {
                        return const _OperationsLoadingCard();
                      }
                      return _OperationsStatusCard(
                        context: snapshot.data!,
                        onRefresh: _refreshWorkstation,
                      );
                    },
                  ),
                  const SizedBox(height: 24),
                  const _SectionLabel(label: 'SHIFT ATTENDANCE'),
                  const SizedBox(height: 12),
                  FutureBuilder<BaristaAttendanceStatus>(
                    future: _attendance,
                    builder: (context, snapshot) {
                      final status = snapshot.data;
                      final active = status?.activeAttendance ?? const <BaristaAttendance>[];
                      return Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: SettingsPage.ink.withValues(alpha: .10),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              active.isEmpty ? 'No barista clocked in' : '${active.length} barista${active.length == 1 ? '' : 's'} clocked in',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              active.isEmpty
                                  ? 'Select your name and enter your six-digit PIN. The shared tablet stays signed in.'
                                  : active.map((item) => '${item.baristaName} since ${TimeOfDay.fromDateTime(item.clockedInAt).format(context)}').join('\n'),
                            ),
                            const SizedBox(height: 14),
                            Row(children: [Expanded(child: FilledButton.icon(
                              onPressed: _attendanceUpdating || status == null ? null : () => _openAttendanceSheet(status, true),
                              icon: _attendanceUpdating
                                  ? const SizedBox.square(
                                      dimension: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.login_rounded),
                              label: const Text('Clock in'),
                              style: FilledButton.styleFrom(
                                backgroundColor: SettingsPage.green,
                              ),
                            )), const SizedBox(width: 10), Expanded(child: FilledButton.icon(
                              onPressed: _attendanceUpdating || status == null || active.isEmpty ? null : () => _openAttendanceSheet(status, false),
                              icon: const Icon(Icons.logout_rounded), label: const Text('Clock out'),
                              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFB54E3D)),
                            ))]),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 24),
                  const _SectionLabel(label: 'STAFF GUIDES'),
                  const SizedBox(height: 12),
                  _GuideLink(
                    title: 'Attire guide',
                    icon: Icons.checkroom_outlined,
                    onTap: () => _openGuides('attire', 'Attire guide'),
                  ),
                  const SizedBox(height: 10),
                  _GuideLink(
                    title: 'Store rules',
                    icon: Icons.rule_folder_outlined,
                    onTap: () => _openGuides('rules', 'Store rules'),
                  ),
                  const SizedBox(height: 10),
                  _GuideLink(
                    title: 'Drink SOPs',
                    icon: Icons.local_cafe_outlined,
                    onTap: () => _openGuides('drink', 'Drink SOPs'),
                  ),
                  const SizedBox(height: 32),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: () => _signOut(context),
                      icon: const Icon(Icons.logout_rounded, size: 19),
                      label: const Text('Sign out from this device'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFB54E3D),
                        side: const BorderSide(color: Color(0xFFB54E3D)),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 13,
                        ),
                        shape: const StadiumBorder(),
                        textStyle: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const _WorkstationHeader(),
        ],
      ),
    );
  }
}

class _AttendanceAction {
  final AttendanceBarista barista;
  final String pin;
  const _AttendanceAction(this.barista, this.pin);
}

class _AttendancePinSheet extends StatefulWidget {
  final bool clockIn;
  final List<AttendanceBarista> baristas;
  const _AttendancePinSheet({required this.clockIn, required this.baristas});
  @override
  State<_AttendancePinSheet> createState() => _AttendancePinSheetState();
}

class _AttendancePinSheetState extends State<_AttendancePinSheet> {
  AttendanceBarista? selected;
  String pin = '';
  @override
  Widget build(BuildContext context) => SafeArea(child: Padding(
    padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + MediaQuery.viewInsetsOf(context).bottom),
    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(widget.clockIn ? 'Clock in' : 'Clock out', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
      const SizedBox(height: 6),
      Text(widget.clockIn ? 'Select your name, then enter your six-digit PIN.' : 'Confirm your name and PIN to end your shift.'),
      const SizedBox(height: 18),
      if (widget.baristas.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 18), child: Text('No eligible barista profiles are available. Ask an administrator to set up the profile PIN.')) else ...[
        DropdownButtonFormField<AttendanceBarista>(initialValue: selected, isExpanded: true, decoration: const InputDecoration(labelText: 'Your name', border: OutlineInputBorder()), items: widget.baristas.map((barista) => DropdownMenuItem(value: barista, child: Text(barista.name))).toList(), onChanged: (value) => setState(() => selected = value)),
        const SizedBox(height: 14),
        TextField(keyboardType: TextInputType.number, obscureText: true, maxLength: 6, onChanged: (value) => setState(() => pin = value.replaceAll(RegExp(r'[^0-9]'), '')), decoration: const InputDecoration(labelText: 'Six-digit PIN', border: OutlineInputBorder(), counterText: '')),
        const SizedBox(height: 18),
        SizedBox(width: double.infinity, child: FilledButton(onPressed: selected == null || pin.length != 6 ? null : () => Navigator.pop(context, _AttendanceAction(selected!, pin)), style: FilledButton.styleFrom(backgroundColor: widget.clockIn ? SettingsPage.green : const Color(0xFFB54E3D)), child: Text(widget.clockIn ? 'Clock in now' : 'Clock out now'))),
      ],
      const SizedBox(height: 8),
    ]),
  ));
}

class _GuideLink extends StatelessWidget {
  final String title;
  final IconData icon;
  final VoidCallback onTap;
  const _GuideLink({
    required this.title,
    required this.icon,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(icon, color: SettingsPage.green),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    ),
  );
}

class _StaffGuidesSheet extends StatefulWidget {
  final String title;
  final List<BaristaGuide> guides;
  const _StaffGuidesSheet({required this.title, required this.guides});

  @override
  State<_StaffGuidesSheet> createState() => _StaffGuidesSheetState();
}

class _StaffGuidesSheetState extends State<_StaffGuidesSheet> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final isDrinkLibrary = widget.title == 'Drink SOPs';
    final visibleGuides = _searchQuery.trim().isNotEmpty
        ? widget.guides
            .where(
              (guide) => '${guide.menuItemName ?? ''} ${guide.guideTitle ?? ''} ${widget.title}'
                  .toLowerCase()
                  .contains(_searchQuery.trim().toLowerCase()),
            )
            .toList()
        : widget.guides;

    return Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.title,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        const Text('Images are maintained by your operations administrator.'),
        ...[
          const SizedBox(height: 16),
          TextField(
            onChanged: (value) => setState(() => _searchQuery = value),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: isDrinkLibrary ? 'Search drink SOPs' : 'Search guides',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _searchQuery.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear search',
                      onPressed: () => setState(() => _searchQuery = ''),
                      icon: const Icon(Icons.close_rounded),
                    ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ],
        const SizedBox(height: 18),
        Expanded(
          child: visibleGuides.isEmpty
              ? const Center(
                  child: Text('No matching guide images were found.'),
                )
              : ListView.separated(
                  itemCount: visibleGuides.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 16),
                  itemBuilder: (_, index) {
                    final guide = visibleGuides[index];
                    final url = ApiService.resolveAssetUrl(guide.imageUrl);
                    final guideTitle =
                        guide.menuItemName ?? guide.guideTitle ?? widget.title;
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        border: Border.all(color: SettingsPage.ink.withValues(alpha: .12)),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            guideTitle,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 10),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              url,
                              fit: BoxFit.contain,
                              errorBuilder: (_, _, _) => const SizedBox(
                                height: 180,
                                child: Center(child: Icon(Icons.broken_image_outlined)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    ),
  );
  }
}

class _WorkstationHeader extends StatelessWidget {
  const _WorkstationHeader();

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        height: 96,
        padding: const EdgeInsets.fromLTRB(24, 37, 24, 16),
        decoration: BoxDecoration(
          color: SettingsPage.ink,
          borderRadius: const BorderRadius.vertical(
            bottom: Radius.circular(24),
          ),
          boxShadow: [
            BoxShadow(
              color: SettingsPage.ink.withValues(alpha: 0.15),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Image.asset('assets/images/c2_logo.png', height: 34),
            const Spacer(),
            const BlinkingOnlineIndicator(),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;

  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        color: SettingsPage.ink.withValues(alpha: 0.48),
        fontSize: 11,
        letterSpacing: 1.6,
        fontWeight: FontWeight.w800,
      ),
    );
  }
}

class _OperationsLoadingCard extends StatelessWidget {
  const _OperationsLoadingCard();

  @override
  Widget build(BuildContext context) {
    return const _OperationsCard(
      icon: Icons.sync_rounded,
      title: 'Checking operational connections',
      subtitle: 'Loading POS, printer, and weekly coverage status.',
    );
  }
}

class _OperationsUnavailableCard extends StatelessWidget {
  const _OperationsUnavailableCard();

  @override
  Widget build(BuildContext context) {
    return const _OperationsCard(
      icon: Icons.cloud_off_rounded,
      title: 'Operational setup is not available yet',
      subtitle:
          'POS and printer connections are configured by an operations administrator. Order preparation remains available.',
    );
  }
}

class _OperationsStatusCard extends StatelessWidget {
  final OperationsContext context;
  final VoidCallback onRefresh;

  const _OperationsStatusCard({required this.context, required this.onRefresh});

  @override
  Widget build(BuildContext buildContext) {
    final defaultPrinter = context.printers
        .where((printer) => printer.isDefault)
        .firstOrNull;
    final connectedIntegrations = context.integrations
        .where((integration) => integration.status == 'connected')
        .toList();
    // Database weekday values follow Dart's Monday=1 through Sunday=7 convention.
    final today = DateTime.now().weekday;
    final todaySchedule = context.weeklySchedule
        .where((entry) => entry.weekday == today)
        .toList();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: SettingsPage.ink.withValues(alpha: 0.10)),
      ),
      child: Column(
        children: [
          _OperationalRow(
            icon: Icons.point_of_sale_outlined,
            title: 'POS connection',
            value: connectedIntegrations.isEmpty
                ? 'Not connected'
                : connectedIntegrations
                      .map((item) => item.displayName)
                      .join(', '),
            connected: connectedIntegrations.isNotEmpty,
          ),
          const Divider(height: 28),
          _OperationalRow(
            icon: Icons.receipt_long_outlined,
            title: 'Receipt printer',
            value: defaultPrinter == null
                ? 'No default printer'
                : '${defaultPrinter.name} (${_printerStatus(defaultPrinter.status)})',
            connected: defaultPrinter?.status == 'connected',
          ),
          const Divider(height: 28),
          _OperationalRow(
            icon: Icons.calendar_month_outlined,
            title: 'Today\'s coverage',
            value: todaySchedule.isEmpty
                ? 'No weekly schedule published'
                : todaySchedule.map(_scheduleLabel).join(' · '),
            connected: todaySchedule.isNotEmpty,
          ),
          const Divider(height: 28),
          Align(
            alignment: Alignment.centerLeft,
            child: Wrap(
              spacing: 4,
              children: [
                TextButton.icon(
                  onPressed: () => _showWeeklyTimetable(buildContext, context),
                  icon: const Icon(Icons.calendar_view_week_outlined),
                  label: const Text('View weekly timetable'),
                ),
                IconButton(
                  tooltip: 'Refresh timetable',
                  onPressed: onRefresh,
                  icon: const Icon(Icons.refresh_rounded),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _printerStatus(String status) => switch (status) {
    'connected' => 'ready',
    'pending' => 'awaiting setup',
    'disabled' => 'disabled',
    _ => 'not configured',
  };

  static String _scheduleLabel(WeeklyScheduleEntry entry) =>
      '${entry.baristaName} ${entry.startsAt}-${entry.endsAt}';

  static Future<void> _showWeeklyTimetable(
    BuildContext context,
    OperationsContext operations,
  ) {
    const dayNames = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];

    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      isDismissible: true,
      enableDrag: true,
      builder: (sheetContext) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(sheetContext).height * 0.78,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Weekly timetable',
                        style: TextStyle(
                          color: SettingsPage.ink,
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Close timetable',
                      onPressed: () => Navigator.of(sheetContext).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Published by operations. This timetable is for team planning only.',
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: ListView.separated(
                    itemCount: dayNames.length,
                    separatorBuilder: (_, _) => const Divider(height: 20),
                    itemBuilder: (_, index) {
                      final weekday = index + 1;
                      final shifts =
                          operations.weeklySchedule
                              .where((entry) => entry.weekday == weekday)
                              .toList()
                            ..sort(
                              (left, right) =>
                                  left.startsAt.compareTo(right.startsAt),
                            );
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            dayNames[index],
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 6),
                          if (shifts.isEmpty)
                            const Text('No shift published')
                          else
                            ...shifts.map(
                              (entry) => Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Text(_scheduleLabel(entry)),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OperationalRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  final bool connected;

  const _OperationalRow({
    required this.icon,
    required this.title,
    required this.value,
    required this.connected,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: SettingsPage.ink, size: 22),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: SettingsPage.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                value,
                style: TextStyle(
                  color: SettingsPage.ink.withValues(alpha: 0.62),
                  fontSize: 13,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
        Icon(
          connected ? Icons.check_circle_rounded : Icons.info_outline_rounded,
          color: connected ? const Color(0xFF3B7C61) : SettingsPage.gold,
          size: 20,
        ),
      ],
    );
  }
}

class _OperationsCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _OperationsCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: SettingsPage.ink.withValues(alpha: 0.10)),
      ),
      child: Row(
        children: [
          Icon(icon, color: SettingsPage.ink, size: 24),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: SettingsPage.ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: SettingsPage.ink.withValues(alpha: 0.62),
                    fontSize: 13,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SignOutSheet extends StatelessWidget {
  final VoidCallback onCancel;
  final VoidCallback onConfirm;

  const _SignOutSheet({required this.onCancel, required this.onConfirm});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 14, 24, 28),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.black12,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Sign out from this device?',
              style: TextStyle(
                color: SettingsPage.ink,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'The next staff member will need the shared Barista App login before selecting their name.',
              style: TextStyle(
                color: SettingsPage.ink.withValues(alpha: 0.62),
                fontSize: 15,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onCancel,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: SettingsPage.ink,
                      side: BorderSide(
                        color: SettingsPage.ink.withValues(alpha: 0.20),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: onConfirm,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFB54E3D),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Sign out'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
