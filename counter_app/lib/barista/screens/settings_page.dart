import 'package:flutter/material.dart';
import 'package:counter_app/widgets/top_notice.dart';

import '../services/api_service.dart';
import '../services/direct_printer_service.dart';
import '../services/push_notification_service.dart';
import '../services/barista_sound_service.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key, required this.onSignedOut});

  final VoidCallback onSignedOut;

  static const Color ink = Color(0xFF203E32);
  static const Color green = Color(0xFF304A3A);
  static const Color gold = Color(0xFFD3B17D);
  static const Color canvas = Color(0xFFF7F6F1);

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late Future<BaristaAttendanceStatus> _attendance;
  bool _attendanceUpdating = false;

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
      await BaristaSoundService.instance.play(
        clockIn ? BaristaSoundEvent.clockIn : BaristaSoundEvent.clockOut,
      );
      if (!mounted) return;
      TopNotice.success(
        context,
        '${barista.name} clocked ${clockIn ? 'in' : 'out'}.',
      );
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
    final action = await showModalBottomSheet<_AttendanceAction>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AttendancePinSheet(clockIn: clockIn, baristas: choices),
    );
    if (action != null && mounted) {
      await _updateAttendance(clockIn, action.barista, action.pin);
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
    widget.onSignedOut();
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
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 148),
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
                    'Manage shift attendance, receipt printing and staff guides.',
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
                  const _SectionLabel(label: 'RECEIPT PRINTER'),
                  const SizedBox(height: 12),
                  const _DirectPrinterCard(),
                  const SizedBox(height: 24),
                  const _SectionLabel(label: 'SHIFT ATTENDANCE'),
                  const SizedBox(height: 12),
                  FutureBuilder<BaristaAttendanceStatus>(
                    future: _attendance,
                    builder: (context, snapshot) {
                      final status = snapshot.data;
                      final active =
                          status?.activeAttendance ??
                          const <BaristaAttendance>[];
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
                              active.isEmpty
                                  ? 'No barista clocked in'
                                  : '${active.length} barista${active.length == 1 ? '' : 's'} clocked in',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              active.isEmpty
                                  ? 'Select your name and enter your six-digit PIN. The shared tablet stays signed in.'
                                  : active
                                        .map(
                                          (item) =>
                                              '${item.baristaName} since ${TimeOfDay.fromDateTime(item.clockedInAt).format(context)}',
                                        )
                                        .join('\n'),
                            ),
                            const SizedBox(height: 14),
                            Row(
                              children: [
                                Expanded(
                                  child: FilledButton.icon(
                                    onPressed:
                                        _attendanceUpdating || status == null
                                        ? null
                                        : () => _openAttendanceSheet(
                                            status,
                                            true,
                                          ),
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
                                        : () => _openAttendanceSheet(
                                            status,
                                            false,
                                          ),
                                    icon: const Icon(Icons.logout_rounded),
                                    label: const Text('Clock out'),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: const Color(0xFFB54E3D),
                                    ),
                                  ),
                                ),
                              ],
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
        ],
      ),
    );
  }
}

class _DirectPrinterCard extends StatefulWidget {
  const _DirectPrinterCard();

  @override
  State<_DirectPrinterCard> createState() => _DirectPrinterCardState();
}

class _DirectPrinterCardState extends State<_DirectPrinterCard> {
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
    final sunmiAvailable =
        await DirectPrinterService.instance.isSunmiAvailable();
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
      TopNotice.error(context, 'Enter a valid printer IP address and port.');
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
                color: SettingsPage.green.withValues(alpha: .08),
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
                color: SettingsPage.green.withValues(alpha: .08),
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
          Text(
            widget.clockIn ? 'Clock in' : 'Clock out',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            widget.clockIn
                ? 'Select your name, then enter your six-digit PIN.'
                : 'Confirm your name and PIN to end your shift.',
          ),
          const SizedBox(height: 18),
          if (widget.baristas.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Text(
                'No eligible barista profiles are available. Ask an administrator to set up the profile PIN.',
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
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: selected == null || pin.length != 6
                    ? null
                    : () => Navigator.pop(
                        context,
                        _AttendanceAction(selected!, pin),
                      ),
                style: FilledButton.styleFrom(
                  backgroundColor: widget.clockIn
                      ? SettingsPage.green
                      : const Color(0xFFB54E3D),
                ),
                child: Text(widget.clockIn ? 'Clock in now' : 'Clock out now'),
              ),
            ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
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
            'Complete side work',
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
                hintText: isDrinkLibrary
                    ? 'Search drink SOPs'
                    : 'Search guides',
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
                          guide.menuItemName ??
                          guide.guideTitle ??
                          widget.title;
                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: SettingsPage.ink.withValues(alpha: .12),
                          ),
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
                                  child: Center(
                                    child: Icon(Icons.broken_image_outlined),
                                  ),
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
