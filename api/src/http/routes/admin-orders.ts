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
          o.token_amount_charged as tokenAmountCharged,
          o.payment_mode as paymentMode,
          o.status as status,
          COALESCE((
            SELECT lts.tier_code
            FROM loyalty_tier_snapshots lts
            WHERE lts.user_id = u.id
            ORDER BY lts.effective_at DESC, lts.id DESC
            LIMIT 1
          ), 'kawan') AS tier_code,
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
        return reply.send({ orders: [] });
      }

      // 2. Fetch Order Items for these orders
      const orderIds = orderRows.map(o => o.internal_id);
      const [itemRows] = await connection.query<RowDataPacket[]>(`
        SELECT 
          oi.order_id,
          oi.id as order_item_id,
          oi.item_name_snapshot as name,
          oi.quantity as qty,
          oi.base_price_rm_snapshot as unitPrice,
          mi.image_url as img
        FROM order_items oi
        LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id IN (?)
      `, [orderIds]);

      const itemIds = itemRows.map(i => i.order_item_id);
      let modifiersByItemId: Record<number, any[]> = {};

      if (itemIds.length > 0) {
        const [modifierRows] = await connection.query<RowDataPacket[]>(`
          SELECT 
            order_item_id,
            modifier_group_name_snapshot as group_name,
            modifier_option_name_snapshot as option_name
          FROM order_item_modifiers
          WHERE order_item_id IN (?)
        `, [itemIds]);

        for (const mod of modifierRows) {
          if (!modifiersByItemId[mod.order_item_id]) {
            modifiersByItemId[mod.order_item_id] = [];
          }
          modifiersByItemId[mod.order_item_id].push({
            group: mod.group_name,
            option: mod.option_name
          });
        }
      }

      // Group items by order_id
      const itemsByOrderId: Record<number, any[]> = {};
      for (const item of itemRows) {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        
        // Map modifiers to specific fields for easy frontend rendering
        let bean, espressoShot, temperature, sparkling, milk, sweetness, iceLevel, remarks;
        const mods = modifiersByItemId[item.order_item_id] || [];
        
        for (const m of mods) {
          const g = m.group.toLowerCase();
          if (g.includes('bean') || g.includes('blend')) bean = m.option;
          else if (g.includes('shot') || g.includes('espresso')) espressoShot = m.option;
          else if (g.includes('temp')) temperature = m.option;
          else if (g.includes('sparkling')) sparkling = m.option;
          else if (g.includes('milk')) milk = m.option;
          else if (g.includes('sweet')) sweetness = m.option;
          else if (g.includes('ice')) iceLevel = m.option;
          else if (g.includes('remark')) remarks = m.option;
        }

        itemsByOrderId[item.order_id].push({
          name: item.name,
          qty: item.qty,
          unitPrice: Number(item.unitPrice || 0),
          img: item.img || '/BOIJITO.png',
          modifiers: mods,
          bean,
          espressoShot,
          temperature,
          sparkling,
          milk,
          sweetness,
          iceLevel,
          remarks
        });
      }

      const formattedOrders = orderRows.map(o => {
        const d = new Date(o.created_at);
        return {
          id: o.id,
          customer: o.customer || 'Unknown',
          email: o.email || '',
          phone: o.phone || '',
          tier: capitalizeWords(String(o.tier_code || 'kawan')),
          memberId: 'C2-' + String(o.user_id).padStart(3, '0'),
          avatar: o.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          items: itemsByOrderId[o.internal_id] || [],
          discount: Number(o.discount || 0),
          total: Number(o.total || 0),
          tokenAmountCharged: Number(o.tokenAmountCharged || 0),
          paymentMode: o.paymentMode || '',
          status: capitalizeWords(o.status),
          payment: o.paymentMode || '',
          paymentStatus: capitalizeWords(o.paymentStatus || ''),
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
          COALESCE((
            SELECT lts.tier_code
            FROM loyalty_tier_snapshots lts
            WHERE lts.user_id = u.id
            ORDER BY lts.effective_at DESC, lts.id DESC
            LIMIT 1
          ), 'kawan') AS tier_code,
          r.reason as customerNotes
        FROM refunds r
        JOIN orders o ON r.order_id = o.id
        JOIN users u ON o.user_id = u.id
        JOIN user_profiles up ON u.id = up.user_id
        ORDER BY r.created_at DESC
        LIMIT 50
      `);

      if (refundRows.length === 0) {
        return reply.send({ refunds: [] });
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
          tier: capitalizeWords(String(r.tier_code || 'kawan')),
          memberId: 'C2-' + String(r.user_id).padStart(3, '0'),
          amount: Number(r.amount || 0),
          reason: r.reason || 'Other',
          paymentMethod: r.paymentMethod || '',
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

  app.patch('/v1/admin/orders/:orderId/status', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const { status } = request.body as { status: string };

    if (!['preparing', 'ready_for_pickup', 'collected', 'completed'].includes(status)) {
      return reply.status(400).send({ error: { code: 'invalid_status', message: 'Invalid status' } });
    }

    const effectiveStatus = status === 'completed' ? 'collected' : status;

    const connection = await mysqlPool.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM orders WHERE order_ref = :orderId LIMIT 1`,
        { orderId }
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'Order not found' } });
      }

      const internalId = rows[0].id;

      await connection.execute(
        `
          UPDATE orders
          SET status = :status
          WHERE id = :internalId
        `,
        { status: effectiveStatus, internalId }
      );

      // Insert into order_status_history
      await connection.execute(
        `
          INSERT INTO order_status_history (
            order_id,
            to_status,
            changed_by_type,
            changed_by_id,
            reason,
            created_at
          )
          VALUES (
            :internalId,
            :status,
            'admin',
            'admin',
            'Updated via Barista app',
            UTC_TIMESTAMP()
          )
        `,
        { internalId, status: effectiveStatus }
      );

      return reply.send({ success: true, status: effectiveStatus });
    } finally {
      connection.release();
    }
  });
}
