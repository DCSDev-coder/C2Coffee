import 'package:flutter/material.dart';
import 'package:counter_app/widgets/top_notice.dart';

import '../services/api_service.dart';
import '../services/barista_sound_service.dart';

class SideWorkPage extends StatefulWidget {
  const SideWorkPage({super.key});

  @override
  State<SideWorkPage> createState() => _SideWorkPageState();
}

class _SideWorkPageState extends State<SideWorkPage> {
  static const _ink = Color(0xFF203E32);
  static const _green = Color(0xFF304A3A);
  static const _canvas = Color(0xFFF7F6F1);
  late Future<List<BaristaSideWorkTask>> _tasks;
  int? _completingTaskId;

  @override
  void initState() {
    super.initState();
    _tasks = _loadTasks();
  }

  Future<List<BaristaSideWorkTask>> _loadTasks() {
    final now = DateTime.now();
    final through = DateTime(now.year, now.month, now.day + 30);
    return ApiService.fetchSideWork(from: _dateKey(now), to: _dateKey(through));
  }

  void _refresh() => setState(() => _tasks = _loadTasks());

  Future<void> _completeTask(BaristaSideWorkTask task) async {
    if (_completingTaskId != null || task.isCompleted || !task.isDue) return;
    BaristaAttendanceStatus attendance;
    try {
      attendance = await ApiService.fetchAttendanceStatus();
    } catch (_) {
      if (!mounted) return;
      TopNotice.error(
        context,
        'Unable to check attendance. Check the connection and try again.',
      );
      return;
    }
    if (!mounted) return;
    final activeIds = attendance.activeAttendance
        .map((item) => item.baristaId)
        .toSet();
    final baristas = attendance.baristas
        .where((item) => item.pinConfigured && activeIds.contains(item.id))
        .toList();
    final action = await showModalBottomSheet<_SideWorkAction>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _SideWorkCompletionSheet(task: task, baristas: baristas),
    );
    if (action == null || !mounted) return;

