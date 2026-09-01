import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

type OtpEmailPayload = {
  to: string;
  otpCode: string;
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
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
    subject: 'Your C2 Coffee verification code',
    text: [
      'Your C2 Coffee verification code is:',
      '',
      payload.otpCode,
      '',
      'This code expires soon. If you did not request it, ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <p>Your C2 Coffee verification code is:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;">${payload.otpCode}</p>
        <p>This code expires soon. If you did not request it, ignore this email.</p>
      </div>
    `
  });

  return { messageId: info.messageId };
}
