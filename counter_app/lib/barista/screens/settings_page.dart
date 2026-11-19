import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:counter_app/widgets/top_notice.dart';

import '../services/api_service.dart';
import '../services/direct_printer_service.dart';
import '../services/push_notification_service.dart';
import '../services/barista_sound_service.dart';
import '../widgets/barista_page_header.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key, required this.onSignedOut});

  final VoidCallback onSignedOut;

  static const Color ink = Color(0xFF203E32);
  static const Color green = Color(0xFF304A3A);
  static const Color gold = Color(0xFFD3B17D);
  static const Color canvas = Colors.white;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late Future<BaristaAttendanceStatus> _attendance;
  bool _attendanceUpdating = false;
  bool _printingShiftSummary = false;

  @override
  void initState() {
    super.initState();
    _attendance = ApiService.fetchAttendanceStatus();
  }

  void _refreshWorkstation() {
    setState(() {
      _attendance = ApiService.fetchAttendanceStatus();
    });
  }

  Future<void> _updateAttendance(
    bool clockIn,
    AttendanceBarista barista,
    String pin,
  ) async {
    if (_attendanceUpdating) return;
    setState(() => _attendanceUpdating = true);
    final result = await ApiService.updateAttendance(
      clockIn: clockIn,
      baristaId: barista.id,
      pin: pin,
    );
    if (!mounted) return;
    setState(() {
      _attendanceUpdating = false;
      _attendance = ApiService.fetchAttendanceStatus();
    });
    if (!result.isSuccess) {
      TopNotice.error(context, result.errorMessage!);
    } else {
      String? printMessage;
      if (!clockIn) {
        final report = result.data?['shift_report'];
        if (report is Map<String, dynamic>) {
          try {
            await DirectPrinterService.instance.printShiftSummaryReport(report);
            printMessage = ' Shift report printed.';
          } on StateError catch (error) {
            printMessage = ' Shift report was not printed: ${error.message}';
          } catch (error) {
            printMessage = ' Shift report could not be printed: $error';
          }
        }
      }
      await BaristaSoundService.instance.play(
        clockIn ? BaristaSoundEvent.clockIn : BaristaSoundEvent.clockOut,
      );
      if (!mounted) return;
      TopNotice.success(
        context,
        '${barista.name} clocked ${clockIn ? 'in' : 'out'}.${printMessage ?? ''}',
      );
    }
  }

  Future<void> _printShiftSummary() async {
    if (_printingShiftSummary) return;
    setState(() => _printingShiftSummary = true);
    try {
      final result = await ApiService.fetchShiftSummary();
      if (!mounted) return;
      if (!result.isSuccess) {
        TopNotice.error(context, result.errorMessage!);
        return;
      }
      final report = result.data?['shift_report'];
      if (report is! Map<String, dynamic>) {
        TopNotice.error(context, 'Shift summary data is unavailable.');
        return;
      }
      await DirectPrinterService.instance.printShiftSummaryReport(report);
      if (!mounted) return;
      TopNotice.success(context, 'Shift summary printed.');
    } on StateError catch (error) {
      if (mounted) TopNotice.error(context, error.message);
    } catch (error) {
      if (mounted) {
        TopNotice.error(context, 'Shift summary could not be printed: $error');
      }
    } finally {
      if (mounted) {
        setState(() => _printingShiftSummary = false);
      }
    }
  }

  Future<void> _openAttendanceSheet(
    BaristaAttendanceStatus status,
    bool clockIn,
  ) async {
    final activeIds = status.activeAttendance
        .map((item) => item.baristaId)
        .toSet();
    final choices =
        (clockIn
                ? status.baristas.where(
                    (item) =>
                        item.pinConfigured && !activeIds.contains(item.id),
                  )
                : status.baristas.where((item) => activeIds.contains(item.id)))
            .toList();
    final action = await showDialog<_AttendanceAction>(
      context: context,
      builder: (_) => _AttendancePinSheet(clockIn: clockIn, baristas: choices),
    );
    if (action != null && mounted) {
      await _updateAttendance(clockIn, action.barista, action.pin);
    }
  }

  Future<void> _openEmergencySheet(BaristaAttendanceStatus status) async {
    final isReopen = status.emergencyClosure != null;
    final activeIds = status.activeAttendance
        .map((item) => item.baristaId)
        .toSet();
    final choices = status.baristas
        .where(
          (item) =>
              item.pinConfigured && (isReopen || activeIds.contains(item.id)),
        )
        .toList();
    final action = await showDialog<_EmergencyAction>(
      context: context,
      builder: (_) => _EmergencySheet(
        baristas: choices,
        reopening: isReopen,
        expectedReopenAt: status.emergencyClosure?.expectedReopenAt,
      ),
    );
    if (action == null || !mounted) return;
    setState(() => _attendanceUpdating = true);
    final result = isReopen
        ? await ApiService.emergencyReopenOutlet(
            baristaId: action.barista.id,
            pin: action.pin,
          )
        : await ApiService.emergencyCloseOutlet(
            baristaId: action.barista.id,
            pin: action.pin,
            reasonCode: action.reasonCode,
            note: action.note,
          );
    if (!mounted) return;
    setState(() {
      _attendanceUpdating = false;
      _attendance = ApiService.fetchAttendanceStatus();
    });
    if (!result.isSuccess) {
      TopNotice.error(context, result.errorMessage!);
      return;
    }
    TopNotice.success(
      context,
      isReopen
          ? 'The outlet is open again and your shift has resumed.'
          : 'Emergency closure activated. Eligible incoming orders were cancelled and customers were notified.',
    );
  }

  Future<void> _openGuides(String type, String title) async {
    final guides = await ApiService.fetchGuides();
    if (!mounted) return;
    final visible = guides.where((guide) => guide.type == type).toList();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: 1140,
            maxHeight: MediaQuery.sizeOf(dialogContext).height * 0.88,
          ),
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
    widget.onSignedOut();
  }

  Widget _buildAttendanceCard(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionLabel(label: 'SHIFT ATTENDANCE'),
        const SizedBox(height: 12),
        FutureBuilder<BaristaAttendanceStatus>(
          future: _attendance,
          builder: (context, snapshot) {
            final status = snapshot.data;
            final active =
                status?.activeAttendance ?? const <BaristaAttendance>[];
            final emergencyClosed = status?.emergencyClosure != null;
            return Container(
              padding: const EdgeInsets.all(20),
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
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: active.isEmpty
                              ? Colors.black.withValues(alpha: 0.05)
                              : const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: active.isEmpty
                                    ? Colors.black38
                                    : const Color(0xFF16A34A),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              active.isEmpty
                                  ? 'No barista clocked in'
                                  : '${active.length} barista${active.length == 1 ? '' : 's'} clocked in',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: active.isEmpty
                                    ? Colors.black54
                                    : const Color(0xFF166534),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (emergencyClosed) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text(
                            'Emergency closed',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFB3261E),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (active.isEmpty)
                    Text(
                      'Select your name and enter your six-digit PIN. The shared tablet stays signed in.',
                      style: TextStyle(
                        color: SettingsPage.ink.withValues(alpha: 0.72),
                        height: 1.4,
                      ),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: active.map((item) {
                        final time = TimeOfDay.fromDateTime(
                          item.clockedInAt,
                        ).format(context);
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF6F8F7),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFDCE3EA)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CircleAvatar(
                                radius: 12,
                                backgroundColor: SettingsPage.green.withValues(
                                  alpha: 0.14,
                                ),
                                child: Text(
                                  item.baristaName.isEmpty
                                      ? '?'
                                      : item.baristaName[0].toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                    color: SettingsPage.green,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '${item.baristaName} · since $time',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: SettingsPage.ink,
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _attendanceUpdating || status == null
                              ? null
                              : () => _openAttendanceSheet(status, true),
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
                            minimumSize: const Size.fromHeight(46),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed:
                              _attendanceUpdating ||
                                  status == null ||
                                  active.isEmpty
                              ? null
                              : () => _openAttendanceSheet(status, false),
                          icon: const Icon(Icons.logout_rounded),
                          label: const Text('Clock out'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFFB54E3D),
                            minimumSize: const Size.fromHeight(46),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _printingShiftSummary || status == null
                          ? null
                          : _printShiftSummary,
                      icon: _printingShiftSummary
                          ? const SizedBox.square(
                              dimension: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.print_rounded),
                      label: Text(
                        _printingShiftSummary
                            ? 'Printing shift summary...'
                            : 'Print Shift Summary',
                      ),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(44),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        foregroundColor: SettingsPage.green,
                        side: BorderSide(
                          color: SettingsPage.green.withValues(alpha: 0.35),
                        ),
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 14),
                    child: Divider(height: 1, color: Color(0xFFE5E7EB)),
                  ),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _attendanceUpdating || status == null
                          ? null
                          : () => _openEmergencySheet(status),
                      icon: Icon(
                        !emergencyClosed
                            ? Icons.emergency_outlined
                            : Icons.lock_open_rounded,
                      ),
                      label: Text(
                        !emergencyClosed
                            ? 'Emergency close outlet'
                            : 'Reopen outlet',
                      ),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(44),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        foregroundColor: !emergencyClosed
                            ? const Color(0xFFB3261E)
                            : SettingsPage.green,
                        side: BorderSide(
                          color: !emergencyClosed
                              ? const Color(0xFFFCA5A5)
                              : SettingsPage.green,
                        ),
                        backgroundColor: !emergencyClosed
                            ? const Color(0xFFFEF2F2)
                            : null,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildGuidesAndDeviceColumn(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
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
        const SizedBox(height: 22),
        const _SectionLabel(label: 'SOUND CHECK'),
        const SizedBox(height: 12),
        _SoundCheckCard(),
        const SizedBox(height: 22),
        const _SectionLabel(label: 'DEVICE SESSION'),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: SettingsPage.ink.withValues(alpha: .10)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Workstation session',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Clears device authentication on this tablet.',
                      style: TextStyle(
                        fontSize: 13,
                        color: SettingsPage.ink.withValues(alpha: 0.65),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                onPressed: () => _signOut(context),
                icon: const Icon(Icons.logout_rounded, size: 18),
                label: const Text('Sign out from this device'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFB54E3D),
                  side: const BorderSide(color: Color(0xFFB54E3D)),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
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
              constraints: const BoxConstraints(maxWidth: 1180),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
                children: [
                  BaristaPageHeader(
                    title: 'Workstation',
                    subtitle:
                        'Manage shift attendance, receipt printing and staff guides.',
                    onRefresh: _refreshWorkstation,
                    refreshTooltip: 'Refresh workstation',
                  ),
                  const SizedBox(height: 22),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      if (constraints.maxWidth >= 820) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              flex: 6,
                              child: _buildAttendanceCard(context),
                            ),
                            const SizedBox(width: 20),
                            Expanded(
                              flex: 5,
                              child: _buildGuidesAndDeviceColumn(context),
                            ),
                          ],
                        );
                      }
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _buildAttendanceCard(context),
                          const SizedBox(height: 24),
                          _buildGuidesAndDeviceColumn(context),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SoundCheckCard extends StatefulWidget {
  @override
  State<_SoundCheckCard> createState() => _SoundCheckCardState();
}

class _SoundCheckCardState extends State<_SoundCheckCard> {
  BaristaSoundEvent? _playing;

  Future<void> _preview(BaristaSoundEvent event) async {
    if (_playing != null) return;
    setState(() => _playing = event);
    try {
      await BaristaSoundService.instance.preview(event);
    } finally {
      if (mounted) setState(() => _playing = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    const cues = <(BaristaSoundEvent, String, IconData)>[
      (
        BaristaSoundEvent.incomingOrder,
        'New order',
        Icons.receipt_long_outlined,
      ),
      (
        BaristaSoundEvent.cancellation,
        'Cancellation',
        Icons.warning_amber_outlined,
      ),
      (BaristaSoundEvent.waitingOrder, 'Waiting order', Icons.hourglass_bottom),
      (
        BaristaSoundEvent.preparingTooLong,
        'Preparing reminder',
        Icons.timer_outlined,
      ),
      (BaristaSoundEvent.clockIn, 'Clock in', Icons.login_rounded),
      (BaristaSoundEvent.clockOut, 'Clock out', Icons.logout_rounded),
      (
        BaristaSoundEvent.sideWork,
        'Side work due',
        Icons.cleaning_services_outlined,
      ),
    ];
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: SettingsPage.ink.withValues(alpha: .10)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Hear the configured sounds',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 5),
          Text(
            'Tap a cue to hear it on this tablet. This is preview-only and does not change the sound setup.',
            style: TextStyle(
              fontSize: 13,
              height: 1.35,
              color: SettingsPage.ink.withValues(alpha: .68),
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: cues.map((cue) {
              final event = cue.$1;
              final isPlaying = _playing == event;
              return OutlinedButton.icon(
                onPressed: _playing == null ? () => _preview(event) : null,
                icon: isPlaying
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(cue.$3, size: 17),
                label: Text(cue.$2),
                style: OutlinedButton.styleFrom(
                  foregroundColor: SettingsPage.green,
                  side: BorderSide(
                    color: SettingsPage.green.withValues(alpha: .35),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 11,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(11),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class DirectPrinterCard extends StatefulWidget {
  const DirectPrinterCard({super.key, this.onClose});

  final VoidCallback? onClose;

  @override
  State<DirectPrinterCard> createState() => _DirectPrinterCardState();
}

class _DirectPrinterCardState extends State<DirectPrinterCard> {
  bool _working = false;
  bool _sunmiDetected = false;
  String? _sunmiStatus;
  final _hostController = TextEditingController();
  final _portController = TextEditingController(text: '9100');
  DirectPrinterConfig? _savedConfig;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  @override
  void dispose() {
    _hostController.dispose();
    _portController.dispose();
    super.dispose();
  }

  Future<void> _loadConfig() async {
    final config = await DirectPrinterService.instance.loadConfig();
    final sunmiAvailable = await DirectPrinterService.instance
        .isSunmiAvailable();
    String? sunmiStatus;
    if (sunmiAvailable) {
      sunmiStatus = await DirectPrinterService.instance.getSunmiStatus();
    }
    if (!mounted) return;
    setState(() {
      _savedConfig = config;
      _sunmiDetected = sunmiAvailable;
      _sunmiStatus = sunmiStatus;
      _hostController.text =
          config?.host ?? (sunmiAvailable ? DirectPrinterConfig.sunmiHost : '');
      _portController.text = (config?.port ?? 9100).toString();
    });
  }

  Future<void> _selectSunmi() async {
    setState(() {
      _hostController.text = DirectPrinterConfig.sunmiHost;
      _portController.text = '9100';
    });
    await _save();
  }

  DirectPrinterConfig? _formConfig() {
    final host = _hostController.text.trim();
    final port = int.tryParse(_portController.text.trim());
    if (host.isEmpty || port == null || port < 1 || port > 65535) return null;
    return DirectPrinterConfig(host: host, port: port);
  }

  Future<void> _save() async {
    final config = _formConfig();
    if (config == null) {
      TopNotice.error(
        context,
        'Use a private outlet Wi-Fi printer IPv4 address and port 9100.',
      );
      return;
    }
    setState(() => _working = true);
    try {
      await DirectPrinterService.instance.saveConfig(config);
      if (!mounted) return;
      setState(() => _savedConfig = config);
      TopNotice.success(
        context,
        'Printer saved. Print a test receipt to activate it.',
      );
    } catch (error) {
      if (!mounted) return;
      TopNotice.error(
        context,
        error.toString().replaceFirst('Bad state: ', ''),
      );
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _remove() async {
    setState(() => _working = true);
    try {
      await DirectPrinterService.instance.clearConfig();
      if (!mounted) return;
      setState(() {
        _savedConfig = null;
        _hostController.clear();
        _portController.text = '9100';
      });
      TopNotice.success(context, 'Printer removed from this tablet.');
    } catch (error) {
      if (!mounted) return;
      TopNotice.error(
        context,
        error.toString().replaceFirst('Bad state: ', ''),
      );
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _printTest(DirectPrinterConfig config) async {
    if (_working) return;
    setState(() => _working = true);
    try {
      await DirectPrinterService.instance.printTestReceipt(config);
      await DirectPrinterService.instance.confirmTestReceipt();
      if (!mounted) return;
      TopNotice.success(
        context,
        'Test receipt printed and device connection confirmed.',
      );
    } catch (error) {
      if (!mounted) return;
      TopNotice.error(
        context,
        error.toString().replaceFirst('Bad state: ', ''),
      );
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isSunmiConfig =
        _hostController.text.trim() == DirectPrinterConfig.sunmiHost;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: SettingsPage.ink.withValues(alpha: .10)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.print_outlined, color: SettingsPage.green),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _savedConfig == null
                      ? 'Set up receipt printer'
                      : _savedConfig!.isSunmi
                      ? 'Printer ready · Sunmi D3 Mini Inner Printer'
                      : 'Printer ready · ${_savedConfig!.host}:${_savedConfig!.port}',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (widget.onClose != null)
                IconButton(
                  onPressed: widget.onClose,
                  icon: const Icon(Icons.close),
                  tooltip: 'Close printer settings',
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            isSunmiConfig
                ? 'Built-in Sunmi D3 Mini receipt printing. Print a test receipt to confirm hardware readiness.'
                : 'Enter the outlet Wi-Fi printer IP. Saving assigns it to this activated C2 Store device; a successful test enables new-order printing.',
          ),
          const SizedBox(height: 14),
          if (_sunmiDetected && !isSunmiConfig) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: SettingsPage.green.withValues(alpha: .30),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.print, color: SettingsPage.green),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Sunmi D3 Mini Built-in Printer Detected',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          'No IP or Wi-Fi needed. Print directly to this device.',
                          style: TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                      ],
                    ),
                  ),
                  FilledButton.tonal(
                    onPressed: _working ? null : _selectSunmi,
                    child: const Text('Use Built-in'),
                  ),
                ],
              ),
            ),
          ],
          if (isSunmiConfig) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: SettingsPage.green.withValues(alpha: .30),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.check_circle_rounded,
                        color: SettingsPage.green,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Using Sunmi D3 Mini Inner Printer',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                      const Spacer(),
                      if (_sunmiStatus != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: SettingsPage.ink.withValues(alpha: .15),
                            ),
                          ),
                          child: Text(
                            'Status: $_sunmiStatus',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Direct hardware thermal printing enabled. Kitchen and counter tickets print through this terminal automatically.',
                    style: TextStyle(fontSize: 13, color: Colors.black87),
                  ),
                  const SizedBox(height: 10),
                  TextButton.icon(
                    onPressed: () {
                      setState(() {
                        _hostController.clear();
                        _portController.text = '9100';
                      });
                    },
                    icon: const Icon(Icons.swap_horiz, size: 16),
                    label: const Text('Switch to external network printer'),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            TextField(
              controller: _hostController,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                labelText: 'Printer IP address',
                hintText: '192.168.1.100',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _portController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Port',
                hintText: '9100',
                border: OutlineInputBorder(),
              ),
            ),
            if (_sunmiDetected) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: _working ? null : _selectSunmi,
                  icon: const Icon(Icons.touch_app_outlined, size: 16),
                  label: const Text('Switch back to Sunmi Built-in Printer'),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ),
            ],
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.icon(
                onPressed: _working ? null : _save,
                icon: const Icon(Icons.save_outlined),
                label: const Text('Save printer'),
                style: FilledButton.styleFrom(
                  backgroundColor: SettingsPage.green,
                ),
              ),
              if (_savedConfig != null)
                OutlinedButton.icon(
                  onPressed: _working ? null : () => _printTest(_savedConfig!),
                  icon: _working
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.receipt_long_outlined),
                  label: const Text('Print test receipt'),
                ),
              if (_savedConfig != null)
                TextButton.icon(
                  onPressed: _working ? null : _remove,
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Remove printer'),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.red.shade700,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmergencyAction {
  final AttendanceBarista barista;
  final String pin;
  final String reasonCode;
  final String? note;

  const _EmergencyAction({
    required this.barista,
    required this.pin,
    required this.reasonCode,
    this.note,
  });
}

class _EmergencySheet extends StatefulWidget {
  final List<AttendanceBarista> baristas;
  final bool reopening;
  final DateTime? expectedReopenAt;

  const _EmergencySheet({
    required this.baristas,
    required this.reopening,
    this.expectedReopenAt,
  });

  @override
  State<_EmergencySheet> createState() => _EmergencySheetState();
}

class _EmergencySheetState extends State<_EmergencySheet> {
  AttendanceBarista? selected;
  String pin = '';
  String reasonCode = 'medical_emergency';
  String note = '';

  static const _reasons = <(String, String)>[
    ('medical_emergency', 'Medical emergency'),
    ('safety_incident', 'Safety incident'),
    ('power_outage', 'Power outage'),
    ('equipment_failure', 'Equipment failure'),
    ('other', 'Other'),
  ];

  @override
  void initState() {
    super.initState();
    if (widget.baristas.length == 1) {
      selected = widget.baristas.first;
    }
  }

  void _appendDigit(String digit) {
    if (pin.length >= 6) return;
    setState(() => pin += digit);
  }

  void _backspace() {
    if (pin.isEmpty) return;
    setState(() => pin = pin.substring(0, pin.length - 1));
  }

  void _clearPin() {
    if (pin.isEmpty) return;
    setState(() => pin = '');
  }

  void _submit() {
    if (selected == null || pin.length != 6) return;
    Navigator.pop(
      context,
      _EmergencyAction(
        barista: selected!,
        pin: pin,
        reasonCode: reasonCode,
        note: note.trim().isEmpty ? null : note.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.reopening
        ? SettingsPage.green
        : const Color(0xFFB3261E);

    return Dialog(
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
      clipBehavior: Clip.antiAlias,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 740),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Branded Header
              Container(
                padding: const EdgeInsets.fromLTRB(24, 18, 20, 18),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: widget.reopening
                        ? const [Color(0xFF173F3A), Color(0xFF304A3A)]
                        : const [Color(0xFF881B15), Color(0xFFB3261E)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        widget.reopening
                            ? Icons.lock_open_rounded
                            : Icons.emergency_outlined,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.reopening
                                ? 'Reopen outlet'
                                : 'Emergency close outlet',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 21,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            widget.reopening
                                ? 'Reopening resumes ordering and clocks the selected barista in.'
                                : 'Preparing or ready orders block closure. Earlier orders are cancelled and refunded safely.',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.88),
                              fontSize: 12.5,
                            ),
                          ),
                          if (widget.expectedReopenAt != null) ...[
                            const SizedBox(height: 3),
                            Text(
                              'Automatic reopening: ${widget.expectedReopenAt}',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.92),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Close',
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(
                        Icons.close_rounded,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),

              if (widget.baristas.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      const Text(
                        'No eligible barista profiles are available. Ask an administrator to set up the profile PIN.',
                      ),
                      const SizedBox(height: 16),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Close'),
                        ),
                      ),
                    ],
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.all(22),
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final leftColumn = Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            '1. SELECT BARISTA',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.3,
                              color: SettingsPage.ink.withValues(alpha: 0.5),
                            ),
                          ),
                          const SizedBox(height: 8),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxHeight: 150),
                            child: ListView.separated(
                              shrinkWrap: true,
                              itemCount: widget.baristas.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: 6),
                              itemBuilder: (_, index) {
                                final barista = widget.baristas[index];
                                final isSelected = selected?.id == barista.id;
                                return Material(
                                  color: isSelected
                                      ? accent.withValues(alpha: 0.08)
                                      : const Color(0xFFF8FAF9),
                                  borderRadius: BorderRadius.circular(12),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(12),
                                    onTap: () =>
                                        setState(() => selected = barista),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 9,
                                      ),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: isSelected
                                              ? accent
                                              : const Color(0xFFDCE3EA),
                                          width: isSelected ? 1.8 : 1,
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          CircleAvatar(
                                            radius: 15,
                                            backgroundColor: isSelected
                                                ? accent
                                                : accent.withValues(
                                                    alpha: 0.14,
                                                  ),
                                            child: Text(
                                              barista.name.isEmpty
                                                  ? '?'
                                                  : barista.name[0]
                                                        .toUpperCase(),
                                              style: TextStyle(
                                                color: isSelected
                                                    ? Colors.white
                                                    : accent,
                                                fontWeight: FontWeight.w900,
                                                fontSize: 13,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Text(
                                              barista.name,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w800,
                                                color: isSelected
                                                    ? accent
                                                    : SettingsPage.ink,
                                              ),
                                            ),
                                          ),
                                          if (isSelected)
                                            Icon(
                                              Icons.check_circle_rounded,
                                              color: accent,
                                              size: 18,
                                            ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                          if (!widget.reopening) ...[
                            const SizedBox(height: 14),
                            Text(
                              '2. EMERGENCY REASON',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.3,
                                color: SettingsPage.ink.withValues(alpha: 0.5),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: _reasons.map((item) {
                                final active = reasonCode == item.$1;
                                return ChoiceChip(
                                  label: Text(item.$2),
                                  visualDensity: VisualDensity.compact,
                                  selected: active,
                                  selectedColor: accent.withValues(alpha: 0.14),
                                  labelStyle: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: active ? accent : SettingsPage.ink,
                                  ),
                                  onSelected: (_) =>
                                      setState(() => reasonCode = item.$1),
                                );
                              }).toList(),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              scrollPadding: const EdgeInsets.only(bottom: 120),
                              maxLength: 500,
                              maxLines: 2,
                              onChanged: (value) => note = value,
                              decoration: InputDecoration(
                                labelText: 'Internal note (optional)',
                                isDense: true,
                                counterText: '',
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ],
                        ],
                      );

                      final pinPad = Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            widget.reopening
                                ? '2. ENTER 6-DIGIT PIN'
                                : '3. ENTER 6-DIGIT PIN',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.3,
                              color: SettingsPage.ink.withValues(alpha: 0.5),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAF9),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: const Color(0xFFDCE3EA),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: List.generate(6, (index) {
                                final filled = index < pin.length;
                                return AnimatedContainer(
                                  duration: const Duration(milliseconds: 120),
                                  margin: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                  ),
                                  width: 14,
                                  height: 14,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: filled ? accent : Colors.transparent,
                                    border: Border.all(
                                      color: filled ? accent : Colors.black26,
                                      width: 1.6,
                                    ),
                                  ),
                                );
                              }),
                            ),
                          ),
                          const SizedBox(height: 10),
                          for (final row in const [
                            ['1', '2', '3'],
                            ['4', '5', '6'],
                            ['7', '8', '9'],
                          ]) ...[
                            Row(
                              children: [
                                for (var i = 0; i < row.length; i++) ...[
                                  if (i > 0) const SizedBox(width: 8),
                                  Expanded(
                                    child: _PinKeypadButton(
                                      label: row[i],
                                      onTap: () => _appendDigit(row[i]),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 8),
                          ],
                          Row(
                            children: [
                              Expanded(
                                child: _PinKeypadButton(
                                  label: 'Clear',
                                  isAction: true,
                                  onTap: _clearPin,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _PinKeypadButton(
                                  label: '0',
                                  onTap: () => _appendDigit('0'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _PinKeypadButton(
                                  icon: Icons.backspace_outlined,
                                  isAction: true,
                                  onTap: _backspace,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          FilledButton(
                            onPressed: selected == null || pin.length != 6
                                ? null
                                : _submit,
                            style: FilledButton.styleFrom(
                              backgroundColor: accent,
                              minimumSize: const Size.fromHeight(48),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              textStyle: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            child: Text(
                              widget.reopening
                                  ? 'Reopen outlet'
                                  : 'Confirm emergency closure',
                            ),
                          ),
                        ],
                      );

                      if (constraints.maxWidth >= 560) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 6, child: leftColumn),
                            const SizedBox(width: 20),
                            Expanded(flex: 5, child: pinPad),
                          ],
                        );
                      }
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          leftColumn,
                          const SizedBox(height: 18),
                          pinPad,
                        ],
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
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
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    if (widget.baristas.length == 1) {
      selected = widget.baristas.first;
    }
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  void _appendDigit(String digit) {
    if (pin.length >= 6) return;
    setState(() => pin += digit);
  }

  void _backspace() {
    if (pin.isEmpty) return;
    setState(() => pin = pin.substring(0, pin.length - 1));
  }

  void _clearPin() {
    if (pin.isEmpty) return;
    setState(() => pin = '');
  }

  void _submit() {
    if (selected == null || pin.length != 6) return;
    Navigator.pop(context, _AttendanceAction(selected!, pin));
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final key = event.logicalKey;
    if (key == LogicalKeyboardKey.backspace) {
      _backspace();
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.enter ||
        key == LogicalKeyboardKey.numpadEnter) {
      _submit();
      return KeyEventResult.handled;
    }
    final char = event.character;
    if (char != null && RegExp(r'^[0-9]$').hasMatch(char)) {
      _appendDigit(char);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.clockIn
        ? SettingsPage.green
        : const Color(0xFFB54E3D);
    final nowLabel = TimeOfDay.fromDateTime(DateTime.now()).format(context);

    return Focus(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: _handleKey,
      child: Dialog(
        backgroundColor: Colors.white,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Branded Header
                Container(
                  padding: const EdgeInsets.fromLTRB(24, 18, 20, 18),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: widget.clockIn
                          ? const [Color(0xFF173F3A), Color(0xFF304A3A)]
                          : const [Color(0xFF933728), Color(0xFFB54E3D)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(
                          widget.clockIn
                              ? Icons.login_rounded
                              : Icons.logout_rounded,
                          color: Colors.white,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.clockIn ? 'Clock in' : 'Clock out',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 21,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              widget.clockIn
                                  ? 'Select your profile and tap your 6-digit PIN'
                                  : 'Confirm your profile and PIN to end shift',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.85),
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          nowLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      IconButton(
                        tooltip: 'Close',
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(
                          Icons.close_rounded,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),

                if (widget.baristas.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        const Text(
                          'No eligible barista profiles are available. Ask an administrator to set up the profile PIN.',
                        ),
                        const SizedBox(height: 16),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Close'),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.all(22),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final baristaSelector = Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              '1. SELECT BARISTA',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.3,
                                color: SettingsPage.ink.withValues(alpha: 0.5),
                              ),
                            ),
                            const SizedBox(height: 10),
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxHeight: 260),
                              child: ListView.separated(
                                shrinkWrap: true,
                                itemCount: widget.baristas.length,
                                separatorBuilder: (_, _) =>
                                    const SizedBox(height: 8),
                                itemBuilder: (_, index) {
                                  final barista = widget.baristas[index];
                                  final isSelected = selected?.id == barista.id;
                                  return Material(
                                    color: isSelected
                                        ? accent.withValues(alpha: 0.08)
                                        : const Color(0xFFF8FAF9),
                                    borderRadius: BorderRadius.circular(14),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(14),
                                      onTap: () =>
                                          setState(() => selected = barista),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 10,
                                        ),
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(
                                            14,
                                          ),
                                          border: Border.all(
                                            color: isSelected
                                                ? accent
                                                : const Color(0xFFDCE3EA),
                                            width: isSelected ? 1.8 : 1,
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            CircleAvatar(
                                              radius: 17,
                                              backgroundColor: isSelected
                                                  ? accent
                                                  : accent.withValues(
                                                      alpha: 0.14,
                                                    ),
                                              child: Text(
                                                barista.name.isEmpty
                                                    ? '?'
                                                    : barista.name[0]
                                                          .toUpperCase(),
                                                style: TextStyle(
                                                  color: isSelected
                                                      ? Colors.white
                                                      : accent,
                                                  fontWeight: FontWeight.w900,
                                                  fontSize: 14,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Text(
                                                barista.name,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 15,
                                                  fontWeight: FontWeight.w800,
                                                  color: isSelected
                                                      ? accent
                                                      : SettingsPage.ink,
                                                ),
                                              ),
                                            ),
                                            if (isSelected)
                                              Icon(
                                                Icons.check_circle_rounded,
                                                color: accent,
                                                size: 20,
                                              ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        );

                        final pinPad = Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              '2. ENTER 6-DIGIT PIN',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.3,
                                color: SettingsPage.ink.withValues(alpha: 0.5),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAF9),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: const Color(0xFFDCE3EA),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: List.generate(6, (index) {
                                  final filled = index < pin.length;
                                  return AnimatedContainer(
                                    duration: const Duration(milliseconds: 120),
                                    margin: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                    ),
                                    width: 14,
                                    height: 14,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: filled
                                          ? accent
                                          : Colors.transparent,
                                      border: Border.all(
                                        color: filled ? accent : Colors.black26,
                                        width: 1.6,
                                      ),
                                    ),
                                  );
                                }),
                              ),
                            ),
                            const SizedBox(height: 10),
                            for (final row in const [
                              ['1', '2', '3'],
                              ['4', '5', '6'],
                              ['7', '8', '9'],
                            ]) ...[
                              Row(
                                children: [
                                  for (var i = 0; i < row.length; i++) ...[
                                    if (i > 0) const SizedBox(width: 8),
                                    Expanded(
                                      child: _PinKeypadButton(
                                        label: row[i],
                                        onTap: () => _appendDigit(row[i]),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 8),
                            ],
                            Row(
                              children: [
                                Expanded(
                                  child: _PinKeypadButton(
                                    label: 'Clear',
                                    isAction: true,
                                    onTap: _clearPin,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _PinKeypadButton(
                                    label: '0',
                                    onTap: () => _appendDigit('0'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _PinKeypadButton(
                                    icon: Icons.backspace_outlined,
                                    isAction: true,
                                    onTap: _backspace,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            FilledButton.icon(
                              onPressed: selected == null || pin.length != 6
                                  ? null
                                  : _submit,
                              icon: Icon(
                                widget.clockIn
                                    ? Icons.login_rounded
                                    : Icons.logout_rounded,
                              ),
                              label: Text(
                                widget.clockIn
                                    ? 'Clock in now'
                                    : 'Clock out now',
                              ),
                              style: FilledButton.styleFrom(
                                backgroundColor: accent,
                                minimumSize: const Size.fromHeight(48),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                textStyle: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        );

                        if (constraints.maxWidth >= 520) {
                          return Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(flex: 5, child: baristaSelector),
                              const SizedBox(width: 20),
                              Expanded(flex: 6, child: pinPad),
                            ],
                          );
                        }
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            baristaSelector,
                            const SizedBox(height: 18),
                            pinPad,
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

class _PinKeypadButton extends StatelessWidget {
  const _PinKeypadButton({
    this.label,
    this.icon,
    this.isAction = false,
    required this.onTap,
  });

  final String? label;
  final IconData? icon;
  final bool isAction;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isAction ? const Color(0xFFF1F5F9) : const Color(0xFFF8FAF9),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFDCE3EA)),
          ),
          child: icon != null
              ? Icon(icon, size: 19, color: SettingsPage.ink)
              : Text(
                  label ?? '',
                  style: TextStyle(
                    fontSize: isAction ? 13 : 18,
                    fontWeight: isAction ? FontWeight.w700 : FontWeight.w800,
                    color: isAction ? Colors.black54 : SettingsPage.ink,
                  ),
                ),
        ),
      ),
    );
  }
}

class _SideWorkPinSheet extends StatefulWidget {
  final BaristaSideWorkTask task;
  final List<AttendanceBarista> baristas;

  const _SideWorkPinSheet({required this.task, required this.baristas});

  @override
  State<_SideWorkPinSheet> createState() => _SideWorkPinSheetState();
}

class _SideWorkPinSheetState extends State<_SideWorkPinSheet> {
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Complete task',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            widget.task.title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          const Text(
            'Only a barista who is currently clocked in can confirm this task.',
          ),
          const SizedBox(height: 18),
          if (widget.baristas.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Text(
                'No clocked-in barista with a configured PIN is available. Clock in first or ask an administrator to configure the profile PIN.',
              ),
            )
          else ...[
            DropdownButtonFormField<AttendanceBarista>(
              initialValue: selected,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Completed by',
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
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: selected == null || pin.length != 6
                    ? null
                    : () => Navigator.pop(
                        context,
                        _AttendanceAction(selected!, pin),
                      ),
                icon: const Icon(Icons.task_alt_rounded),
                label: const Text('Confirm completion'),
                style: FilledButton.styleFrom(
                  backgroundColor: SettingsPage.green,
                ),
              ),
            ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
}

// Kept temporarily for compatibility with older workstation layouts.
// ignore: unused_element
class _SideWorkTaskCard extends StatelessWidget {
  final BaristaSideWorkTask task;
  final bool completing;
  final VoidCallback onComplete;

  const _SideWorkTaskCard({
    required this.task,
    required this.completing,
    required this.onComplete,
  });

  @override
  Widget build(BuildContext context) {
    final scheduledTime = _displaySideWorkTime(context, task.scheduledTime);
    final completedBy = task.completedByBaristaName?.trim();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: task.isCompleted
              ? const Color(0xFF3B7C61).withValues(alpha: .35)
              : SettingsPage.ink.withValues(alpha: .10),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                task.isCompleted
                    ? Icons.task_alt_rounded
                    : Icons.cleaning_services_outlined,
                color: task.isCompleted
                    ? const Color(0xFF3B7C61)
                    : SettingsPage.gold,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      task.isCompleted
                          ? 'Completed${completedBy == null || completedBy.isEmpty ? '' : ' by $completedBy'}'
                          : task.isDue
                          ? 'Due now · $scheduledTime'
                          : 'Available at $scheduledTime',
                      style: TextStyle(
                        color: task.isCompleted
                            ? const Color(0xFF3B7C61)
                            : SettingsPage.ink.withValues(alpha: .62),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (task.instructions.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(task.instructions, style: const TextStyle(height: 1.35)),
          ],
          if (!task.isCompleted) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: task.isDue && !completing ? onComplete : null,
                icon: completing
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.done_rounded),
                label: Text(task.isDue ? 'Complete task' : 'Not due yet'),
                style: FilledButton.styleFrom(
                  backgroundColor: SettingsPage.green,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ignore: unused_element
class _SideWorkMessageCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SideWorkMessageCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: SettingsPage.ink.withValues(alpha: .10)),
    ),
    child: Row(
      children: [
        Icon(icon, color: SettingsPage.gold),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 3),
              Text(subtitle),
            ],
          ),
        ),
      ],
    ),
  );
}

String _displaySideWorkTime(BuildContext context, String value) {
  final parts = value.split(':');
  if (parts.length < 2) return value;
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) return value;
  return TimeOfDay(hour: hour, minute: minute).format(context);
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

  void _openLightbox(BuildContext context, String title, String url) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog(
        backgroundColor: Colors.black.withValues(alpha: 0.92),
        insetPadding: const EdgeInsets.all(20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Close',
                        onPressed: () => Navigator.pop(dialogContext),
                        icon: const Icon(
                          Icons.close_rounded,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: InteractiveViewer(
                      minScale: 0.8,
                      maxScale: 4.0,
                      child: Center(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(
                            url,
                            fit: BoxFit.contain,
                            errorBuilder: (_, _, _) => const Icon(
                              Icons.broken_image_outlined,
                              color: Colors.white54,
                              size: 48,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDrinkLibrary = widget.title == 'Drink SOPs';
    final visibleGuides = _searchQuery.trim().isNotEmpty
        ? widget.guides
              .where(
                (guide) =>
                    '${guide.menuItemName ?? ''} ${guide.guideTitle ?? ''} ${widget.title}'
                        .toLowerCase()
                        .contains(_searchQuery.trim().toLowerCase()),
              )
              .toList()
        : widget.guides;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final wideHeader = constraints.maxWidth >= 680;
              final titleBlock = Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              widget.title,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                color: SettingsPage.ink,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: SettingsPage.ink.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                '${visibleGuides.length}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: SettingsPage.ink,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        const Text(
                          'Images are maintained by your operations administrator. Tap any guide to zoom.',
                          style: TextStyle(color: Colors.black54, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  if (!wideHeader)
                    IconButton(
                      tooltip: 'Close',
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded),
                    ),
                ],
              );

              final searchField = TextField(
                onChanged: (value) => setState(() => _searchQuery = value),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: isDrinkLibrary
                      ? 'Search drink SOPs'
                      : 'Search guides',
                  isDense: true,
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
              );

              if (wideHeader) {
                return Row(
                  children: [
                    Expanded(child: titleBlock),
                    const SizedBox(width: 16),
                    SizedBox(width: 300, child: searchField),
                    const SizedBox(width: 8),
                    IconButton(
                      tooltip: 'Close',
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [titleBlock, const SizedBox(height: 14), searchField],
              );
            },
          ),
          const SizedBox(height: 18),
          Expanded(
            child: visibleGuides.isEmpty
                ? const Center(
                    child: Text('No matching guide images were found.'),
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      final maxCols = visibleGuides.length == 1
                          ? 1
                          : constraints.maxWidth >= 900
                          ? 3
                          : constraints.maxWidth >= 560
                          ? 2
                          : 1;

                      if (maxCols == 1) {
                        return ListView.separated(
                          itemCount: visibleGuides.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 16),
                          itemBuilder: (_, index) {
                            final guide = visibleGuides[index];
                            final url = ApiService.resolveAssetUrl(
                              guide.imageUrl,
                            );
                            final guideTitle =
                                guide.menuItemName ??
                                guide.guideTitle ??
                                widget.title;
                            return _GuideImageCard(
                              title: guideTitle,
                              imageUrl: url,
                              onTap: () =>
                                  _openLightbox(context, guideTitle, url),
                            );
                          },
                        );
                      }

                      return GridView.builder(
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: maxCols,
                          crossAxisSpacing: 16,
                          mainAxisSpacing: 16,
                          childAspectRatio: 0.78,
                        ),
                        itemCount: visibleGuides.length,
                        itemBuilder: (_, index) {
                          final guide = visibleGuides[index];
                          final url = ApiService.resolveAssetUrl(
                            guide.imageUrl,
                          );
                          final guideTitle =
                              guide.menuItemName ??
                              guide.guideTitle ??
                              widget.title;
                          return _GuideImageCard(
                            title: guideTitle,
                            imageUrl: url,
                            expandImage: true,
                            onTap: () =>
                                _openLightbox(context, guideTitle, url),
                          );
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _GuideImageCard extends StatelessWidget {
  const _GuideImageCard({
    required this.title,
    required this.imageUrl,
    required this.onTap,
    this.expandImage = false,
  });

  final String title;
  final String imageUrl;
  final VoidCallback onTap;
  final bool expandImage;

  @override
  Widget build(BuildContext context) {
    final image = ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Image.network(
        imageUrl,
        fit: BoxFit.contain,
        errorBuilder: (_, _, _) => const SizedBox(
          height: 180,
          child: Center(child: Icon(Icons.broken_image_outlined)),
        ),
      ),
    );

    return Material(
      color: const Color(0xFFFAFBFC),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(color: SettingsPage.ink.withValues(alpha: .12)),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: SettingsPage.ink,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.zoom_in_rounded,
                    size: 18,
                    color: SettingsPage.ink.withValues(alpha: 0.45),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (expandImage) Expanded(child: image) else image,
            ],
          ),
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

// ignore: unused_element
class _OperationsLoadingCard extends StatelessWidget {
  const _OperationsLoadingCard();

  @override
  Widget build(BuildContext context) {
    return const _OperationsCard(
      icon: Icons.sync_rounded,
      title: 'Checking operational connections',
      subtitle: 'Loading today\'s coverage.',
    );
  }
}

// ignore: unused_element
class _OperationsUnavailableCard extends StatelessWidget {
  const _OperationsUnavailableCard();

  @override
  Widget build(BuildContext context) {
    return const _OperationsCard(
      icon: Icons.cloud_off_rounded,
      title: 'Internet connection issue',
      subtitle:
          'The published timetable could not be loaded from the server. Check the connection and refresh; no fallback timetable is shown.',
    );
  }
}

// ignore: unused_element
class _OperationsStatusCard extends StatelessWidget {
  final OperationsContext context;
  final VoidCallback onRefresh;

  const _OperationsStatusCard({required this.context, required this.onRefresh});

  @override
  Widget build(BuildContext buildContext) {
    final now = DateTime.now();
    final todayLabels =
        (context.scheduledShifts
                .where((entry) => entry.shiftDate == _dateKey(now))
                .toList()
              ..sort((left, right) => left.startsAt.compareTo(right.startsAt)))
            .map(_datedScheduleLabel)
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
            icon: Icons.calendar_month_outlined,
            title: 'Today\'s coverage',
            value: todayLabels.isEmpty
                ? 'No shift published for today'
                : todayLabels.join(' · '),
            connected: todayLabels.isNotEmpty,
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
                  label: const Text('View timetable'),
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

  static String _datedScheduleLabel(DatedShiftEntry entry) =>
      '${entry.baristaName} ${entry.startsAt}-${entry.endsAt}';

  static String _dateKey(DateTime value) {
    String pad(int part) => part.toString().padLeft(2, '0');
    return '${value.year}-${pad(value.month)}-${pad(value.day)}';
  }

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

    final today = DateTime.now();
    final monday = DateTime(
      today.year,
      today.month,
      today.day,
    ).subtract(Duration(days: today.weekday - 1));

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
                        'Published timetable',
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
                  'This week\'s dated shifts published by operations.',
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: ListView.separated(
                    itemCount: dayNames.length,
                    separatorBuilder: (_, _) => const Divider(height: 20),
                    itemBuilder: (_, index) {
                      final date = monday.add(Duration(days: index));
                      final labels =
                          (operations.scheduledShifts
                                  .where(
                                    (entry) =>
                                        entry.shiftDate == _dateKey(date),
                                  )
                                  .toList()
                                ..sort(
                                  (left, right) =>
                                      left.startsAt.compareTo(right.startsAt),
                                ))
                              .map(_datedScheduleLabel)
                              .toList();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${dayNames[index]} · ${date.day}/${date.month}',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 6),
                          if (labels.isEmpty)
                            const Text('No shift published')
                          else
                            ...labels.map(
                              (label) => Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Text(label),
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
              'The next staff member will need the shared Barista Workspace login before selecting their name.',
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