    setState(() => _completingTaskId = task.id);
    final result = await ApiService.completeSideWork(
      taskId: task.id,
      baristaId: action.barista.id,
      pin: action.pin,
    );
    if (!mounted) return;
    setState(() {
      _completingTaskId = null;
      _tasks = _loadTasks();
    });
    if (result.isSuccess) {
      await BaristaSoundService.instance.play(BaristaSoundEvent.sideWork);
    }
    if (!mounted) return;
    if (result.isSuccess) {
      TopNotice.success(context, 'Side-work task completed.');
    } else {
      TopNotice.error(context, result.errorMessage!);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _canvas,
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: () async {
              _refresh();
              await _tasks;
            },
            child: FutureBuilder<List<BaristaSideWorkTask>>(
              future: _tasks,
              builder: (context, snapshot) => ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 150),
                children: [
                  Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 960),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Side work',
                                      style: TextStyle(
                                        color: _ink,
                                        fontSize: 34,
                                        height: 1.05,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                    SizedBox(height: 8),
                                    Text(
                                      'Cleaning and upkeep tasks published by operations.',
                                      style: TextStyle(fontSize: 16),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton.filledTonal(
                                tooltip: 'Refresh side work',
                                onPressed: _refresh,
                                icon: const Icon(Icons.refresh_rounded),
                              ),
                            ],
                          ),
                          const SizedBox(height: 22),
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(
                                color: _ink.withValues(alpha: .10),
                              ),
                            ),
                            child: _buildContent(snapshot),
                          ),
                        ],
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

  Widget _buildContent(AsyncSnapshot<List<BaristaSideWorkTask>> snapshot) {
    if (snapshot.hasError) {
      return _StatusMessage(
        icon: Icons.cloud_off_rounded,
        title: 'Internet connection issue',
        message:
            'Side-work tasks could not be loaded. Check the connection and refresh.',
        onRetry: _refresh,
      );
    }
    if (!snapshot.hasData) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 70),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final tasks = snapshot.data!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Next 31 days',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 5),
        const Text(
          'Completion is recorded against the clocked-in barista who confirms the task.',
          style: TextStyle(color: Colors.black54),
        ),
        const Divider(height: 34),
        if (tasks.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 55),
            child: Center(child: Text('No side work scheduled.')),
          )
        else
          ...tasks.map(
            (task) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _TaskCard(
                task: task,
                completing: _completingTaskId == task.id,
                onComplete: () => _completeTask(task),
              ),
            ),
          ),
      ],
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({
    required this.task,
    required this.completing,
    required this.onComplete,
  });

  final BaristaSideWorkTask task;
  final bool completing;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    final completedBy = task.completedByBaristaName?.trim();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: task.isCompleted ? const Color(0xFFF0FBF4) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: task.isCompleted
              ? const Color(0xFF9AD7B2)
              : const Color(0xFFDCE3EA),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: task.isCompleted
                  ? const Color(0xFFDDF5E6)
                  : const Color(0xFFF7F1E7),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              task.isCompleted
                  ? Icons.task_alt_rounded
                  : Icons.cleaning_services_outlined,
              color: task.isCompleted
                  ? const Color(0xFF28734A)
                  : const Color(0xFFA97D36),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      task.title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (task.isCompleted)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 9,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFD6F5E2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'Completed${completedBy == null || completedBy.isEmpty ? '' : ' by $completedBy'}',
                          style: const TextStyle(
                            color: Color(0xFF28734A),
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${_displayDate(task.scheduledDate)} at ${_displayTime(context, task.scheduledTime)}',
                  style: const TextStyle(
                    color: _SideWorkPageState._green,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (task.instructions.trim().isNotEmpty) ...[
                  const SizedBox(height: 9),
                  Text(task.instructions, style: const TextStyle(height: 1.4)),
                ],
                if (!task.isCompleted) ...[
                  const SizedBox(height: 13),
                  Align(
                    alignment: Alignment.centerLeft,
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
                        backgroundColor: _SideWorkPageState._green,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SideWorkAction {
  const _SideWorkAction(this.barista, this.pin);
  final AttendanceBarista barista;
  final String pin;
}

class _SideWorkCompletionSheet extends StatefulWidget {
  const _SideWorkCompletionSheet({required this.task, required this.baristas});
  final BaristaSideWorkTask task;
  final List<AttendanceBarista> baristas;

  @override
  State<_SideWorkCompletionSheet> createState() =>
      _SideWorkCompletionSheetState();
}

class _SideWorkCompletionSheetState extends State<_SideWorkCompletionSheet> {
  AttendanceBarista? _selected;
  String _pin = '';

  @override
  Widget build(BuildContext context) {
    return SafeArea(
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
              'Complete side work',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(widget.task.title),
            const SizedBox(height: 18),
            if (widget.baristas.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Text(
                  'No clocked-in barista with a configured PIN is available. Clock in first or call an administrator.',
                ),
              )
            else ...[
              DropdownButtonFormField<AttendanceBarista>(
                initialValue: _selected,
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
                onChanged: (value) => setState(() => _selected = value),
              ),
              const SizedBox(height: 14),
              TextField(
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 6,
                onChanged: (value) => setState(
                  () => _pin = value.replaceAll(RegExp(r'[^0-9]'), ''),
                ),
                decoration: const InputDecoration(
                  labelText: 'Six-digit PIN',
                  border: OutlineInputBorder(),
                  counterText: '',
                ),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: _selected == null || _pin.length != 6
                    ? null
                    : () => Navigator.pop(
                        context,
                        _SideWorkAction(_selected!, _pin),
                      ),
                icon: const Icon(Icons.task_alt_rounded),
                label: const Text('Confirm completion'),
                style: FilledButton.styleFrom(
                  backgroundColor: _SideWorkPageState._green,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusMessage extends StatelessWidget {
  const _StatusMessage({
    required this.icon,
    required this.title,
    required this.message,
    required this.onRetry,
  });
  final IconData icon;
  final String title;
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 50),
    child: Column(
      children: [
        Icon(icon, size: 46, color: const Color(0xFFD3B17D)),
        const SizedBox(height: 14),
        Text(
          title,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 6),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Try again'),
        ),
      ],
    ),
  );
}

String _dateKey(DateTime date) {
  String pad(int value) => value.toString().padLeft(2, '0');
  return '${date.year}-${pad(date.month)}-${pad(date.day)}';
}

String _displayDate(String value) {
  final date = DateTime.tryParse(value);
  if (date == null) return value;
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${weekdays[date.weekday - 1]} ${date.day} ${months[date.month - 1]}';
}

String _displayTime(BuildContext context, String value) {
  final parts = value.split(':');
  if (parts.length < 2) return value;
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) return value;
  return TimeOfDay(hour: hour, minute: minute).format(context);
}
