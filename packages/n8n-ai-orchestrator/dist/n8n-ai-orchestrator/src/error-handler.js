/**
 * Централизованная обработка ошибок
 */
export class AppError extends Error {
    message;
    code;
    statusCode;
    details;
    constructor(message, code, statusCode = 500, details) {
        super(message);
        this.message = message;
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AppError';
    }
}
export class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', 400, details);
    }
}
export class NotFoundError extends AppError {
    constructor(resource, id) {
        super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
    }
}
export class IntegrationError extends AppError {
    constructor(service, message, details) {
        super(`Integration error with ${service}: ${message}`, 'INTEGRATION_ERROR', 502, details);
    }
}
export class RateLimitError extends AppError {
    constructor(limit, window) {
        super(`Rate limit exceeded: ${limit} requests per ${window}`, 'RATE_LIMIT', 429);
    }
}
export function handleError(error) {
    if (error instanceof AppError) {
        return error;
    }
    if (error instanceof Error) {
        return new AppError(error.message, 'INTERNAL_ERROR', 500);
    }
    return new AppError('An unknown error occurred', 'UNKNOWN_ERROR', 500);
}
export function errorToResponse(error) {
    return {
        error: {
            code: error.code,
            message: error.message,
            details: error.details,
            timestamp: new Date().toISOString()
        }
    };
}
