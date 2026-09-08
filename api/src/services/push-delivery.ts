import { JWT } from 'google-auth-library';
import type { RowDataPacket } from 'mysql2/promise';

import { env } from '../config/env.js';
import { mysqlPool } from '../db/mysql.js';

type PushTokenRow = RowDataPacket & {
  id: number;
  push_token: string;
};

type PushDeliveryInput = {
  userId: number;
  title: string;
  body: string;
  data?: Record<string, string>;
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
  input: PushDeliveryInput
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
        notification: { title: input.title, body: input.body },
        data: input.data,
        android: { priority: 'high', notification: { channel_id: 'c2_order_updates' } },
        apns: { payload: { aps: { sound: 'default' } } }
      }
    })
  });
  if (response.ok) return { invalidToken: false };

  const body = await response.json().catch(() => null) as { error?: { status?: string } } | null;
  const providerStatus = body?.error?.status;
  if (providerStatus === 'UNREGISTERED' || providerStatus === 'NOT_FOUND') {
    return { invalidToken: true };
  }
  throw new Error(`FCM delivery failed with HTTP ${response.status}.`);
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
