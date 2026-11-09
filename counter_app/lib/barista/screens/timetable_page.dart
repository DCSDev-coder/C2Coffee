import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../widgets/barista_page_header.dart';
import '../widgets/barista_card.dart';

class TimetablePage extends StatefulWidget {
  const TimetablePage({super.key});

  @override
  State<TimetablePage> createState() => _TimetablePageState();
}

class _TimetablePageState extends State<TimetablePage> {
  static const _ink = Color(0xFF203E32);
  static const _canvas = Colors.white;
  late Future<List<AttendanceHistoryEntry>> _attendance;

  @override
  void initState() {
    super.initState();
    _attendance = ApiService.fetchAttendanceHistory();
  }

  void _refresh() {
    setState(() => _attendance = ApiService.fetchAttendanceHistory());
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
                  constraints: const BoxConstraints(maxWidth: 1120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      BaristaPageHeader(
                        title: 'Attendance history',
                        subtitle:
                            'Clock-in and clock-out records from the last 31 days.',
                        onRefresh: _refresh,
                        refreshTooltip: 'Refresh attendance history',
                      ),
                      const SizedBox(height: 22),
                      BaristaCard(
                        padding: const EdgeInsets.all(20),
                        child: _buildContent(context, snapshot),
                      ),
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
    AsyncSnapshot<List<AttendanceHistoryEntry>> snapshot,
  ) {
    if (snapshot.hasError) {
      final error = snapshot.error;
      final detail = error is StateError && error.message.trim().isNotEmpty
          ? error.message
          : 'Attendance history could not be loaded. Check the connection and refresh.';
      return _StatusMessage(
        icon: Icons.cloud_off_rounded,
        title: 'Unable to load attendance history',
        message: detail,
        onRetry: _refresh,
      );
    }
    if (!snapshot.hasData) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 70),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (snapshot.data!.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Center(child: Text('No attendance records yet.')),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: snapshot.data!
          .map(
            (entry) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFAFBFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFDCE3EA)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.person_outline_rounded, color: _ink),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.baristaName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _dateLabel(entry.clockedInAt),
                          style: const TextStyle(color: Colors.black54),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'In ${_timeLabel(context, entry.clockedInAt)}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        entry.clockedOutAt == null
                            ? 'Still clocked in'
                            : 'Out ${_timeLabel(context, entry.clockedOutAt!)}',
                        style: TextStyle(
                          color: entry.clockedOutAt == null
                              ? _ink
                              : Colors.black54,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

String _timeLabel(BuildContext context, DateTime value) =>
    MaterialLocalizations.of(
      context,
    ).formatTimeOfDay(TimeOfDay.fromDateTime(value));

String _dateLabel(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';

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
