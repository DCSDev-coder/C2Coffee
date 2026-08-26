import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { authenticateAdminRequest } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';

function formatDisplayDate(dateObj: Date): string {
  if (!dateObj) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(dateObj);
}

function formatDisplayTime(dateObj: Date): string {
  if (!dateObj) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(dateObj);
}

function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

export async function registerAdminOrdersRoutes(app: FastifyInstance) {
  app.get('/v1/admin/orders', async (request, reply) => {
    const connection = await mysqlPool.getConnection();
    try {
      // 1. Fetch Orders
      const [orderRows] = await connection.query<RowDataPacket[]>(`
        SELECT 
          o.id as internal_id,
          o.order_ref as id,
          up.display_name as customer,
          up.email,
          u.phone_e164 as phone,
          u.id as user_id,
          up.avatar_value as avatar,
          o.discount_total_rm as discount,
          o.final_total_rm as total,
          o.status as status,
          p.provider as paymentProvider,
          p.status as paymentStatus,
          p.provider_payment_ref as txnId,
          o.created_at
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN payments p ON o.id = p.order_id
        ORDER BY o.created_at DESC
        LIMIT 50
      `);

      if (orderRows.length === 0) {
        // Fallback to mock data for demonstration purposes if DB is empty
        const mockOrders = [
          {
            id: "ORD-0510-001",
            customer: "miraelys",
            email: "mira@gmail.com",
            phone: "+6011-63793812",
            tier: "Legend",
            memberId: "C2-001",
            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
            items: [{ name: "Bojito", qty: 1, img: "/BOIJITO.png", unitPrice: 15.90 }],
            discount: 0,
            total: 15.90,
            status: "Completed",
            payment: "Touch 'n Go eWallet",
            paymentStatus: "Paid",
            txnId: "TNG291938193183",
            time: "10:21 AM",
            date: "Aug 19, 2026"
          },
          {
            id: "ORD-0510-002",
            customer: "alex_chong",
            email: "alex.chong@gmail.com",
            phone: "+6012-3456789",
            tier: "Gold",
            memberId: "C2-002",
            avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&auto=format&fit=crop&q=80",
            items: [{ name: "Latte", qty: 2, img: "/LATTE.png", unitPrice: 12.00 }],
            discount: 2.00,
            total: 22.00,
            status: "Preparing",
            payment: "Credit Card",
            paymentStatus: "Paid",
            txnId: "CC1234567890",
            time: "10:35 AM",
            date: "Aug 19, 2026"
          }
        ];
        return reply.send({ orders: mockOrders });
      }

      // 2. Fetch Order Items for these orders
      const orderIds = orderRows.map(o => o.internal_id);
      const [itemRows] = await connection.query<RowDataPacket[]>(`
        SELECT 
          oi.order_id,
          oi.item_name_snapshot as name,
          oi.quantity as qty,
          oi.base_price_rm_snapshot as unitPrice,
          mi.image_url as img
        FROM order_items oi
        LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id IN (?)
      `, [orderIds]);

      // Group items by order_id
      const itemsByOrderId: Record<number, any[]> = {};
      for (const item of itemRows) {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        itemsByOrderId[item.order_id].push({
          name: item.name,
          qty: item.qty,
          unitPrice: Number(item.unitPrice || 0),
          img: item.img || '/BOIJITO.png'
        });
      }

      // We need to fetch loyalty tiers. For simplicity, we just assign "Legend" as fallback or we can query loyalty_tier_snapshots if it exists.
      // Since it might not exist yet for all users, we'll hardcode "Legend" or query. Let's just hardcode "Legend" for mock parity or check if user_loyalty exists.
      // We didn't find user_loyalty table earlier.

      const formattedOrders = orderRows.map(o => {
        const d = new Date(o.created_at);
        return {
          id: o.id,
          customer: o.customer || 'Unknown',
          email: o.email || '',
          phone: o.phone || '',
          tier: 'Legend', // Mocking tier until loyalty service is fully implemented
          memberId: 'C2-' + String(o.user_id).padStart(3, '0'),
          avatar: o.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          items: itemsByOrderId[o.internal_id] || [],
          discount: Number(o.discount || 0),
          total: Number(o.total || 0),
          status: capitalizeWords(o.status),
          payment: o.paymentProvider === 'billplz' ? "Touch 'n Go eWallet" : (o.paymentProvider || "Touch 'n Go eWallet"),
          paymentStatus: capitalizeWords(o.paymentStatus || 'Paid'),
          txnId: o.txnId || `TXN${o.internal_id}`,
          time: formatDisplayTime(d),
          date: formatDisplayDate(d)
        };
      });

      return reply.send({ orders: formattedOrders });
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/refunds', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    const connection = await mysqlPool.getConnection();
    try {
      const [refundRows] = await connection.query<RowDataPacket[]>(`
        SELECT 
          r.refund_ref as id,
          o.order_ref as orderId,
          up.display_name as customer,
          up.email,
          u.phone_e164 as phone,
          u.id as user_id,
          r.refund_amount_rm as amount,
          r.reason as reason,
          r.payment_mode as paymentMethod,
          r.status as status,
          r.created_at as requestedAt,
          o.created_at as orderDate,
          r.reason as customerNotes
        FROM refunds r
        JOIN orders o ON r.order_id = o.id
        JOIN users u ON o.user_id = u.id
        JOIN user_profiles up ON u.id = up.user_id
        ORDER BY r.created_at DESC
        LIMIT 50
      `);

      if (refundRows.length === 0) {
        // Fallback to mock data for demonstration purposes if DB is empty
        const mockRefunds = [
          {
            id: "REF-0510-001",
            orderId: "ORD-0510-001",
            customer: "miraelys",
            email: "mira@gmail.com",
            phone: "+6011-63793812",
            tier: "Legend",
            memberId: "C2-001",
            amount: 15.90,
            reason: "Wrong Item",
            paymentMethod: "Touch 'n Go eWallet",
            status: "Approved",
            requestedAt: "Aug 19, 2026 10:15 AM",
            orderDate: "Aug 19, 2026 – 10:18 AM",
            customerNotes: "I received Flat White instead of Latte",
            attachment: "/FLAT WHITE.png",
            timeline: [
              { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
              { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
              { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
            ]
          }
        ];
        return reply.send({ refunds: mockRefunds });
      }

      const formattedRefunds = refundRows.map(r => {
        const reqDate = new Date(r.requestedAt);
        const ordDate = new Date(r.orderDate);
        
        return {
          id: r.id,
          orderId: r.orderId,
          customer: r.customer || 'Unknown',
          email: r.email || '',
          phone: r.phone || '',
          tier: 'Legend', // Mocking tier
          memberId: 'C2-' + String(r.user_id).padStart(3, '0'),
          amount: Number(r.amount || 0),
          reason: r.reason || 'Other',
          paymentMethod: r.paymentMethod === 'direct' ? "Touch 'n Go eWallet" : "C2 Tokens",
          status: capitalizeWords(r.status),
          requestedAt: `${formatDisplayDate(reqDate)} ${formatDisplayTime(reqDate)}`,
          orderDate: `${formatDisplayDate(ordDate)} – ${formatDisplayTime(ordDate)}`,
          customerNotes: r.customerNotes || '',
          attachment: '/FLAT WHITE.png', // Fallback
          timeline: [
            { label: "Refund Requested", date: `${formatDisplayDate(reqDate)} ${formatDisplayTime(reqDate)}`, done: true },
            { label: "Under Review", date: `${formatDisplayDate(reqDate)} ${formatDisplayTime(reqDate)}`, done: r.status !== 'pending' },
            { label: r.status === 'completed' ? "Refund Completed" : "Refund Rejected", date: `${formatDisplayDate(reqDate)} ${formatDisplayTime(reqDate)}`, done: r.status === 'completed' || r.status === 'failed' }
          ]
        };
      });

      return reply.send({ refunds: formattedRefunds });
    } finally {
      connection.release();
    }
  });
}
