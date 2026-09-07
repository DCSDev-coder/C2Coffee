import 'package:flutter/material.dart';

import '../main.dart';
import '../services/api_service.dart';
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
                    'View the active operator, weekly coverage, and receipt delivery readiness.',
                    style: TextStyle(
                      color: SettingsPage.ink.withValues(alpha: 0.65),
                      fontSize: 16,
                      height: 1.4,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 36),
                  const _SectionLabel(label: 'CURRENT SHIFT'),
                  const SizedBox(height: 12),
                  ValueListenableBuilder<String>(
                    valueListenable: globalActiveBarista,
                    builder: (context, activeBarista, _) {
                      return _ActiveBaristaCard(name: activeBarista);
                    },
                  ),
                  const SizedBox(height: 14),
                  const _HandoverNotice(),
                  const SizedBox(height: 32),
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
                  const SizedBox(height: 32),
                  const _SectionLabel(label: 'SESSION'),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: SettingsPage.ink.withValues(alpha: 0.10),
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: SettingsPage.gold.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.lock_outline_rounded,
                            color: SettingsPage.ink,
                            size: 21,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Shared Barista App account',
                                style: TextStyle(
                                  color: SettingsPage.ink,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'Operator changes will move to a verified handover after attendance sync is connected.',
                                style: TextStyle(
                                  color: SettingsPage.ink.withValues(
                                    alpha: 0.60,
                                  ),
                                  fontSize: 13,
                                  height: 1.35,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  TextButton.icon(
                    onPressed: () => _signOut(context),
                    icon: const Icon(Icons.logout_rounded, size: 19),
                    label: const Text('Sign out from this device'),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFB54E3D),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 14,
                      ),
                      alignment: Alignment.centerLeft,
                      textStyle: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
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

class _ActiveBaristaCard extends StatelessWidget {
  final String name;

  const _ActiveBaristaCard({required this.name});

  @override
  Widget build(BuildContext context) {
    final displayName = name.trim().isEmpty
        ? 'No barista selected'
        : name.trim();
    final initial = displayName.substring(0, 1).toUpperCase();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: SettingsPage.green,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: SettingsPage.green.withValues(alpha: 0.20),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: const BoxDecoration(
              color: SettingsPage.gold,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              initial,
              style: const TextStyle(
                color: SettingsPage.ink,
                fontSize: 21,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Preparing orders as',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.verified_rounded,
                  color: Color(0xFFD3B17D),
                  size: 15,
                ),
                SizedBox(width: 5),
                Text(
                  'ACTIVE',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    letterSpacing: 0.8,
                    fontWeight: FontWeight.w800,
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

class _HandoverNotice extends StatelessWidget {
  const _HandoverNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7E8),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: SettingsPage.gold.withValues(alpha: 0.55)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.schedule_rounded, color: SettingsPage.ink, size: 22),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Shift handover is controlled',
                  style: TextStyle(
                    color: SettingsPage.ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'When StoreHub attendance sync is connected, the next scheduled barista will confirm their own PIN. Do not pass this device to another operator without a handover.',
                  style: TextStyle(
                    color: SettingsPage.ink,
                    fontSize: 13,
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
