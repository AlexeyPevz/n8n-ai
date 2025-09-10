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

export class ValidationFailedError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_FAILED', 422, details);
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

export class AmbiguousPromptError extends AppError {
  constructor(message = 'Prompt is empty or too vague', details?: unknown) {
    super(message, 'AMBIGUOUS_PROMPT', 400, details);
  }
}

export class InvalidLLMJsonError extends AppError {
  constructor(message = 'LLM returned invalid JSON', details?: unknown) {
    super(message, 'INVALID_LLM_JSON', 400, details);
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

export function errorToResponse(error: AppError): { error: { code: string; message: string; details: unknown; timestamp: string; suggestion?: string; nextActions?: string[] } } {
  const details = (error.details ?? {}) as Record<string, unknown>;
  const suggestion = (details.suggestion as string | undefined) ?? (error as unknown as { suggestion?: string }).suggestion;
  const nextActions = (details.nextActions as string[] | undefined) ?? (error as unknown as { nextActions?: string[] }).nextActions;
  return {
    error: {
      code: error.code,
      message: error.message,
      details,
      timestamp: new Date().toISOString(),
      ...(suggestion ? { suggestion } : {}),
      ...(nextActions ? { nextActions } : {})
    }
  };
}