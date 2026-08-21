import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  let statusCode = error instanceof ApiError ? error.statusCode : 500;
  let code = error instanceof ApiError ? error.code : 'internal_server_error';
  let message =
    error instanceof ApiError
      ? error.message
      : 'Unexpected server error. Please try again later.';

  // Handle Zod validation errors
  if (error.name === 'ZodError' && (error as any).issues) {
    statusCode = 400;
    code = 'validation_error';
    message = (error as any).issues[0]?.message || 'Invalid input data.';
  }

  request.log.error({ error, statusCode, code }, 'request failed');

  void reply.status(statusCode).send({
    error: {
      code,
      message,
      request_id: request.id
    }
  });
}
