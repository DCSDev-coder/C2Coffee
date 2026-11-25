export function malaysiaAttendanceDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function isBaristaHistoryStatus(value) {
  return ['ready for pickup', 'ready_for_pickup', 'collected', 'cancelled', 'refunded'].includes(String(value || '').trim().toLowerCase());
}

export function eligibleWorkstationOutlets(stores) {
  return (Array.isArray(stores) ? stores : []).filter((store) => store.status === 'active');
}
