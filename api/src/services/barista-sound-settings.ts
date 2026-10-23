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
  incoming_order_style: 'two_tone'
};

export async function loadBaristaSoundSettings(
  connection: PoolConnection,
  tenantId: number,
  storeId: number
): Promise<BaristaSoundSettings> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT volume_percent, incoming_order_enabled, clock_in_beeps, clock_in_style,
            clock_out_beeps, clock_out_style, side_work_beeps, side_work_style,
            incoming_order_beeps, incoming_order_style
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
    incoming_order_style: row.incoming_order_style as BaristaSoundStyle
  };
}
