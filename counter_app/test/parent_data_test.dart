import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:counter_app/barista/screens/main_layout.dart';
import 'package:counter_app/barista/services/api_service.dart';
import 'package:counter_app/barista/main.dart';

void main() {
  testWidgets('Check for Flutter errors across all workstation access states', (tester) async {
    final errors = <FlutterErrorDetails>[];
    FlutterError.onError = (details) {
      errors.add(details);
    };

    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    // 1. null / loading
    globalWorkstationAccess.value = null;
    await tester.pumpWidget(MaterialApp(home: MainLayout(onSignedOut: () {})));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsWidgets);

    // 2. locked
    globalWorkstationAccess.value = const WorkstationAccessState(
      scheduleStatus: 'published',
      accessState: 'locked',
      canPrepareOrders: false,
      message: 'All opening-shift baristas must clock in once before order preparation unlocks.',
      soundSettings: BaristaSoundSettings.defaults(),
      currentStaff: [],
      activeAttendance: [],
      missingStaff: [
        ShiftStaff(baristaId: 8, baristaName: 'Hafiz', startsAt: '08:00', endsAt: '17:00'),
      ],
      scheduleDate: '2026-10-22',
      minutesUntilShiftEnd: null,
    );
    await tester.pump();
    expect(find.text('Clock in to unlock'), findsOneWidget);

    // 3. handover (unlocked for preparation, but warning notice)
    globalWorkstationAccess.value = const WorkstationAccessState(
      scheduleStatus: 'published',
      accessState: 'handover',
      canPrepareOrders: true,
      message: 'Awish has not clocked in yet. Handover is in progress.',
      soundSettings: BaristaSoundSettings.defaults(),
      currentStaff: [
        ShiftStaff(baristaId: 8, baristaName: 'Hafiz', startsAt: '08:00', endsAt: '17:00'),
      ],
      activeAttendance: [],
      missingStaff: [
        ShiftStaff(baristaId: 10, baristaName: 'Awish', startsAt: '08:00', endsAt: '17:00'),
      ],
      scheduleDate: '2026-10-22',
      minutesUntilShiftEnd: 480,
    );
    await tester.pump();
    expect(find.text('Clock in to unlock'), findsNothing);
    expect(find.text('Awish has not clocked in yet. Handover is in progress.'), findsOneWidget);
    expect(find.text('Current Order'), findsOneWidget);

    // 4. fully unlocked
    globalWorkstationAccess.value = const WorkstationAccessState(
      scheduleStatus: 'published',
      accessState: 'unlocked',
      canPrepareOrders: true,
      message: 'Workstation is active.',
      soundSettings: BaristaSoundSettings.defaults(),
      currentStaff: [
        ShiftStaff(baristaId: 8, baristaName: 'Hafiz', startsAt: '08:00', endsAt: '17:00'),
        ShiftStaff(baristaId: 10, baristaName: 'Awish', startsAt: '08:00', endsAt: '17:00'),
      ],
      activeAttendance: [],
      missingStaff: [],
      scheduleDate: '2026-10-22',
      minutesUntilShiftEnd: 480,
    );
    await tester.pump();
    expect(find.text('Clock in to unlock'), findsNothing);
    expect(find.text('Current Order'), findsOneWidget);
    expect(find.text('Online'), findsOneWidget);

    expect(errors, isEmpty);
  });
}
