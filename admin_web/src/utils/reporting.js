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
      netRm: 0,
      tokensCharged: 0,
      orders: 0
    };

    if (shouldCountAsRevenue) {
      currentBucket.revenueRm += orderTotalRm;
      currentBucket.tokensCharged += orderTokens;
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
      status: order.status || 'Completed',
      paymentStatus: order.paymentStatus || 'Paid',
      paymentMode: order.paymentMode || order.payment || 'C2 Tokens',
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
      netRm: 0,
      tokensCharged: 0,
      orders: 0
    };

    if (isRefundCompleted(refund.status)) {
      currentBucket.refundRm += refundAmountRm;
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
      status: refund.status || 'Pending',
      paymentStatus: refund.status || 'Pending',
      paymentMode: refund.paymentMethod || 'C2 Tokens',
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

export function buildProductReportOverview(menuResponse, selectedDate = null) {
  const categories = Array.isArray(menuResponse?.categories) ? menuResponse.categories : [];
  const cutoffDate = selectedDate ? new Date(selectedDate) : null;

  const products = categories.flatMap((category) => {
    const items = Array.isArray(category.items) ? category.items : [];
    return items.map((item) => {
      const lastOrderedAt = item.last_ordered_at ? parseReportDateTime(item.last_ordered_at) : null;

      return {
        id: item.id,
        name: item.name,
        category: category.name || 'Uncategorized',
        subcategory: item.subcategory_name || category.product_kind_name || 'General',
        productKind: category.product_kind_name || 'Other',
        quantitySold: Math.round(toReportNumber(item.sales_count)),
        revenueRm: Number(toReportNumber(item.total_revenue_rm).toFixed(2)),
        basePriceRm: Number(toReportNumber(item.base_price_rm).toFixed(2)),
        basePriceToken: Math.round(toReportNumber(item.base_price_token)),
        lastOrderedAt,
        imageUrl: item.image_url || '',
        isActive: Boolean(item.is_active)
      };
    });
  });

  const filteredProducts = products.filter((product) => {
    if (!cutoffDate || !product.lastOrderedAt) {
      return true;
    }

    return product.lastOrderedAt.getTime() >= cutoffDate.getTime();
  });

  const sortedProducts = filteredProducts.sort((a, b) =>
    b.quantitySold - a.quantitySold
      || b.revenueRm - a.revenueRm
      || a.name.localeCompare(b.name)
  );

  const chartData = sortedProducts.slice(0, 5).map((product) => ({
    name: product.name,
    revenueRm: product.revenueRm,
    quantitySold: product.quantitySold
  }));

  const totalUnitsSold = sortedProducts.reduce((acc, product) => acc + product.quantitySold, 0);
  const totalRevenueRm = sortedProducts.reduce((acc, product) => acc + product.revenueRm, 0);
  const topProduct = sortedProducts[0] || null;

  return {
    products: sortedProducts,
    chartData,
    summary: {
      totalProducts: sortedProducts.length,
      totalUnitsSold,
      totalRevenueRm: Number(totalRevenueRm.toFixed(2)),
      topProduct: topProduct?.name || '-',
      topProductUnits: topProduct?.quantitySold || 0
    }
  };
}
