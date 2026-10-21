import 'package:counter_app/barista/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a handover state without requiring order attribution', () {
    final state = WorkstationAccessState.fromJson({
      'schedule_status': 'published',
      'access_state': 'handover',
      'can_prepare_orders': true,
      'message': 'Mira must clock in for the current shift.',
      'schedule_date': '2026-10-20',
      'current_staff': [
        {
          'barista_id': 2,
          'barista_name': 'Mira',
          'starts_at': '17:00',
          'ends_at': '22:00',
        },
      ],
      'missing_staff': [
        {'barista_id': 2, 'barista_name': 'Mira'},
      ],
      'active_attendance': [
        {
          'id': 10,
          'barista_id': 1,
          'barista_name': 'Aina',
          'clocked_in_at': '2026-10-20T01:00:00.000Z',
        },
      ],
      'minutes_until_shift_end': 300,
      'sound_settings': {
        'volume_percent': 55,
        'clock_in_beeps': 2,
        'clock_in_style': 'long',
        'clock_out_beeps': 4,
        'clock_out_style': 'two_tone',
        'side_work_beeps': 5,
        'side_work_style': 'short',
      },
    });

    expect(state.canPrepareOrders, isTrue);
    expect(state.accessState, 'handover');
    expect(state.missingStaff.single.baristaName, 'Mira');
    expect(state.activeAttendance.single.baristaName, 'Aina');
    expect(state.soundSettings.volumePercent, 55);
    expect(state.soundSettings.clockInBeeps, 2);
    expect(state.soundSettings.clockInStyle, 'long');
    expect(state.soundSettings.clockOutBeeps, 4);
    expect(state.soundSettings.clockOutStyle, 'two_tone');
    expect(state.soundSettings.sideWorkBeeps, 5);
    expect(state.soundSettings.sideWorkStyle, 'short');
  });

  test('uses safe beep defaults when older API responses omit settings', () {
    final state = WorkstationAccessState.fromJson({
      'schedule_status': 'published',
      'access_state': 'unlocked',
      'can_prepare_orders': true,
      'message': 'Ready.',
      'schedule_date': '2026-10-20',
    });

    expect(state.soundSettings.volumePercent, 70);
    expect(state.soundSettings.clockInBeeps, 1);
    expect(state.soundSettings.clockInStyle, 'short');
    expect(state.soundSettings.clockOutBeeps, 2);
    expect(state.soundSettings.clockOutStyle, 'long');
    expect(state.soundSettings.sideWorkBeeps, 3);
    expect(state.soundSettings.sideWorkStyle, 'two_tone');
  });
}
