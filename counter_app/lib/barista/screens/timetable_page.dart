import 'package:flutter/material.dart';

import '../services/api_service.dart';

class TimetablePage extends StatefulWidget {
  const TimetablePage({super.key});

  @override
  State<TimetablePage> createState() => _TimetablePageState();
}

class _TimetablePageState extends State<TimetablePage> {
  static const _ink = Color(0xFF203E32);
  static const _canvas = Color(0xFFF7F6F1);
  late Future<OperationsContext> _operations;

  @override
  void initState() {
    super.initState();
    _operations = ApiService.fetchOperationsContext();
  }

  void _refresh() {
    setState(() => _operations = ApiService.fetchOperationsContext());
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
              await _operations;
            },
            child: FutureBuilder<OperationsContext>(
              future: _operations,
              builder: (context, snapshot) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 150),
                  children: [
                    Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 1120),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                const Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Timetable',
                                        style: TextStyle(
                                          color: _ink,
                                          fontSize: 34,
                                          height: 1.05,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                      SizedBox(height: 8),
                                      Text(
                                        'Published shifts for today and the next 30 days.',
                                        style: TextStyle(fontSize: 16),
                                      ),
                                    ],
                                  ),
                                ),
                                IconButton.filledTonal(
                                  tooltip: 'Refresh timetable',
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
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(AsyncSnapshot<OperationsContext> snapshot) {
    if (snapshot.hasError) {
      return _StatusMessage(
        icon: Icons.cloud_off_rounded,
        title: 'Internet connection issue',
        message:
            'The published timetable could not be loaded. Check the connection and refresh.',
        onRetry: _refresh,
      );
    }
    if (!snapshot.hasData) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 70),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    final operations = snapshot.data!;
    final today = DateTime.now();
    final dates = List.generate(
      31,
      (index) => DateTime(today.year, today.month, today.day + index),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Next 31 days',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 5),
        const Text(
          'Matching colours mean those baristas are working at the same time.',
          style: TextStyle(color: Colors.black54),
        ),
        const Divider(height: 34),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 900
                ? 3
                : constraints.maxWidth >= 590
                ? 2
                : 1;
            final width =
                (constraints.maxWidth - ((columns - 1) * 12)) / columns;
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: dates.map((date) {
                final entries =
                    operations.scheduledShifts
                        .where((entry) => entry.shiftDate == _dateKey(date))
                        .toList()
                      ..sort(
                        (left, right) =>
                            left.startsAt.compareTo(right.startsAt),
                      );
                return SizedBox(
                  width: width,
                  child: _DayCard(date: date, entries: entries),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({required this.date, required this.entries});

  final DateTime date;
  final List<DatedShiftEntry> entries;

  static const _palette = [
    (Color(0xFFEAF6FD), Color(0xFF8DD3F4), Color(0xFF153B52)),
    (Color(0xFFF2EDFD), Color(0xFFC7AFF8), Color(0xFF3D246B)),
    (Color(0xFFFFF4DA), Color(0xFFF1CE78), Color(0xFF694A00)),
    (Color(0xFFE9F8EF), Color(0xFF91D5AA), Color(0xFF174B2A)),
    (Color(0xFFFCECEF), Color(0xFFF2A8B5), Color(0xFF6B2430)),
  ];

  @override
  Widget build(BuildContext context) {
    final colorIndexes = _coverageColorIndexes(entries);
    return Container(
      constraints: const BoxConstraints(minHeight: 154),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFBFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFDCE3EA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _dateLabel(date),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          if (entries.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 25),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFFCBD5E1),
                  style: BorderStyle.solid,
                ),
              ),
              child: const Text(
                'No shift planned',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF94A3B8)),
              ),
            )
          else
            ...List.generate(entries.length, (index) {
              final entry = entries[index];
              final colors = _palette[colorIndexes[index] % _palette.length];
              return Padding(
                padding: EdgeInsets.only(
                  bottom: index == entries.length - 1 ? 0 : 8,
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 13,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: colors.$1,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: colors.$2),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.baristaName,
                        style: TextStyle(
                          color: colors.$3,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        _shiftTime(entry),
                        style: TextStyle(
                          color: colors.$3.withValues(alpha: .72),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  static List<int> _coverageColorIndexes(List<DatedShiftEntry> entries) {
    var colorIndex = -1;
    var coverageEndsAt = -1;
    return entries.map((entry) {
      final startsAt = _minutes(entry.startsAt);
      var endsAt = _minutes(entry.endsAt);
      if (endsAt <= startsAt) endsAt += 24 * 60;
      if (startsAt >= coverageEndsAt) {
        colorIndex += 1;
        coverageEndsAt = endsAt;
      } else if (endsAt > coverageEndsAt) {
        coverageEndsAt = endsAt;
      }
      return colorIndex;
    }).toList();
  }

  static int _minutes(String value) {
    final parts = value.split(':');
    return (int.tryParse(parts.first) ?? 0) * 60 +
        (parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0);
  }

  static String _shiftTime(DatedShiftEntry entry) {
    final nextDay = _minutes(entry.endsAt) <= _minutes(entry.startsAt);
    return '${entry.startsAt.substring(0, 5)} – ${entry.endsAt.substring(0, 5)}${nextDay ? ' (next day)' : ''}';
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

String _dateLabel(DateTime date) {
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
