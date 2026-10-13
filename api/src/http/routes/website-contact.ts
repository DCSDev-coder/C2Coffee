import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { sendWebsiteContactEmail } from '../../services/otp-email.js';

const websiteContactSchema = z.object({
  form_type: z.enum(['collaboration-inquiry', 'footer-newsletter']),
  subject: z.string().trim().min(1).max(160),
  name: z.string().trim().max(120).optional().default(''),
  brand: z.string().trim().max(160).optional().default(''),
  email: z.string().trim().email().max(255).optional().or(z.literal('')).default(''),
  phone: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().max(5000).optional().default(''),
});

export async function registerWebsiteContactRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/public/contact',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const payload = websiteContactSchema.parse(request.body);
      const isCollaboration = payload.form_type === 'collaboration-inquiry';

      if (isCollaboration && (!payload.name || !payload.brand || !payload.email || !payload.message)) {
        return reply.status(400).send({
          error: 'required_contact_fields_missing',
          message: 'Name, brand, email, and collaboration idea are required.',
        });
      }

      if (!isCollaboration && !payload.email) {
        return reply.status(400).send({
          error: 'email_required',
          message: 'An email address is required.',
        });
      }

      const recipient = isCollaboration
        ? env.COLLABORATION_EMAIL_ADDRESS
        : env.SUPPORT_EMAIL_ADDRESS;

      await sendWebsiteContactEmail({
        to: recipient,
        subject: payload.subject,
        formType: payload.form_type,
        name: payload.name,
        brand: payload.brand,
        email: payload.email,
        phone: payload.phone,
        message: payload.message,
      });

      return {
        success: true,
        message: isCollaboration
          ? 'Your collaboration inquiry has been sent.'
          : 'Your email has been received.',
      };
    },
  );
}
