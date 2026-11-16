import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../widgets/barista_card.dart';
import '../widgets/barista_page_header.dart';

enum _TimetableViewMode { timetable, dailyLog }

class TimetablePage extends StatefulWidget {
  const TimetablePage({super.key});

  @override
  State<TimetablePage> createState() => _TimetablePageState();
}

class _TimetablePageState extends State<TimetablePage> {
  static const _ink = Color(0xFF203E32);
  static const _canvas = Colors.white;
  static const _surface = Color(0xFFF6F8F7);
  static const _border = Color(0xFFDCE3EA);

  static const _staffPalette = <Color>[
    Color(0xFF1F5E4B),
    Color(0xFF1E5F8A),
    Color(0xFF8C5A1E),
    Color(0xFF6B3E8E),
    Color(0xFF9E3B42),
    Color(0xFF2E6F6D),
  ];

  late Future<List<AttendanceHistoryEntry>> _attendance;
  _TimetableViewMode _viewMode = _TimetableViewMode.timetable;
  DateTime? _selectedWeekStart;
  String? _selectedBarista;

  @override
  void initState() {
    super.initState();
    _attendance = ApiService.fetchAttendanceHistory();
  }

  void _refresh() {
    setState(() {
      _selectedWeekStart = null;
      _attendance = ApiService.fetchAttendanceHistory();
    });
  }

  DateTime _mondayOf(DateTime date) {
    final day = DateUtils.dateOnly(date);
    return day.subtract(Duration(days: day.weekday - DateTime.monday));
  }

  DateTime _defaultWeekStart(List<AttendanceHistoryEntry> entries) {
    final currentWeek = _mondayOf(DateTime.now());
    final hasCurrentWeek = entries.any(
      (e) => _mondayOf(e.clockedInAt) == currentWeek,
    );
    if (hasCurrentWeek || entries.isEmpty) return currentWeek;
    final latest = entries
        .map((e) => e.clockedInAt)
        .reduce((a, b) => a.isAfter(b) ? a : b);
    return _mondayOf(latest);
  }

