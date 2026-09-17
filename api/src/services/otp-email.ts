import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

type OtpEmailPayload = {
  to: string;
  otpCode: string;
  subject?: string;
  heading?: string;
};

type SupportTicketEmailPayload = {
  ticketNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  category: string;
  orderReference: string | null;
  subject: string;
  message: string;
  attachments?: Array<{
    fileName: string;
    mimeType: string;
    content: Buffer;
  }>;
};

type OrderReceiptEmailPayload = {
  to: string;
  orderReference: string;
  orderNumber: number;
  storeName: string;
  orderedAt: string;
  pickupAt: string;
  items: Array<{
    name: string;
    quantity: number;
    totalRm: string;
    modifiers: string[];
  }>;
  totalRm: string;
  tokens: number;
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  if (!env.EMAIL_SMTP_HOST) {
    throw new Error('EMAIL_SMTP_HOST is required when OTP_DELIVERY_MODE=email.');
  }

  transporter = nodemailer.createTransport({
    host: env.EMAIL_SMTP_HOST,
    port: env.EMAIL_SMTP_PORT,
    secure: env.EMAIL_SMTP_SECURE,
    auth:
      env.EMAIL_SMTP_USER && env.EMAIL_SMTP_PASSWORD
        ? {
            user: env.EMAIL_SMTP_USER,
            pass: env.EMAIL_SMTP_PASSWORD
          }
        : undefined
  });

  return transporter;
}

export async function sendOtpEmail(payload: OtpEmailPayload): Promise<{
  messageId?: string;
}> {
  const fromAddress = env.EMAIL_FROM_ADDRESS || env.EMAIL_SMTP_USER;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM_ADDRESS is required when OTP_DELIVERY_MODE=email.');
  }

  const mailer = getTransporter();

  const info = await mailer.sendMail({
    from: `"${env.EMAIL_FROM_NAME}" <${fromAddress}>`,
    to: payload.to,
    subject: payload.subject ?? 'Your C2 Coffee verification code',
    text: [
      payload.heading ?? 'Your C2 Coffee verification code is:',
      '',
      payload.otpCode,
      '',
      'This code expires soon. If you did not request it, ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <p>${payload.heading ?? 'Your C2 Coffee verification code is:'}</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;">${payload.otpCode}</p>
        <p>This code expires soon. If you did not request it, ignore this email.</p>
      </div>
    `
  });

  return { messageId: info.messageId };
}

export async function sendSupportTicketEmail(
  payload: SupportTicketEmailPayload
): Promise<{ messageId?: string }> {
  const fromAddress = env.EMAIL_FROM_ADDRESS || env.EMAIL_SMTP_USER;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM_ADDRESS is required for support ticket delivery.');
  }

  const details = [
    `Ticket: ${payload.ticketNumber}`,
    `Customer: ${payload.customerName}`,
    `Email: ${payload.customerEmail || 'Not provided'}`,
    `Phone: ${payload.customerPhone}`,
    `Category: ${payload.category}`,
    `Order reference: ${payload.orderReference || 'Not provided'}`,
    `Evidence files: ${payload.attachments?.length ?? 0}`,
    '',
    `Subject: ${payload.subject}`,
    '',
    payload.message
  ].join('\n');

  const info = await getTransporter().sendMail({
    from: `"${env.EMAIL_FROM_NAME}" <${fromAddress}>`,
    to: env.SUPPORT_EMAIL_ADDRESS,
    replyTo: payload.customerEmail || undefined,
    subject: `[${payload.ticketNumber}] ${payload.subject}`,
    text: details,
    attachments: payload.attachments?.map((attachment) => ({
      filename: attachment.fileName,
      content: attachment.content,
      contentType: attachment.mimeType
    }))
  });

  return { messageId: info.messageId };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character] ?? character));
}

/** Send a transactional receipt using immutable order snapshots. */
export async function sendOrderReceiptEmail(payload: OrderReceiptEmailPayload): Promise<{ messageId?: string }> {
  const fromAddress = env.EMAIL_FROM_ADDRESS || env.EMAIL_SMTP_USER;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM_ADDRESS is required for receipt delivery.');
  }

  const itemText = payload.items.flatMap((item) => [
    `${Math.max(1, item.quantity)} x ${item.name} - RM ${item.totalRm}`,
    ...item.modifiers.map((modifier) => `  ${modifier}`)
  ]);
  const itemHtml = payload.items.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb">
        <strong>${escapeHtml(String(Math.max(1, item.quantity)))} x ${escapeHtml(item.name)}</strong>
        ${item.modifiers.length > 0 ? `<div style="margin-top:4px;color:#6b7280;font-size:13px">${item.modifiers.map(escapeHtml).join('<br>')}</div>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">RM ${escapeHtml(item.totalRm)}</td>
    </tr>`).join('');
  const subject = `Your C2 Coffee receipt - Order #${payload.orderNumber}`;
  const text = [
    'C2 Coffee & Candle',
    `Order #${payload.orderNumber} (${payload.orderReference})`,
    `Store: ${payload.storeName}`,
    `Ordered: ${payload.orderedAt}`,
    `Pickup: ${payload.pickupAt}`,
    '',
    ...itemText,
    '',
    `Total: RM ${payload.totalRm}`,
    `Tokens charged: ${payload.tokens}`,
    '',
    'Thank you for your order.'
  ].join('\n');

  const info = await getTransporter().sendMail({
    from: `"${env.EMAIL_FROM_NAME}" <${fromAddress}>`,
    to: payload.to,
    subject,
    text,
    html: `
      <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
        <h1 style="font-size:24px;margin-bottom:4px">C2 Coffee &amp; Candle</h1>
        <p style="margin-top:0;color:#4b5563">Receipt for order #${escapeHtml(String(payload.orderNumber))}</p>
        <div style="padding:16px;background:#f3f4f6;border-radius:10px">
          <div><strong>Store:</strong> ${escapeHtml(payload.storeName)}</div>
          <div><strong>Order reference:</strong> ${escapeHtml(payload.orderReference)}</div>
          <div><strong>Ordered:</strong> ${escapeHtml(payload.orderedAt)}</div>
          <div><strong>Pickup:</strong> ${escapeHtml(payload.pickupAt)}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:18px">${itemHtml}</table>
        <div style="margin-top:18px;text-align:right;font-size:17px"><strong>Total: RM ${escapeHtml(payload.totalRm)}</strong><br><span style="color:#4b5563">Tokens charged: ${escapeHtml(String(payload.tokens))}</span></div>
        <p style="margin-top:28px">Thank you for your order.</p>
      </div>`
  });

  return { messageId: info.messageId };
}
