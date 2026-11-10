import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export type BaristaSoundSettings = {
  volume_percent: number;
  incoming_order_enabled: number;
  clock_in_beeps: number;
  clock_in_style: BaristaSoundStyle;
  clock_out_beeps: number;
  clock_out_style: BaristaSoundStyle;
  side_work_beeps: number;
  side_work_style: BaristaSoundStyle;
  incoming_order_beeps: number;
  incoming_order_style: BaristaSoundStyle;
  cancellation_alert_enabled: number;
  cancellation_alert_beeps: number;
  cancellation_alert_style: BaristaSoundStyle;
  waiting_alert_enabled: number;
  waiting_alert_after_minutes: number;
  waiting_alert_repeat_minutes: number;
  waiting_alert_beeps: number;
  waiting_alert_style: BaristaSoundStyle;
  preparing_alert_enabled: number;
  preparing_alert_after_minutes: number;
  preparing_alert_repeat_minutes: number;
  preparing_alert_beeps: number;
  preparing_alert_style: BaristaSoundStyle;
};

export type BaristaSoundStyle = 'short' | 'long' | 'two_tone';

export const defaultBaristaSoundSettings: BaristaSoundSettings = {
  volume_percent: 70,
  incoming_order_enabled: 1,
  clock_in_beeps: 1,
  clock_in_style: 'short',
  clock_out_beeps: 2,
  clock_out_style: 'long',
  side_work_beeps: 3,
  side_work_style: 'two_tone',
  incoming_order_beeps: 4,
  incoming_order_style: 'two_tone',
  cancellation_alert_enabled: 1,
  cancellation_alert_beeps: 5,
  cancellation_alert_style: 'two_tone',
  waiting_alert_enabled: 1,
  waiting_alert_after_minutes: 5,
  waiting_alert_repeat_minutes: 10,
  waiting_alert_beeps: 2,
  waiting_alert_style: 'short',
  preparing_alert_enabled: 1,
  preparing_alert_after_minutes: 10,
  preparing_alert_repeat_minutes: 10,
  preparing_alert_beeps: 1,
  preparing_alert_style: 'short'
};

export async function loadBaristaSoundSettings(
  connection: PoolConnection,
  tenantId: number,
  storeId: number
): Promise<BaristaSoundSettings> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT volume_percent, incoming_order_enabled, clock_in_beeps, clock_in_style,
            clock_out_beeps, clock_out_style, side_work_beeps, side_work_style,
            incoming_order_beeps, incoming_order_style,
            cancellation_alert_enabled, cancellation_alert_beeps, cancellation_alert_style,
            waiting_alert_enabled, waiting_alert_after_minutes, waiting_alert_repeat_minutes,
            waiting_alert_beeps, waiting_alert_style,
            preparing_alert_enabled, preparing_alert_after_minutes, preparing_alert_repeat_minutes,
            preparing_alert_beeps, preparing_alert_style
     FROM barista_sound_settings
     WHERE tenant_id = :tenantId AND store_id = :storeId
     LIMIT 1`,
    { tenantId, storeId }
  );
  const row = rows[0];
  if (!row) return { ...defaultBaristaSoundSettings };
  return {
    volume_percent: Number(row.volume_percent),
    incoming_order_enabled: Number(row.incoming_order_enabled),
    clock_in_beeps: Number(row.clock_in_beeps),
    clock_in_style: row.clock_in_style as BaristaSoundStyle,
    clock_out_beeps: Number(row.clock_out_beeps),
    clock_out_style: row.clock_out_style as BaristaSoundStyle,
    side_work_beeps: Number(row.side_work_beeps),
    side_work_style: row.side_work_style as BaristaSoundStyle,
    incoming_order_beeps: Number(row.incoming_order_beeps),
    incoming_order_style: row.incoming_order_style as BaristaSoundStyle,
    cancellation_alert_enabled: Number(row.cancellation_alert_enabled),
    cancellation_alert_beeps: Number(row.cancellation_alert_beeps),
    cancellation_alert_style: row.cancellation_alert_style as BaristaSoundStyle,
    waiting_alert_enabled: Number(row.waiting_alert_enabled),
    waiting_alert_after_minutes: Number(row.waiting_alert_after_minutes),
    waiting_alert_repeat_minutes: Number(row.waiting_alert_repeat_minutes),
    waiting_alert_beeps: Number(row.waiting_alert_beeps),
    waiting_alert_style: row.waiting_alert_style as BaristaSoundStyle,
    preparing_alert_enabled: Number(row.preparing_alert_enabled),
    preparing_alert_after_minutes: Number(row.preparing_alert_after_minutes),
    preparing_alert_repeat_minutes: Number(row.preparing_alert_repeat_minutes),
    preparing_alert_beeps: Number(row.preparing_alert_beeps),
    preparing_alert_style: row.preparing_alert_style as BaristaSoundStyle
  };
}
