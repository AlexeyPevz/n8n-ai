/**
 * Secure CORS Configuration
 * ASVS V11.6, V12.4 Compliance
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// CORS configuration schema
const CORSConfigSchema = z.object({
  origins: z.array(z.string()),
  credentials: z.boolean(),
  methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
  allowedHeaders: z.array(z.string()).default(['Content-Type', 'Authorization', 'X-API-Key']),
  exposedHeaders: z.array(z.string()).default(['X-RateLimit-Limit', 'X-RateLimit-Remaining']),
  maxAge: z.number().default(86400), // 24 hours
});

export type CORSConfig = z.infer<typeof CORSConfigSchema>;

/**
 * Environment-based CORS configuration
 */
export function getCORSConfig(): CORSConfig {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const isStaging = process.env.NODE_ENV === 'staging';

  // Parse allowed origins from environment
  const envOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
  
  let origins: string[];
  
  if (isDevelopment) {
    // Development: Allow localhost and common dev ports
    origins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      ...envOrigins,
    ];
  } else if (isStaging) {
    // Staging: Allow staging domains
    origins = [
      'https://staging.n8n-ai.com',
      'https://staging-app.n8n-ai.com',
      ...envOrigins,
    ];
  } else {
    // Production: Only allow specific domains
    origins = [
      'https://app.n8n-ai.com',
      'https://n8n-ai.com',
      ...envOrigins,
    ];
  }

  return {
    origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Session-ID',
      'X-User-ID',
      'X-Request-ID',
      'X-CSRF-Token',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID',
    ],
    maxAge: 86400, // 24 hours
  };
}

/**
 * CORS validation function
 */
export function validateOrigin(origin: string, allowedOrigins: string[]): boolean {
  // Allow null origin for same-origin requests
  if (!origin) return true;

  // Check exact match
  if (allowedOrigins.includes(origin)) return true;

  // Check wildcard subdomains (e.g., *.example.com)
  for (const allowedOrigin of allowedOrigins) {
    if (allowedOrigin.startsWith('*.')) {
      const domain = allowedOrigin.slice(2);
      // Check if origin ends with domain and has a subdomain
      if (origin.endsWith(domain) && origin.length > domain.length) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Secure CORS plugin for Fastify
 */
export async function secureCORSPlugin(fastify: FastifyInstance) {
  const config = getCORSConfig();

  // Preflight handler
  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin as string;
    const method = request.method;

    // Handle preflight requests
    if (method === 'OPTIONS') {
      if (origin && validateOrigin(origin, config.origins)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Methods', config.methods.join(', '));
        reply.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
        reply.header('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
        reply.header('Access-Control-Max-Age', config.maxAge.toString());
        
        if (config.credentials) {
          reply.header('Access-Control-Allow-Credentials', 'true');
        }
      } else {
        reply.status(403).send({
          error: 'CORS policy violation',
          message: 'Origin not allowed',
        });
        return;
      }
    } else {
      // Handle actual requests
      if (origin) {
        if (validateOrigin(origin, config.origins)) {
          reply.header('Access-Control-Allow-Origin', origin);
          reply.header('Vary', 'Origin');
          
          if (config.credentials) {
            reply.header('Access-Control-Allow-Credentials', 'true');
          }
        } else {
          reply.status(403).send({
            error: 'CORS policy violation',
            message: 'Origin not allowed',
          });
          return;
        }
      }
    }
  });

  // Add CORS headers to all responses
  fastify.addHook('onSend', async (request, reply) => {
    const origin = request.headers.origin as string;
    
    if (origin && validateOrigin(origin, config.origins)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      
      if (config.credentials) {
        reply.header('Access-Control-Allow-Credentials', 'true');
      }
    }
  });
}

/**
 * CSRF Protection Middleware
 */
export function csrfProtection() {
  return async (request: any, reply: any) => {
    // Skip CSRF for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return;
    }

    // Skip CSRF for API endpoints with API key
    if (request.headers['x-api-key']) {
      return;
    }

    // Check CSRF token
    const csrfToken = request.headers['x-csrf-token'] || request.body?.csrfToken;
    const sessionToken = request.headers['x-session-token'];

    if (!csrfToken || !sessionToken) {
      return reply.status(403).send({
        error: 'CSRF token required',
        message: 'Please include X-CSRF-Token header',
      });
    }

    // Verify CSRF token (simplified - in production, use proper CSRF library)
    const expectedToken = createCSRFToken(sessionToken);
    if (csrfToken !== expectedToken) {
      return reply.status(403).send({
        error: 'Invalid CSRF token',
        message: 'CSRF token verification failed',
      });
    }
  };
}

/**
 * Generate CSRF token
 */
function createCSRFToken(sessionToken: string): string {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(sessionToken + process.env.CSRF_SECRET || 'dev-csrf-secret')
    .digest('hex');
}

/**
 * Security headers middleware
 */
export function securityHeaders() {
  return async (request: any, reply: any) => {
    // Prevent MIME type sniffing
    reply.header('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    reply.header('X-Frame-Options', 'DENY');
    
    // XSS Protection
    reply.header('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    reply.header('Permissions-Policy', 
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );
    
    // Remove server information
    reply.removeHeader('X-Powered-By');
    reply.removeHeader('Server');
  };
}