  Color _colorForBarista(String name, List<String> allBaristas) {
    final index = allBaristas.indexOf(name);
    if (index < 0) return _staffPalette.first;
    return _staffPalette[index % _staffPalette.length];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _canvas,
      body: RefreshIndicator(
        onRefresh: () async {
          _refresh();
          await _attendance;
        },
        child: FutureBuilder<List<AttendanceHistoryEntry>>(
          future: _attendance,
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
                        title: 'Attendance timetable',
                        subtitle:
                            'Weekly shift schedule and clock-in records from the last 31 days.',
                        onRefresh: _refresh,
                        refreshTooltip: 'Refresh attendance timetable',
                      ),
                      const SizedBox(height: 20),
                      _buildBody(context, snapshot),
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

  Widget _buildBody(
    BuildContext context,
    AsyncSnapshot<List<AttendanceHistoryEntry>> snapshot,
  ) {
    if (snapshot.hasError) {
      final error = snapshot.error;
      final detail = error is StateError && error.message.trim().isNotEmpty
          ? error.message
          : 'Attendance history could not be loaded. Check the connection and refresh.';
      return BaristaCard(
        padding: const EdgeInsets.all(20),
        child: _StatusMessage(
          icon: Icons.cloud_off_rounded,
          title: 'Unable to load attendance timetable',
          message: detail,
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
    final allEntries = snapshot.data!;
    if (allEntries.isEmpty) {
      return const BaristaCard(
        padding: EdgeInsets.all(20),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 48),
          child: Center(child: Text('No attendance records yet.')),
        ),
      );
    }

    final baristas =
        allEntries.map((e) => e.baristaName).toSet().toList()..sort();
    final selectedBarista =
        _selectedBarista != null && baristas.contains(_selectedBarista)
            ? _selectedBarista
            : null;
    final filteredEntries = selectedBarista == null
        ? allEntries
        : allEntries.where((e) => e.baristaName == selectedBarista).toList();
    final weekStart = _selectedWeekStart ?? _defaultWeekStart(allEntries);

    final activeEntries = allEntries
        .where((e) => e.clockedOutAt == null)
        .toList();
    final totalDuration = filteredEntries.fold<Duration>(
      Duration.zero,
      (sum, entry) => sum + _shiftDuration(entry),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSummaryStrip(
          activeEntries: activeEntries,
          shiftCount: filteredEntries.length,
          totalDuration: totalDuration,
          staffCount: baristas.length,
        ),
        const SizedBox(height: 16),
        BaristaCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildToolbar(
                context,
                baristas: baristas,
                selectedBarista: selectedBarista,
                weekStart: weekStart,
              ),
              const SizedBox(height: 18),
              if (_viewMode == _TimetableViewMode.timetable)
                _buildTimetableGrid(
                  context,
                  entries: filteredEntries,
                  baristas: selectedBarista == null
                      ? baristas
                      : [selectedBarista],
                  allBaristas: baristas,
                  weekStart: weekStart,
                )
              else
                _buildDailyLog(
                  context,
                  entries: filteredEntries,
                  allBaristas: baristas,
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryStrip({
    required List<AttendanceHistoryEntry> activeEntries,
    required int shiftCount,
    required Duration totalDuration,
    required int staffCount,
  }) {
    final activeNames = activeEntries.map((e) => e.baristaName).toSet().join(', ');
    return LayoutBuilder(
      builder: (context, constraints) {
        final cards = [
          _SummaryMetricCard(
            icon: Icons.radio_button_checked_rounded,
            iconColor: activeEntries.isEmpty
                ? Colors.black45
                : const Color(0xFF15803D),
            label: 'Active now',
            value: '${activeEntries.length}',
            detail: activeEntries.isEmpty
                ? 'No one clocked in'
                : activeNames,
            highlight: activeEntries.isNotEmpty,
          ),
          _SummaryMetricCard(
            icon: Icons.calendar_month_rounded,
            iconColor: _ink,
            label: 'Shifts (31d)',
            value: '$shiftCount',
            detail: 'Recorded clock-ins',
          ),
          _SummaryMetricCard(
            icon: Icons.schedule_rounded,
            iconColor: const Color(0xFF1E5F8A),
            label: 'Total hours',
            value: _formatDuration(totalDuration),
            detail: 'Completed shift time',
          ),
          _SummaryMetricCard(
            icon: Icons.groups_rounded,
            iconColor: const Color(0xFF8C5A1E),
            label: 'Staff',
            value: '$staffCount',
            detail: 'Active baristas',
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

  Widget _buildToolbar(
    BuildContext context, {
    required List<String> baristas,
    required String? selectedBarista,
    required DateTime weekStart,
  }) {
    final weekEnd = weekStart.add(const Duration(days: 6));
    final currentWeek = _mondayOf(DateTime.now());
    final isCurrentWeek = weekStart == currentWeek;

    return Wrap(
      spacing: 12,
      runSpacing: 12,
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        SegmentedButton<_TimetableViewMode>(
          segments: const [
            ButtonSegment(
              value: _TimetableViewMode.timetable,
              icon: Icon(Icons.grid_view_rounded, size: 18),
              label: Text('Timetable'),
            ),
            ButtonSegment(
              value: _TimetableViewMode.dailyLog,
              icon: Icon(Icons.view_agenda_outlined, size: 18),
              label: Text('Daily log'),
            ),
          ],
          selected: {_viewMode},
          onSelectionChanged: (selection) {
            setState(() => _viewMode = selection.first);
          },
        ),
        if (_viewMode == _TimetableViewMode.timetable)
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
            ChoiceChip(
              label: const Text('All staff'),
              selected: selectedBarista == null,
              onSelected: (_) => setState(() => _selectedBarista = null),
            ),
            for (final name in baristas)
              ChoiceChip(
                label: Text(name),
                selected: selectedBarista == name,
                onSelected: (_) => setState(() {
                  _selectedBarista = selectedBarista == name ? null : name;
                }),
              ),
          ],
        ),
      ],
    );
  }

  Widget _buildTimetableGrid(
    BuildContext context, {
    required List<AttendanceHistoryEntry> entries,
    required List<String> baristas,
    required List<String> allBaristas,
    required DateTime weekStart,
  }) {
    final days = List.generate(
      7,
      (i) => DateUtils.dateOnly(weekStart.add(Duration(days: i))),
    );
    final today = DateUtils.dateOnly(DateTime.now());

    final grouped = <String, Map<DateTime, List<AttendanceHistoryEntry>>>{};
    for (final entry in entries) {
      final day = DateUtils.dateOnly(entry.clockedInAt);
      if (day.isBefore(days.first) || day.isAfter(days.last)) continue;
      grouped
          .putIfAbsent(entry.baristaName, () => {})
          .putIfAbsent(day, () => [])
          .add(entry);
    }
    for (final dayMap in grouped.values) {
      for (final list in dayMap.values) {
        list.sort((a, b) => a.clockedInAt.compareTo(b.clockedInAt));
      }
    }

    const staffColWidth = 164.0;
    const dayColWidth = 136.0;
    const minTableWidth = staffColWidth + dayColWidth * 7;

    return LayoutBuilder(
      builder: (context, constraints) {
        final tableWidth = constraints.maxWidth > minTableWidth
            ? constraints.maxWidth
            : minTableWidth;
        final computedDayWidth = (tableWidth - staffColWidth) / 7;

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
                    // Header row
                    Container(
                      decoration: const BoxDecoration(
                        color: _surface,
                        border: Border(bottom: BorderSide(color: _border)),
                      ),
                      child: Row(
                        children: [
                          SizedBox(
                            width: staffColWidth,
                            child: const Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 12,
                              ),
                              child: Text(
                                'BARISTA',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.8,
                                  color: Colors.black54,
                                ),
                              ),
                            ),
                          ),
                          for (final day in days)
                            _buildDayHeaderCell(
                              day: day,
                              width: computedDayWidth,
                              isToday: day == today,
                            ),
                        ],
                      ),
                    ),
                    // Staff rows
                    for (var r = 0; r < baristas.length; r++) ...[
                      _buildStaffRow(
                        context,
                        baristaName: baristas[r],
                        accent: _colorForBarista(baristas[r], allBaristas),
                        days: days,
                        today: today,
                        dayMap: grouped[baristas[r]] ?? const {},
                        staffColWidth: staffColWidth,
                        dayColWidth: computedDayWidth,
                        isLast: r == baristas.length - 1,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDayHeaderCell({
    required DateTime day,
    required double width,
    required bool isToday,
  }) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: isToday ? _ink.withValues(alpha: 0.08) : null,
        border: const Border(left: BorderSide(color: _border)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                _weekdayShort(day.weekday),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: isToday ? _ink : Colors.black54,
                ),
              ),
              if (isToday) ...[
                const SizedBox(width: 5),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    color: _ink,
                    borderRadius: BorderRadius.circular(999),
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
            '${day.day} ${_monthShort(day.month)}',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: isToday ? _ink : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStaffRow(
    BuildContext context, {
    required String baristaName,
    required Color accent,
    required List<DateTime> days,
    required DateTime today,
    required Map<DateTime, List<AttendanceHistoryEntry>> dayMap,
    required double staffColWidth,
    required double dayColWidth,
    required bool isLast,
  }) {
    final weeklyDuration = dayMap.values
        .expand((list) => list)
        .fold<Duration>(Duration.zero, (sum, e) => sum + _shiftDuration(e));
    final hasActive = dayMap.values
        .expand((list) => list)
        .any((e) => e.clockedOutAt == null);

    return Container(
      decoration: BoxDecoration(
        border: isLast ? null : const Border(bottom: BorderSide(color: _border)),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: staffColWidth,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: accent.withValues(alpha: 0.14),
                      child: Text(
                        baristaName.isEmpty
                            ? '?'
                            : baristaName[0].toUpperCase(),
                        style: TextStyle(
                          color: accent,
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  baristaName,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                              if (hasActive) ...[
                                const SizedBox(width: 5),
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF16A34A),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            weeklyDuration == Duration.zero
                                ? 'No shifts'
                                : _formatDuration(weeklyDuration),
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.black54,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            for (final day in days)
              Container(
                width: dayColWidth,
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: day == today
                      ? _ink.withValues(alpha: 0.03)
                      : Colors.white,
                  border: const Border(left: BorderSide(color: _border)),
                ),
                child: _buildDayCell(
                  context,
                  shifts: dayMap[day] ?? const [],
                  accent: accent,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDayCell(
    BuildContext context, {
    required List<AttendanceHistoryEntry> shifts,
    required Color accent,
  }) {
    if (shifts.isEmpty) {
      return const Center(
        child: Text(
          '—',
          style: TextStyle(color: Colors.black26, fontWeight: FontWeight.w700),
        ),
      );
    }

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < shifts.length; i++) ...[
          _ShiftCellPill(
            entry: shifts[i],
            accent: accent,
            inLabel: _timeLabel(context, shifts[i].clockedInAt),
            outLabel: shifts[i].clockedOutAt == null
                ? 'Active'
                : _timeLabel(context, shifts[i].clockedOutAt!),
            durationLabel: shifts[i].clockedOutAt == null
                ? 'Live'
                : _formatDuration(_shiftDuration(shifts[i])),
          ),
          if (i < shifts.length - 1) const SizedBox(height: 5),
        ],
      ],
    );
  }

  Widget _buildDailyLog(
    BuildContext context, {
    required List<AttendanceHistoryEntry> entries,
    required List<String> allBaristas,
  }) {
    final sorted = [...entries]
      ..sort((a, b) => b.clockedInAt.compareTo(a.clockedInAt));
    final byDate = <DateTime, List<AttendanceHistoryEntry>>{};
    for (final entry in sorted) {
      byDate
          .putIfAbsent(DateUtils.dateOnly(entry.clockedInAt), () => [])
          .add(entry);
    }
    final dates = byDate.keys.toList()..sort((a, b) => b.compareTo(a));
    final today = DateUtils.dateOnly(DateTime.now());

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final date in dates) ...[
          Padding(
            padding: const EdgeInsets.only(top: 6, bottom: 8),
            child: Row(
              children: [
                Text(
                  date == today
                      ? 'Today · ${_fullDateLabel(date)}'
                      : _fullDateLabel(date),
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: _ink,
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: _surface,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: _border),
                  ),
                  child: Text(
                    '${byDate[date]!.length} ${byDate[date]!.length == 1 ? 'shift' : 'shifts'}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.black54,
                    ),
                  ),
                ),
              ],
            ),
          ),
          for (final entry in byDate[date]!)
            _DailyLogRow(
              entry: entry,
              accent: _colorForBarista(entry.baristaName, allBaristas),
              inLabel: _timeLabel(context, entry.clockedInAt),
              outLabel: entry.clockedOutAt == null
                  ? 'Still clocked in'
                  : _timeLabel(context, entry.clockedOutAt!),
              durationLabel: entry.clockedOutAt == null
                  ? 'Active'
                  : _formatDuration(_shiftDuration(entry)),
            ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _SummaryMetricCard extends StatelessWidget {
  const _SummaryMetricCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.detail,
    this.highlight = false,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final String detail;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: highlight ? const Color(0xFFF0FDF4) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: highlight
              ? const Color(0xFF86EFAC)
              : const Color(0xFFDCE3EA),
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

class _ShiftCellPill extends StatelessWidget {
  const _ShiftCellPill({
    required this.entry,
    required this.accent,
    required this.inLabel,
    required this.outLabel,
    required this.durationLabel,
  });

  final AttendanceHistoryEntry entry;
  final Color accent;
  final String inLabel;
  final String outLabel;
  final String durationLabel;

  @override
  Widget build(BuildContext context) {
    final isActive = entry.clockedOutAt == null;
    final bg = isActive
        ? const Color(0xFFECFDF3)
        : accent.withValues(alpha: 0.08);
    final border = isActive
        ? const Color(0xFF86EFAC)
        : accent.withValues(alpha: 0.25);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (isActive) ...[
                Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.only(right: 4),
                  decoration: const BoxDecoration(
                    color: Color(0xFF16A34A),
                    shape: BoxShape.circle,
                  ),
                ),
              ],
              Expanded(
                child: Text(
                  '$inLabel – $outLabel',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: isActive ? const Color(0xFF166534) : accent,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            durationLabel,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: isActive ? const Color(0xFF15803D) : Colors.black54,
            ),
          ),
        ],
      ),
    );
  }
}

class _DailyLogRow extends StatelessWidget {
  const _DailyLogRow({
    required this.entry,
    required this.accent,
    required this.inLabel,
    required this.outLabel,
    required this.durationLabel,
  });

  final AttendanceHistoryEntry entry;
  final Color accent;
  final String inLabel;
  final String outLabel;
  final String durationLabel;

  @override
  Widget build(BuildContext context) {
    final isActive = entry.clockedOutAt == null;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFBFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFDCE3EA)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: accent.withValues(alpha: 0.14),
            child: Text(
              entry.baristaName.isEmpty
                  ? '?'
                  : entry.baristaName[0].toUpperCase(),
              style: TextStyle(
                color: accent,
                fontWeight: FontWeight.w900,
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              entry.baristaName,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
            ),
          ),
          Text(
            '$inLabel  →  $outLabel',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: isActive ? const Color(0xFF166534) : Colors.black87,
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isActive
                  ? const Color(0xFFDCFCE7)
                  : accent.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              durationLabel,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: isActive ? const Color(0xFF166534) : accent,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Duration _shiftDuration(AttendanceHistoryEntry entry) {
  final out = entry.clockedOutAt;
  if (out == null) return Duration.zero;
  final diff = out.difference(entry.clockedInAt);
  return diff.isNegative ? Duration.zero : diff;
}

String _formatDuration(Duration duration) {
  final hours = duration.inHours;
  final minutes = duration.inMinutes.remainder(60);
  if (hours == 0) return '${minutes}m';
  if (minutes == 0) return '${hours}h';
  return '${hours}h ${minutes}m';
}

String _timeLabel(BuildContext context, DateTime value) =>
    MaterialLocalizations.of(
      context,
    ).formatTimeOfDay(TimeOfDay.fromDateTime(value));

String _shortDateLabel(DateTime value) =>
    '${value.day} ${_monthShort(value.month)}';

String _fullDateLabel(DateTime value) =>
    '${_weekdayShort(value.weekday)}, ${value.day} ${_monthShort(value.month)} ${value.year}';

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
    padding: const EdgeInsets.symmetric(vertical: 48),
    child: Column(
      children: [
        Icon(icon, size: 42, color: Colors.black45),
        const SizedBox(height: 12),
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
        ),
        const SizedBox(height: 6),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 16),
        FilledButton(onPressed: onRetry, child: const Text('Try again')),
      ],
    ),
  );
}
