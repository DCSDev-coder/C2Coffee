export const COUNTER_DEVICE_ONLINE_WINDOW_SECONDS = 30;

export type CounterDeviceConnectionStatus =
  | 'online'
  | 'offline'
  | 'awaiting_activation'
  | 'disabled'
  | 'revoked';

interface CounterDevicePresenceInput {
  status: 'active' | 'inactive' | 'revoked';
  activatedAt: unknown;
  secondsSinceLastSeen: unknown;
}

function normaliseSeconds(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : null;
}

export function resolveCounterDevicePresence(input: CounterDevicePresenceInput): {
  connectionStatus: CounterDeviceConnectionStatus;
  isOnline: boolean;
  secondsSinceLastSeen: number | null;
} {
  const secondsSinceLastSeen = normaliseSeconds(input.secondsSinceLastSeen);

  if (input.status === 'revoked') {
    return { connectionStatus: 'revoked', isOnline: false, secondsSinceLastSeen };
  }
  if (input.status === 'inactive') {
    return { connectionStatus: 'disabled', isOnline: false, secondsSinceLastSeen };
  }
  if (!input.activatedAt) {
    return { connectionStatus: 'awaiting_activation', isOnline: false, secondsSinceLastSeen };
  }

  const isOnline = secondsSinceLastSeen !== null
    && secondsSinceLastSeen <= COUNTER_DEVICE_ONLINE_WINDOW_SECONDS;
  return {
    connectionStatus: isOnline ? 'online' : 'offline',
    isOnline,
    secondsSinceLastSeen
  };
}
