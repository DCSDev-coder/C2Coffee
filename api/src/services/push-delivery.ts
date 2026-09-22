import { JWT } from 'google-auth-library';
import type { RowDataPacket } from 'mysql2/promise';

import { env } from '../config/env.js';
import { mysqlPool } from '../db/mysql.js';

type PushTokenRow = RowDataPacket & {
  id: number;
  push_token: string;
};

type StaffPushTokenRow = PushTokenRow & {
  platform: 'android' | 'ios' | 'web';
};

export type StaffPushDeliveryResult = {
  attemptedTokens: number;
  deliveredTokens: number;
  invalidTokens: number;
  failedTokens: number;
  webTokens: number;
};

type PushDeliveryInput = {
  userId: number;
  title: string;
  body: string;
  data?: Record<string, string>;
};

type StaffPushDeliveryInput = {
  tenantId: number;
  roleCodes: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
};

type CustomerTenantPushDeliveryInput = {
  tenantId: number;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type PushDeliveryResult = {
  attemptedTokens: number;
  deliveredTokens: number;
  invalidTokens: number;
  failedTokens: number;
  failureReasons: string[];
};

type FcmMessageInput = Pick<PushDeliveryInput, 'title' | 'body' | 'data'> & {
  // Android order alerts are data-only so Firebase may start the Barista
  // background isolate, which claims the durable print job before notifying.
  backgroundDataDelivery?: boolean;
  // Web FCM uses the standard notification payload, which FCM can display
  // reliably while the Barista Console is backgrounded.
  webPushDelivery?: boolean;
};

type FcmServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

let fcmClient: JWT | null = null;
let fcmProjectId: string | null = null;

function fcmConfiguration(): { client: JWT; projectId: string } | null {
  if (!env.FCM_DELIVERY_ENABLED) return null;

  if (!fcmClient || !fcmProjectId) {
    const serviceAccount = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON) as Partial<FcmServiceAccount>;
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('FCM service account is incomplete.');
    }
    fcmClient = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging']
    });
    fcmProjectId = serviceAccount.project_id;
  }

  return { client: fcmClient, projectId: fcmProjectId };
}

async function sendFcmMessage(
  client: JWT,
  projectId: string,
  token: string,
  input: FcmMessageInput
): Promise<{ invalidToken: boolean }> {
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) throw new Error('FCM access token could not be created.');

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        token,
        ...(input.backgroundDataDelivery
          ? {
              data: {
                ...input.data,
                notification_title: input.title,
                notification_body: input.body
              },
              android: { priority: 'HIGH' }
            }
          : {
              notification: { title: input.title, body: input.body },
              data: input.data,
              android: { priority: 'HIGH', notification: { channel_id: 'c2_order_updates' } }
            }),
        apns: { payload: { aps: { sound: 'default' } } },
        ...(input.webPushDelivery ? { webpush: { headers: { Urgency: 'high' } } } : {})
      }
    })
  });
  if (response.ok) return { invalidToken: false };

  const body = await response.json().catch(() => null) as { error?: { status?: string } } | null;
  const providerStatus = body?.error?.status;
  if (providerStatus === 'UNREGISTERED' || providerStatus === 'NOT_FOUND') {
    return { invalidToken: true };
  }
  throw new Error(`FCM delivery failed with HTTP ${response.status} (${providerStatus || 'unknown'}).`);
}

/**
 * Delivers only presentation-safe notification content. A delivery failure must
 * never roll back a paid order or its in-app notification record.
 */
export async function deliverPushToUser(input: PushDeliveryInput): Promise<void> {
  const configuration = fcmConfiguration();
  if (!configuration) return;

  const [tokens] = await mysqlPool.query<PushTokenRow[]>(
    `SELECT id, push_token
     FROM push_tokens
     WHERE user_id = :userId AND status = 'active'
     ORDER BY last_seen_at DESC
     LIMIT 500`,
    { userId: input.userId }
  );
  if (tokens.length === 0) return;

  const inactiveTokenIds: number[] = [];
  // Keep one failed provider response from preventing delivery attempts to all
  // other registered devices while avoiding an unbounded parallel burst.
  for (let index = 0; index < tokens.length; index += 20) {
    const batch = tokens.slice(index, index + 20);
    const outcomes = await Promise.allSettled(
      batch.map((row) => sendFcmMessage(configuration.client, configuration.projectId, row.push_token, input))
    );
    outcomes.forEach((outcome, batchIndex) => {
      if (outcome.status === 'fulfilled' && outcome.value.invalidToken) {
        inactiveTokenIds.push(batch[batchIndex].id);
      }
    });
  }

  if (inactiveTokenIds.length > 0) {
    await mysqlPool.query(
      `UPDATE push_tokens
       SET status = 'inactive', last_seen_at = UTC_TIMESTAMP()
       WHERE id IN (${inactiveTokenIds.map(() => '?').join(', ')})`,
      inactiveTokenIds
    );
  }
}

/**
 * Sends a customer-facing marketing update to active devices in one tenant.
 * The caller persists the in-app notification first, so an FCM outage cannot
 * make a campaign announcement disappear from the customer notification feed.
 */
