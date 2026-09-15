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
  late final Future<OperationsContext> _operationsContext =
      ApiService.fetchOperationsContext();
  late Future<BaristaAttendance?> _attendance =
      ApiService.fetchCurrentAttendance();
  bool _attendanceUpdating = false;

  Future<void> _updateAttendance(bool clockIn) async {
    if (_attendanceUpdating) return;
    setState(() => _attendanceUpdating = true);
    final result = await ApiService.updateAttendance(clockIn);
    if (!mounted) return;
    setState(() {
      _attendanceUpdating = false;
      _attendance = ApiService.fetchCurrentAttendance();
    });
    if (!result.isSuccess) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.errorMessage!)));
    }
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
                  const SizedBox(height: 36),
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
                      return _OperationsStatusCard(context: snapshot.data!);
                    },
                  ),
                  const SizedBox(height: 24),
                  const _SectionLabel(label: 'MY SHIFT'),
                  const SizedBox(height: 12),
                  FutureBuilder<BaristaAttendance?>(
                    future: _attendance,
                    builder: (context, snapshot) {
                      final attendance = snapshot.data;
                      final clockedIn = attendance != null;
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
                              clockedIn
                                  ? 'You are clocked in'
                                  : 'You are not clocked in',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              clockedIn
                                  ? 'Started ${TimeOfDay.fromDateTime(attendance.clockedInAt).format(context)}. Server time is used for attendance.'
                                  : 'Clock in before preparing or completing customer orders.',
                            ),
                            const SizedBox(height: 14),
                            FilledButton.icon(
                              onPressed: _attendanceUpdating
                                  ? null
                                  : () => _updateAttendance(!clockedIn),
                              icon: _attendanceUpdating
                                  ? const SizedBox.square(
                                      dimension: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : Icon(
                                      clockedIn
                                          ? Icons.logout_rounded
                                          : Icons.login_rounded,
                                    ),
                              label: Text(clockedIn ? 'Clock out' : 'Clock in'),
                              style: FilledButton.styleFrom(
                                backgroundColor: clockedIn
                                    ? const Color(0xFFB54E3D)
                                    : SettingsPage.green,
                              ),
                            ),
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

class _StaffGuidesSheet extends StatelessWidget {
  final String title;
  final List<BaristaGuide> guides;
  const _StaffGuidesSheet({required this.title, required this.guides});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        const Text('Images are maintained by your operations administrator.'),
        const SizedBox(height: 18),
        Expanded(
          child: guides.isEmpty
              ? const Center(
                  child: Text('No guide images have been uploaded yet.'),
                )
              : ListView.separated(
                  itemCount: guides.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 16),
                  itemBuilder: (_, index) {
                    final url = guides[index].imageUrl.startsWith('http')
                        ? guides[index].imageUrl
                        : '${ApiService.baseUrl}${guides[index].imageUrl}';
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.network(
                        url,
                        fit: BoxFit.contain,
                        errorBuilder: (_, _, _) => const SizedBox(
                          height: 180,
                          child: Center(
                            child: Icon(Icons.broken_image_outlined),
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    ),
  );
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

  const _OperationsStatusCard({required this.context});

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
            child: TextButton.icon(
              onPressed: () => _showWeeklyTimetable(buildContext, context),
              icon: const Icon(Icons.calendar_view_week_outlined),
              label: const Text('View weekly timetable'),
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
      builder: (sheetContext) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(sheetContext).height * 0.78,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Weekly timetable',
                  style: TextStyle(
                    color: SettingsPage.ink,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
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
