/**
 * Централизованная обработка ошибок
 */

export class AppError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
  }
}

export class IntegrationError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super(`Integration error with ${service}: ${message}`, 'INTEGRATION_ERROR', 502, details);
  }
}

export class RateLimitError extends AppError {
  constructor(limit: number, window: string) {
    super(`Rate limit exceeded: ${limit} requests per ${window}`, 'RATE_LIMIT', 429);
  }
}

export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new AppError(error.message, 'INTERNAL_ERROR', 500);
  }
  
  return new AppError('An unknown error occurred', 'UNKNOWN_ERROR', 500);
}

export function errorToResponse(error: AppError): { error: { code: string; message: string; details: unknown; timestamp: string } } {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    }
  };
}