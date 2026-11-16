import 'package:flutter/material.dart';
import 'package:counter_app/widgets/top_notice.dart';

import '../services/api_service.dart';
import '../services/barista_sound_service.dart';
import '../widgets/barista_card.dart';
import '../widgets/barista_page_header.dart';

enum _TasksViewMode { list, schedule }

enum _TaskFilter { all, due, today, upcoming, completed }

class SideWorkPage extends StatefulWidget {
  const SideWorkPage({super.key});

  @override
  State<SideWorkPage> createState() => _SideWorkPageState();
}

class _SideWorkPageState extends State<SideWorkPage> {
  static const _ink = Color(0xFF203E32);
  static const _green = Color(0xFF304A3A);
  static const _canvas = Colors.white;
  static const _surface = Color(0xFFF6F8F7);
  static const _border = Color(0xFFDCE3EA);

  late Future<List<BaristaSideWorkTask>> _tasks;
  int? _completingTaskId;
  _TasksViewMode _viewMode = _TasksViewMode.list;
  _TaskFilter _filter = _TaskFilter.all;
  DateTime? _selectedWeekStart;

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

  void _refresh() => setState(() {
        _selectedWeekStart = null;
        _tasks = _loadTasks();
      });

  DateTime _mondayOf(DateTime date) {
    final day = DateUtils.dateOnly(date);
    return day.subtract(Duration(days: day.weekday - DateTime.monday));
  }

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
    final action = await showDialog<_SideWorkAction>(
      context: context,
      builder: (_) => _SideWorkCompletionDialog(task: task, baristas: baristas),
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
      TopNotice.success(context, 'Task completed.');
    } else {
      TopNotice.error(context, result.errorMessage!);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _canvas,
      body: RefreshIndicator(
        onRefresh: () async {
          _refresh();
          await _tasks;
        },
        child: FutureBuilder<List<BaristaSideWorkTask>>(
          future: _tasks,
          builder: (context, snapshot) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1180),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      BaristaPageHeader(
                        title: 'Daily Tasks',
                        subtitle:
                            'Store cleaning, maintenance, and routine tasks. Completion is recorded against the clocked-in barista.',
                        onRefresh: _refresh,
                        refreshTooltip: 'Refresh tasks',
                      ),
                      const SizedBox(height: 20),
                      _buildContent(context, snapshot),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(
    BuildContext context,
    AsyncSnapshot<List<BaristaSideWorkTask>> snapshot,
  ) {
    if (snapshot.hasError) {
      return BaristaCard(
        padding: const EdgeInsets.all(20),
        child: _StatusMessage(
          icon: Icons.cloud_off_rounded,
          title: 'Internet connection issue',
          message:
              'Tasks could not be loaded. Check the connection and refresh.',
          onRetry: _refresh,
        ),
      );
    }
    if (!snapshot.hasData) {
      return const BaristaCard(
        padding: EdgeInsets.all(20),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 70),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    final tasks = snapshot.data!;
    final now = DateTime.now();
    final today = DateUtils.dateOnly(now);

    final dueTasks = tasks
        .where((t) => !t.isCompleted && t.isDue)
        .toList();
    final overdueCount = dueTasks
        .where((t) => _scheduledAt(t).isBefore(now))
        .length;
    final todayCount = tasks
        .where(
          (t) =>
              !t.isCompleted &&
              DateUtils.dateOnly(_scheduledAt(t)) == today,
        )
        .length;
    final upcomingCount = tasks
        .where((t) => !t.isCompleted && !t.isDue)
        .length;
    final completedTasks = tasks.where((t) => t.isCompleted).toList();

    final filteredTasks = tasks.where((task) {
      switch (_filter) {
        case _TaskFilter.all:
          if (!task.isCompleted) return true;
          final completedAt = task.completedAt;
          return completedAt != null &&
              now.difference(completedAt).inHours < 24;
        case _TaskFilter.due:
          return !task.isCompleted && task.isDue;
        case _TaskFilter.today:
          return !task.isCompleted &&
              DateUtils.dateOnly(_scheduledAt(task)) == today;
        case _TaskFilter.upcoming:
          return !task.isCompleted && !task.isDue;
        case _TaskFilter.completed:
          return task.isCompleted;
      }
    }).toList();

    final weekStart = _selectedWeekStart ?? _mondayOf(now);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSummaryStrip(
          dueCount: dueTasks.length,
          overdueCount: overdueCount,
          todayCount: todayCount,
          upcomingCount: upcomingCount,
          completedCount: completedTasks.length,
        ),
        const SizedBox(height: 16),
        BaristaCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildToolbar(weekStart: weekStart),
              const SizedBox(height: 18),
              if (tasks.isEmpty)
                _buildEmptyState(
                  title: 'No tasks scheduled.',
                  subtitle:
                      'Routine tasks and store maintenance will appear here when due.',
                )
              else if (_viewMode == _TasksViewMode.schedule)
                _buildWeeklySchedule(
                  context,
                  tasks: filteredTasks,
                  weekStart: weekStart,
                )
              else if (filteredTasks.isEmpty)
                _buildEmptyState(
                  title: 'No matching tasks.',
                  subtitle: 'Try another filter or switch to the weekly schedule.',
                )
              else
                _buildTaskList(context, filteredTasks, now),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryStrip({
    required int dueCount,
    required int overdueCount,
    required int todayCount,
    required int upcomingCount,
    required int completedCount,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cards = [
          _TaskMetricCard(
            icon: overdueCount > 0
                ? Icons.warning_amber_rounded
                : Icons.bolt_rounded,
            iconColor: overdueCount > 0
                ? const Color(0xFFB42318)
                : dueCount > 0
                ? const Color(0xFF9A6700)
                : Colors.black45,
            label: 'Due now',
            value: '$dueCount',
            detail: overdueCount > 0
                ? '$overdueCount overdue'
                : 'Ready to complete',
            highlightColor: overdueCount > 0
                ? const Color(0xFFFEF3F2)
                : dueCount > 0
                ? const Color(0xFFFFFAEB)
                : null,
            highlightBorder: overdueCount > 0
                ? const Color(0xFFFECDCA)
                : dueCount > 0
                ? const Color(0xFFFEDF89)
                : null,
          ),
          _TaskMetricCard(
            icon: Icons.today_rounded,
            iconColor: _ink,
            label: 'Today',
            value: '$todayCount',
            detail: 'Active for today',
          ),
          _TaskMetricCard(
            icon: Icons.event_note_rounded,
            iconColor: const Color(0xFF1E5F8A),
            label: 'Upcoming (31d)',
            value: '$upcomingCount',
            detail: 'Scheduled ahead',
          ),
          _TaskMetricCard(
            icon: Icons.task_alt_rounded,
            iconColor: const Color(0xFF15803D),
            label: 'Completed',
            value: '$completedCount',
            detail: 'Finished in window',
          ),
        ];

        if (constraints.maxWidth < 720) {
          return Wrap(
            spacing: 12,
            runSpacing: 12,
            children: cards
                .map(
                  (c) => SizedBox(
                    width: (constraints.maxWidth - 12) / 2,
                    child: c,
                  ),
                )
                .toList(),
          );
        }

        return Row(
          children: [
            for (var i = 0; i < cards.length; i++) ...[
              Expanded(child: cards[i]),
              if (i < cards.length - 1) const SizedBox(width: 12),
            ],
          ],
        );
      },
    );
  }

  Widget _buildToolbar({required DateTime weekStart}) {
    final weekEnd = weekStart.add(const Duration(days: 6));
    final currentWeek = _mondayOf(DateTime.now());
    final isCurrentWeek = weekStart == currentWeek;

    return Wrap(
      spacing: 12,
      runSpacing: 12,
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        SegmentedButton<_TasksViewMode>(
          segments: const [
            ButtonSegment(
              value: _TasksViewMode.list,
              icon: Icon(Icons.checklist_rounded, size: 18),
              label: Text('Task list'),
            ),
            ButtonSegment(
              value: _TasksViewMode.schedule,
              icon: Icon(Icons.calendar_view_week_rounded, size: 18),
              label: Text('Weekly schedule'),
            ),
          ],
          selected: {_viewMode},
          onSelectionChanged: (selection) {
            setState(() => _viewMode = selection.first);
          },
        ),
        if (_viewMode == _TasksViewMode.schedule)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            decoration: BoxDecoration(
              color: _surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: 'Previous week',
                  visualDensity: VisualDensity.compact,
                  onPressed: () {
                    setState(() {
                      _selectedWeekStart = weekStart.subtract(
                        const Duration(days: 7),
                      );
                    });
                  },
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    '${_shortDateLabel(weekStart)} – ${_shortDateLabel(weekEnd)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: _ink,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Next week',
                  visualDensity: VisualDensity.compact,
                  onPressed: () {
                    setState(() {
                      _selectedWeekStart = weekStart.add(
                        const Duration(days: 7),
                      );
                    });
                  },
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
                if (!isCurrentWeek) ...[
                  const SizedBox(width: 4),
                  TextButton(
                    onPressed: () {
                      setState(() => _selectedWeekStart = currentWeek);
                    },
                    style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                    ),
                    child: const Text('Today'),
                  ),
                ],
              ],
            ),
          ),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final entry in const [
              (_TaskFilter.all, 'All'),
              (_TaskFilter.due, 'Due now'),
              (_TaskFilter.today, 'Today'),
              (_TaskFilter.upcoming, 'Upcoming'),
              (_TaskFilter.completed, 'Completed'),
            ])
              ChoiceChip(
                label: Text(entry.$2),
                selected: _filter == entry.$1,
                onSelected: (_) => setState(() => _filter = entry.$1),
              ),
          ],
        ),
      ],
    );
  }

  Widget _buildEmptyState({required String title, required String subtitle}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 44, horizontal: 20),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.checklist_rounded,
              size: 48,
              color: _ink.withValues(alpha: 0.25),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: const TextStyle(
                color: _ink,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: _ink.withValues(alpha: 0.6),
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWeeklySchedule(
    BuildContext context, {
    required List<BaristaSideWorkTask> tasks,
    required DateTime weekStart,
  }) {
    final days = List.generate(
      7,
      (i) => DateUtils.dateOnly(weekStart.add(Duration(days: i))),
    );
    final today = DateUtils.dateOnly(DateTime.now());
    final byDay = <DateTime, List<BaristaSideWorkTask>>{};
    for (final task in tasks) {
      final day = DateUtils.dateOnly(_scheduledAt(task));
      if (day.isBefore(days.first) || day.isAfter(days.last)) continue;
      byDay.putIfAbsent(day, () => []).add(task);
    }
    for (final list in byDay.values) {
      list.sort((a, b) => a.scheduledTime.compareTo(b.scheduledTime));
    }

    const minColWidth = 152.0;
    const minTableWidth = minColWidth * 7;

    return LayoutBuilder(
      builder: (context, constraints) {
        final tableWidth = constraints.maxWidth > minTableWidth
            ? constraints.maxWidth
            : minTableWidth;
        final colWidth = tableWidth / 7;

        return ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(color: _border),
              borderRadius: BorderRadius.circular(16),
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                width: tableWidth,
                child: Column(
                  children: [
                    Container(
                      decoration: const BoxDecoration(
                        color: _surface,
                        border: Border(bottom: BorderSide(color: _border)),
                      ),
                      child: Row(
                        children: [
                          for (var i = 0; i < days.length; i++)
                            Container(
                              width: colWidth,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: days[i] == today
                                    ? _ink.withValues(alpha: 0.08)
                                    : null,
                                border: i == 0
                                    ? null
                                    : const Border(
                                        left: BorderSide(color: _border),
                                      ),
                              ),
                              child: Column(
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        _weekdayShort(days[i].weekday),
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                          color: days[i] == today
                                              ? _ink
                                              : Colors.black54,
                                        ),
                                      ),
                                      if (days[i] == today) ...[
                                        const SizedBox(width: 5),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 6,
                                            vertical: 1,
                                          ),
                                          decoration: BoxDecoration(
                                            color: _ink,
                                            borderRadius: BorderRadius.circular(
                                              999,
                                            ),
                                          ),
                                          child: const Text(
                                            'TODAY',
                                            style: TextStyle(
                                              fontSize: 9,
                                              fontWeight: FontWeight.w800,
                                              color: Colors.white,
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _shortDateLabel(days[i]),
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: days[i] == today
                                          ? _ink
                                          : Colors.black87,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (var i = 0; i < days.length; i++)
                            Container(
                              width: colWidth,
                              constraints: const BoxConstraints(minHeight: 160),
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: days[i] == today
                                    ? _ink.withValues(alpha: 0.03)
                                    : Colors.white,
                                border: i == 0
                                    ? null
                                    : const Border(
                                        left: BorderSide(color: _border),
                                      ),
                              ),
                              child: (byDay[days[i]] ?? const []).isEmpty
                                  ? const Center(
                                      child: Text(
                                        '—',
                                        style: TextStyle(
                                          color: Colors.black26,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    )
                                  : Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        for (final task in byDay[days[i]]!)
                                          _ScheduleTaskPill(
                                            task: task,
                                            timeLabel: _displayTime(
                                              context,
                                              task.scheduledTime,
                                            ),
                                            completing:
                                                _completingTaskId == task.id,
                                            onTap:
                                                !task.isCompleted && task.isDue
                                                ? () => _completeTask(task)
                                                : null,
                                          ),
                                      ],
                                    ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildTaskList(
    BuildContext context,
    List<BaristaSideWorkTask> filteredTasks,
    DateTime now,
  ) {
    final activeTasks = filteredTasks.where((t) => !t.isCompleted).toList()
      ..sort((a, b) => _scheduledAt(a).compareTo(_scheduledAt(b)));
    final completedTasks = filteredTasks.where((t) => t.isCompleted).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final task in activeTasks)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _TaskCard(
              task: task,
              completing: _completingTaskId == task.id,
              onComplete: () => _completeTask(task),
            ),
          ),
        if (completedTasks.isNotEmpty) ...[
          if (activeTasks.isNotEmpty) const SizedBox(height: 10),
          const BaristaSectionLabel(label: 'COMPLETED'),
          const SizedBox(height: 12),
          for (final task in completedTasks)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _TaskCard(
                task: task,
                completing: false,
                onComplete: () {},
              ),
            ),
        ],
      ],
    );
  }
}

class _TaskMetricCard extends StatelessWidget {
  const _TaskMetricCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.detail,
    this.highlightColor,
    this.highlightBorder,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final String detail;
  final Color? highlightColor;
  final Color? highlightBorder;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: highlightColor ?? Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: highlightBorder ?? const Color(0xFFDCE3EA),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Colors.black54,
                  ),
                ),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF203E32),
                    height: 1.15,
                  ),
                ),
                Text(
                  detail,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11, color: Colors.black54),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ScheduleTaskPill extends StatelessWidget {
  const _ScheduleTaskPill({
    required this.task,
    required this.timeLabel,
    required this.completing,
    required this.onTap,
  });

  final BaristaSideWorkTask task;
  final String timeLabel;
  final bool completing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final overdue =
        !task.isCompleted &&
        task.isDue &&
        _scheduledAt(task).isBefore(DateTime.now());
    final isDueNow = !task.isCompleted && task.isDue && !overdue;

    final Color bg;
    final Color border;
    final Color accent;
    final String statusText;

    if (task.isCompleted) {
      bg = const Color(0xFFECFDF3);
      border = const Color(0xFF86EFAC);
      accent = const Color(0xFF166534);
      statusText = 'Done';
    } else if (overdue) {
      bg = const Color(0xFFFEF3F2);
      border = const Color(0xFFFECDCA);
      accent = const Color(0xFFB42318);
      statusText = 'Overdue';
    } else if (isDueNow) {
      bg = const Color(0xFFFFFAEB);
      border = const Color(0xFFFEDF89);
      accent = const Color(0xFF9A6700);
      statusText = 'Due now';
    } else {
      bg = const Color(0xFFF8FAFC);
      border = const Color(0xFFDCE3EA);
      accent = const Color(0xFF203E32);
      statusText = 'Upcoming';
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: completing ? null : onTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      timeLabel,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: accent,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 5,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        completing ? '...' : statusText,
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: accent,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  task.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1F2937),
                    height: 1.25,
                  ),
                ),
                if (onTap != null) ...[
                  const SizedBox(height: 5),
                  Text(
                    'Tap to complete',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: accent,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
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
    final overdue =
        !task.isCompleted &&
        task.isDue &&
        _scheduledAt(task).isBefore(DateTime.now());
    return BaristaCard(
      borderColor: task.isCompleted
          ? const Color(0xFF9AD7B2)
          : overdue
          ? const Color(0xFFFECDCA)
          : const Color(0xFF203E32).withValues(alpha: 0.10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: task.isCompleted
                  ? const Color(0xFFDDF5E6)
                  : overdue
                  ? const Color(0xFFFEF3F2)
                  : const Color(0xFFF7F1E7),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              task.isCompleted
                  ? Icons.task_alt_rounded
                  : overdue
                  ? Icons.warning_amber_rounded
                  : Icons.cleaning_services_outlined,
              color: task.isCompleted
                  ? const Color(0xFF28734A)
                  : overdue
                  ? const Color(0xFFB42318)
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
                  overdue
                      ? 'Overdue · ${_displayDate(task.scheduledDate)} at ${_displayTime(context, task.scheduledTime)}'
                      : '${_displayDate(task.scheduledDate)} at ${_displayTime(context, task.scheduledTime)}',
                  style: TextStyle(
                    color: overdue
                        ? const Color(0xFFB42318)
                        : _SideWorkPageState._green,
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
                      label: Text(
                        overdue
                            ? 'Complete overdue task'
                            : task.isDue
                            ? 'Complete task'
                            : 'Not due yet',
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: overdue
                            ? const Color(0xFFB42318)
                            : _SideWorkPageState._green,
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

DateTime _scheduledAt(BaristaSideWorkTask task) {
  final date = DateTime.tryParse(
    '${task.scheduledDate}T${task.scheduledTime}:00',
  );
  return date ?? DateTime.now();
}

class _SideWorkAction {
  const _SideWorkAction(this.barista, this.pin);
  final AttendanceBarista barista;
  final String pin;
}

class _SideWorkCompletionDialog extends StatefulWidget {
  const _SideWorkCompletionDialog({required this.task, required this.baristas});
  final BaristaSideWorkTask task;
  final List<AttendanceBarista> baristas;

  @override
  State<_SideWorkCompletionDialog> createState() =>
      _SideWorkCompletionDialogState();
}

class _SideWorkCompletionDialogState extends State<_SideWorkCompletionDialog> {
  AttendanceBarista? _selected;
  String _pin = '';

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 18, 22, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Complete task',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 2),
              Text(
                widget.task.title,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: Colors.black54),
              ),
              const SizedBox(height: 14),
              if (widget.baristas.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'No clocked-in barista with a configured PIN is available. Clock in first or call an administrator.',
                  ),
                )
              else
                LayoutBuilder(
                  builder: (context, constraints) {
                    final baristaField =
                        DropdownButtonFormField<AttendanceBarista>(
                          initialValue: _selected,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Completed by',
                            isDense: true,
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
                          onChanged: (value) =>
                              setState(() => _selected = value),
                        );
                    final pinField = TextField(
                      scrollPadding: const EdgeInsets.only(bottom: 120),
                      keyboardType: TextInputType.number,
                      obscureText: true,
                      maxLength: 6,
                      onChanged: (value) => setState(
                        () => _pin = value.replaceAll(RegExp(r'[^0-9]'), ''),
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Six-digit PIN',
                        isDense: true,
                        border: OutlineInputBorder(),
                        counterText: '',
                      ),
                    );

                    if (constraints.maxWidth >= 420) {
                      return Row(
                        children: [
                          Expanded(flex: 3, child: baristaField),
                          const SizedBox(width: 12),
                          Expanded(flex: 2, child: pinField),
                        ],
                      );
                    }
                    return Column(
                      children: [
                        baristaField,
                        const SizedBox(height: 12),
                        pinField,
                      ],
                    );
                  },
                ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                  if (widget.baristas.isNotEmpty) ...[
                    const SizedBox(width: 8),
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
            ],
          ),
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

String _shortDateLabel(DateTime value) =>
    '${value.day} ${_monthShort(value.month)}';

String _weekdayShort(int weekday) {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return names[(weekday - 1).clamp(0, 6)];
}

String _monthShort(int month) {
  const names = [
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
  return names[(month - 1).clamp(0, 11)];
}

String _displayDate(String value) {
  final date = DateTime.tryParse(value);
  if (date == null) return value;
  return '${_weekdayShort(date.weekday)}, ${date.day} ${_monthShort(date.month)} ${date.year}';
}

String _displayTime(BuildContext context, String value) {
  final parts = value.split(':');
  if (parts.length < 2) return value;
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) return value;
  return MaterialLocalizations.of(
    context,
  ).formatTimeOfDay(TimeOfDay(hour: hour, minute: minute));
}
