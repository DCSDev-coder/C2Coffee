const KL_TIME_ZONE = 'Asia/Kuala_Lumpur';

export function toReportNumber(value) {
  const numeric = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function parseReportDateTime(dateValue, timeValue = '') {
  if (dateValue instanceof Date) {
    return dateValue;
  }

  const rawValue = timeValue ? `${String(dateValue ?? '').trim()} ${String(timeValue ?? '').trim()}` : String(dateValue ?? '').trim();
  if (!rawValue) {
    return new Date(0);
  }

  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(`${rawValue} UTC`);
  return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback;
}

export function formatReportDate(value) {
  const date = value instanceof Date ? value : parseReportDateTime(value);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: KL_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

export function formatReportTime(value) {
  const date = value instanceof Date ? value : parseReportDateTime(value);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: KL_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

export function formatReportMoney(value, { withPrefix = true } = {}) {
  const amount = toReportNumber(value);
  const formatted = amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return withPrefix ? `RM ${formatted}` : formatted;
}

export function formatReportTokens(value, { withPrefix = true, fractionDigits = 0 } = {}) {
  const amount = toReportNumber(value);
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });

  return withPrefix ? `${formatted} tokens` : formatted;
}

export function formatPaymentLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '-';
  }

  return raw
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part.length <= 2 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join(' ');
}

function monthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function monthLabel(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: KL_TIME_ZONE,
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function normalizeStatusKey(status) {
  return String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function isRevenueOrder(status) {
  const normalized = normalizeStatusKey(status);
  return !['draft', 'pending_payment', 'payment_failed', 'cancelled'].includes(normalized);
}

function isRefundCompleted(status) {
  const normalized = normalizeStatusKey(status);
  return !['', 'pending', 'failed', 'cancelled', 'rejected', 'under_review', 'reviewing'].includes(normalized);
}

export function buildFinanceOverview(orders = [], refunds = []) {
  const normalizedOrders = Array.isArray(orders) ? orders : [];
  const normalizedRefunds = Array.isArray(refunds) ? refunds : [];

  const monthMap = new Map();
  const statusMap = new Map();
  const recentTransactions = [];

  let totalRevenueRm = 0;
  let totalTokensCharged = 0;
  let totalOrders = 0;
  let activeOrders = 0;
  let completedOrders = 0;

  for (const order of normalizedOrders) {
    const orderDate = parseReportDateTime(order.date, order.time);
    const normalizedStatus = normalizeStatusKey(order.status);
    const orderTotalRm = toReportNumber(order.total);
    const orderTokens = toReportNumber(order.tokenAmountCharged);
    const shouldCountAsRevenue = isRevenueOrder(order.status);

    totalOrders += 1;
    if (['paid', 'accepted', 'preparing', 'ready_for_pickup'].includes(normalizedStatus)) {
      activeOrders += 1;
    }
    if (normalizedStatus === 'collected') {
      completedOrders += 1;
    }
    if (shouldCountAsRevenue) {
      totalRevenueRm += orderTotalRm;
      totalTokensCharged += orderTokens;
    }

    const currentBucket = monthMap.get(monthKey(orderDate)) ?? {
      key: monthKey(orderDate),
      month: monthLabel(orderDate),
      revenueRm: 0,
      refundRm: 0,
      refundTokens: 0,
      netRm: 0,
      tokensCharged: 0,
      netTokens: 0,
      orders: 0
    };

    if (shouldCountAsRevenue) {
      currentBucket.revenueRm += orderTotalRm;
      currentBucket.tokensCharged += orderTokens;
      currentBucket.netTokens += orderTokens;
      currentBucket.orders += 1;
      currentBucket.netRm += orderTotalRm;
    }
    monthMap.set(monthKey(orderDate), currentBucket);

    const statusBucket = statusMap.get(normalizedStatus) ?? {
      key: normalizedStatus || 'other',
      name: String(order.status ?? 'Other'),
      value: 0,
      amountRm: 0
    };
    statusBucket.value += 1;
    statusBucket.amountRm += orderTotalRm;
    statusMap.set(normalizedStatus || 'other', statusBucket);

    recentTransactions.push({
      id: `ORDER-${order.id}`,
      timestamp: orderDate,
      date: formatReportDate(orderDate),
      time: formatReportTime(orderDate),
      type: 'Order',
      description: `Order ${order.id}${order.customer ? ` · ${order.customer}` : ''}`,
      amountRm: orderTotalRm,
      amountTokens: orderTokens,
      status: order.status || '',
      paymentStatus: order.paymentStatus || '',
      paymentMode: order.paymentMode || order.payment || '',
      reference: order.txnId || order.id
    });
  }

  let totalRefundAmountRm = 0;
  let totalRefundTokens = 0;
  let refundedOrders = 0;

  for (const refund of normalizedRefunds) {
    const refundDate = parseReportDateTime(refund.requestedAt);
    const refundAmountRm = toReportNumber(refund.amount);
    const refundTokens = toReportNumber(refund.tokenAmount ?? refund.refundTokenAmount);

    if (isRefundCompleted(refund.status)) {
      refundedOrders += 1;
      totalRefundAmountRm += refundAmountRm;
      totalRefundTokens += refundTokens;
    }

    const currentBucket = monthMap.get(monthKey(refundDate)) ?? {
      key: monthKey(refundDate),
      month: monthLabel(refundDate),
      revenueRm: 0,
      refundRm: 0,
      refundTokens: 0,
      netRm: 0,
      tokensCharged: 0,
      netTokens: 0,
      orders: 0
    };

    if (isRefundCompleted(refund.status)) {
      currentBucket.refundRm += refundAmountRm;
      currentBucket.refundTokens += refundTokens;
      currentBucket.netTokens -= refundTokens;
      currentBucket.netRm -= refundAmountRm;
    }
    monthMap.set(monthKey(refundDate), currentBucket);

    recentTransactions.push({
      id: `REFUND-${refund.id}`,
      timestamp: refundDate,
      date: formatReportDate(refundDate),
      time: formatReportTime(refundDate),
      type: 'Refund',
      description: `Refund ${refund.orderId}${refund.reason ? ` · ${refund.reason}` : ''}`,
      amountRm: -refundAmountRm,
      amountTokens: -refundTokens,
      status: refund.status || '',
      paymentStatus: refund.status || '',
      paymentMode: refund.paymentMethod || '',
      reference: refund.id
    });
  }

  const monthlyRevenue = Array.from(monthMap.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => ({
      month: entry.month,
      revenueRm: Number(entry.revenueRm.toFixed(2)),
      refundRm: Number(entry.refundRm.toFixed(2)),
      netRm: Number((entry.revenueRm - entry.refundRm).toFixed(2)),
      tokensCharged: Math.round(entry.tokensCharged),
      refundTokens: Math.round(entry.refundTokens),
      netTokens: Math.round(entry.netTokens),
      orders: entry.orders
    }));

  const statusBreakdown = Array.from(statusMap.values())
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .map((entry, index) => ({
      name: entry.name,
      value: entry.value,
      amountRm: Number(entry.amountRm.toFixed(2)),
      color: ['#1F3A34', '#2E5E58', '#6F9F96', '#8AACA5', '#E07A5F', '#D4AF7A'][index % 6]
    }));

  const orderedTransactions = recentTransactions
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .map(({ timestamp, ...row }) => row);

  const totalNetRevenueRm = Number((totalRevenueRm - totalRefundAmountRm).toFixed(2));
  const averageOrderValueRm = totalOrders > 0 ? Number((totalRevenueRm / totalOrders).toFixed(2)) : 0;

  return {
    summary: {
      totalRevenueRm: Number(totalRevenueRm.toFixed(2)),
      totalTokensCharged: Math.round(totalTokensCharged),
      totalRefundAmountRm: Number(totalRefundAmountRm.toFixed(2)),
      totalRefundTokens: Math.round(totalRefundTokens),
      netTokens: Math.round(totalTokensCharged - totalRefundTokens),
      netRevenueRm: totalNetRevenueRm,
      totalOrders,
      activeOrders,
      completedOrders,
      refundedOrders,
      averageOrderValueRm
    },
    monthlyRevenue,
    statusBreakdown,
    recentTransactions: orderedTransactions
  };
}