export async function deliverPushToCustomerTenant(
  input: CustomerTenantPushDeliveryInput
): Promise<PushDeliveryResult> {
  const configuration = fcmConfiguration();
  if (!configuration) return { attemptedTokens: 0, deliveredTokens: 0, invalidTokens: 0, failedTokens: 0, failureReasons: [] };

  const [tokens] = await mysqlPool.query<PushTokenRow[]>(
    `
      SELECT pt.id, pt.push_token
      FROM push_tokens pt
      JOIN users u ON u.id = pt.user_id
      JOIN customer_tenant_memberships ctm
        ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
      LEFT JOIN customer_notification_preferences cnp ON cnp.user_id = pt.user_id
      WHERE pt.status = 'active'
        AND u.status = 'active'
        AND COALESCE(cnp.marketing_enabled, 1) = 1
      GROUP BY pt.id, pt.push_token
      ORDER BY pt.last_seen_at DESC
      LIMIT 5000
    `,
    { tenantId: input.tenantId }
  );
  if (tokens.length === 0) return { attemptedTokens: 0, deliveredTokens: 0, invalidTokens: 0, failedTokens: 0, failureReasons: [] };

  const inactiveTokenIds: number[] = [];
  let deliveredTokens = 0;
  let failedTokens = 0;
  const failureReasons = new Set<string>();
  for (let index = 0; index < tokens.length; index += 20) {
    const batch = tokens.slice(index, index + 20);
    const outcomes = await Promise.allSettled(
      batch.map((row) => sendFcmMessage(configuration.client, configuration.projectId, row.push_token, input))
    );
    outcomes.forEach((outcome, batchIndex) => {
      if (outcome.status === 'fulfilled') {
        if (outcome.value.invalidToken) {
          inactiveTokenIds.push(batch[batchIndex].id);
        } else {
          deliveredTokens++;
        }
      } else {
        failedTokens++;
        failureReasons.add(outcome.reason instanceof Error ? outcome.reason.message : 'Unknown FCM delivery failure.');
      }
    });
  }

  if (inactiveTokenIds.length > 0) {
    await mysqlPool.query(
      `UPDATE push_tokens
       SET status = 'inactive', last_seen_at = UTC_TIMESTAMP()
       WHERE id IN (${inactiveTokenIds.map(() => '?').join(', ')})`,
      inactiveTokenIds
    );
  }

  return {
    attemptedTokens: tokens.length,
    deliveredTokens,
    invalidTokens: inactiveTokenIds.length,
    failedTokens,
    failureReasons: [...failureReasons]
  };
}

/**
 * Sends operational alerts to staff in the same tenant. Payload text is
 * deliberately generic; the app reloads authorised queue data after receipt.
 */
export async function deliverPushToStaff(input: StaffPushDeliveryInput): Promise<StaffPushDeliveryResult> {
  const configuration = fcmConfiguration();
  if (!configuration || input.roleCodes.length === 0) {
    return { attemptedTokens: 0, deliveredTokens: 0, invalidTokens: 0, failedTokens: 0, webTokens: 0 };
  }

  const rolePlaceholders = input.roleCodes.map(() => '?').join(', ');
  const [tokens] = await mysqlPool.query<StaffPushTokenRow[]>(
    `SELECT apt.id, apt.push_token, apt.platform
     FROM admin_push_tokens apt
     JOIN admin_users au ON au.id = apt.admin_user_id
     JOIN admin_user_roles aur ON aur.admin_user_id = au.id
     JOIN admin_roles ar ON ar.id = aur.admin_role_id
     WHERE apt.tenant_id = ?
       AND apt.status = 'active'
       AND au.status = 'active'
       AND ar.code IN (${rolePlaceholders})
     GROUP BY apt.id, apt.push_token
     ORDER BY MAX(apt.last_seen_at) DESC
     LIMIT 500`,
    [input.tenantId, ...input.roleCodes]
  );
  if (tokens.length === 0) {
    return { attemptedTokens: 0, deliveredTokens: 0, invalidTokens: 0, failedTokens: 0, webTokens: 0 };
  }

  const inactiveTokenIds: number[] = [];
  let deliveredTokens = 0;
  let failedTokens = 0;
  for (let index = 0; index < tokens.length; index += 20) {
    const batch = tokens.slice(index, index + 20);
    const outcomes = await Promise.allSettled(
      batch.map((row) => sendFcmMessage(configuration.client, configuration.projectId, row.push_token, {
        ...input,
        // Android remains data-only to wake the native printing handler. Web
        // and iOS receive FCM's standard notification presentation.
        backgroundDataDelivery: row.platform === 'android',
        webPushDelivery: row.platform === 'web'
      }))
    );
    outcomes.forEach((outcome, batchIndex) => {
      if (outcome.status === 'fulfilled') {
        if (outcome.value.invalidToken) {
          inactiveTokenIds.push(batch[batchIndex].id);
        } else {
          deliveredTokens++;
        }
      } else {
        failedTokens++;
      }
    });
  }

  if (inactiveTokenIds.length > 0) {
    await mysqlPool.query(
      `UPDATE admin_push_tokens
       SET status = 'inactive', last_seen_at = UTC_TIMESTAMP()
       WHERE id IN (${inactiveTokenIds.map(() => '?').join(', ')})`,
      inactiveTokenIds
    );
  }

  return {
    attemptedTokens: tokens.length,
    deliveredTokens,
    invalidTokens: inactiveTokenIds.length,
    failedTokens,
    webTokens: tokens.filter((token) => token.platform === 'web').length
  };
}
