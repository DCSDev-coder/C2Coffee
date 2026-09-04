import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';

type AuditLogRow = RowDataPacket & {
  id: number;
  created_at: Date;
  admin_user_id: number | null;
  username: string | null;
  full_name: string | null;
  email: string | null;
  action_code: string;
  target_type: string;
  target_id: number | null;
  reason_code: string | null;
  reason_note: string | null;
  ip_address: string | null;
  user_agent: string | null;
  effective_roles_json: string | null;
};

type AuditLogResponse = {
  logs: Array<{
    id: number;
    timestamp: string;
    date: string;
    time: string;
    actorName: string;
    actorUsername: string;
    actorEmail: string;
    actionCode: string;
    actionLabel: string;
    targetType: string;
    targetLabel: string;
    targetId: number | null;
    reasonCode: string;
    reasonNote: string;
    ipAddress: string;
    userAgent: string;
  }>;
  summary: {
    totalLogs: number;
    totalActors: number;
    topActionCode: string;
    topActionLabel: string;
    topActionCount: number;
    topTargetType: string;
    topTargetLabel: string;
    topTargetCount: number;
    latestAt: string | null;
  };
};

function toTitleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatAuditActionLabel(actionCode: string): string {
  const normalized = String(actionCode ?? '').trim().toLowerCase();
  if (!normalized) {
    return 'Unknown Action';
  }

  return toTitleCase(normalized);
}

function formatAuditTargetLabel(targetType: string, targetId: number | null): string {
  const targetName = toTitleCase(String(targetType ?? '').trim().toLowerCase()) || 'Target';
  return targetId === null ? targetName : `${targetName} #${targetId}`;
}

function formatDisplayDate(dateObj: Date): string {
  return new Intl.DateTimeFormat('en-MY', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(dateObj);
}

function formatDisplayTime(dateObj: Date): string {
  return new Intl.DateTimeFormat('en-MY', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(dateObj);
}

export async function registerAdminAuditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/audit-logs', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const query = typeof request.query === 'object' && request.query !== null
      ? (request.query as {
          search?: string;
          target_type?: string;
          action_code?: string;
          selected_date?: string;
          limit?: string;
        })
      : {};

    const searchTerm = String(query.search ?? '').trim().toLowerCase();
    const targetType = String(query.target_type ?? '').trim().toLowerCase();
    const actionCode = String(query.action_code ?? '').trim().toLowerCase();
    const selectedDateRaw = String(query.selected_date ?? '').trim();
    const selectedDate = selectedDateRaw ? new Date(selectedDateRaw) : null;
    const safeSelectedDate = selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate : null;
    const limit = Math.min(Math.max(Number.parseInt(String(query.limit ?? '250'), 10) || 250, 1), 1000);

    const [rows] = await mysqlPool.query<AuditLogRow[]>(
      `
        SELECT
          aal.id,
          aal.created_at,
          aal.admin_user_id,
          au.username,
          au.full_name,
          au.email,
          aal.action_code,
          aal.target_type,
          aal.target_id,
          aal.reason_code,
          aal.reason_note,
          aal.ip_address,
          aal.user_agent,
          aal.effective_roles_json
        FROM admin_audit_logs aal
        LEFT JOIN admin_users au
          ON au.id = aal.admin_user_id
        WHERE (:targetType = '' OR LOWER(aal.target_type) = :targetType)
          AND (:actionCode = '' OR LOWER(aal.action_code) = :actionCode)
          AND (
            :selectedDate IS NULL
            OR DATE(aal.created_at) = DATE(:selectedDate)
          )
          AND (
            :searchTerm = ''
            OR LOWER(COALESCE(au.username, '')) LIKE CONCAT('%', :searchTerm, '%')
            OR LOWER(COALESCE(au.full_name, '')) LIKE CONCAT('%', :searchTerm, '%')
            OR LOWER(COALESCE(au.email, '')) LIKE CONCAT('%', :searchTerm, '%')
            OR LOWER(aal.action_code) LIKE CONCAT('%', :searchTerm, '%')
            OR LOWER(aal.target_type) LIKE CONCAT('%', :searchTerm, '%')
            OR LOWER(COALESCE(aal.reason_code, '')) LIKE CONCAT('%', :searchTerm, '%')
            OR LOWER(COALESCE(aal.reason_note, '')) LIKE CONCAT('%', :searchTerm, '%')
            OR LOWER(COALESCE(aal.ip_address, '')) LIKE CONCAT('%', :searchTerm, '%')
          )
        ORDER BY aal.created_at DESC, aal.id DESC
        LIMIT :limit
      `,
      {
        actionCode,
        limit,
        searchTerm,
        selectedDate: safeSelectedDate,
        targetType
      }
    );

    const normalizedLogs = rows.map((row) => {
      const createdAt = new Date(row.created_at);
      const actorUsername = row.username || 'system';
      const actorName = row.full_name || row.username || 'System';
      const actorEmail = row.email || '';
      const actionLabel = formatAuditActionLabel(row.action_code);
      const targetLabel = formatAuditTargetLabel(row.target_type, row.target_id);

      return {
        id: row.id,
        timestamp: createdAt.toISOString(),
        date: formatDisplayDate(createdAt),
        time: formatDisplayTime(createdAt),
        actorName,
        actorUsername,
        actorEmail,
        actionCode: row.action_code,
        actionLabel,
        targetType: row.target_type,
        targetLabel,
        targetId: row.target_id,
        reasonCode: row.reason_code || '',
        reasonNote: row.reason_note || '',
        ipAddress: row.ip_address || '',
        userAgent: row.user_agent || ''
      };
    });

    const uniqueActors = new Set(normalizedLogs.map((log) => log.actorUsername).filter(Boolean));
    const actionCounts = new Map<string, number>();
    const targetCounts = new Map<string, number>();

    for (const log of normalizedLogs) {
      actionCounts.set(log.actionCode, (actionCounts.get(log.actionCode) || 0) + 1);
      targetCounts.set(log.targetType, (targetCounts.get(log.targetType) || 0) + 1);
    }

    const [topActionCode = '', topActionCount = 0] = [...actionCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
    const [topTargetType = '', topTargetCount = 0] = [...targetCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
    const latestAt = normalizedLogs[0]?.timestamp || null;

    const response: AuditLogResponse = {
      logs: normalizedLogs,
      summary: {
        totalLogs: normalizedLogs.length,
        totalActors: uniqueActors.size,
        topActionCode,
        topActionLabel: formatAuditActionLabel(topActionCode),
        topActionCount,
        topTargetType,
        topTargetLabel: toTitleCase(topTargetType) || 'Target',
        topTargetCount,
        latestAt
      }
    };

    return response;
  });
}
