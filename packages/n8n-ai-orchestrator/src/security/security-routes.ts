import type { FastifyInstance } from 'fastify';
import { getSecurityPreset } from './security-config.js';

export async function registerSecurityRoutes(server: FastifyInstance): Promise<void> {
  server.get('/api/v1/ai/security', async () => {
    const cfg = getSecurityPreset();
    return {
      features: {
        rateLimit: !!cfg.rateLimit,
        authentication: (cfg.auth?.apiKeys?.length || 0) > 0,
        encryption: true,
        audit: process.env.SECURITY_ENABLE_AUDIT === 'true',
      },
    };
  });
}

export async function registerSecurityUtilities(_server: FastifyInstance): Promise<void> {
  // Placeholder for utilities (token mint, key mgmt, etc.)
}

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SecurityAuditor, generateSecurityReport } from './security-audit.js';
import { validateInput, generateSecureToken, hashSensitiveData } from './security-middleware.js';
import { validators } from './input-validators.js';
import { appMetrics } from '../monitoring/app-metrics.js';

// Security status schema
const SecurityStatusSchema = z.object({
  enabled: z.boolean(),
  features: z.object({
    rateLimit: z.boolean(),
    authentication: z.boolean(),
    encryption: z.boolean(),
    audit: z.boolean(),
  }),
  stats: z.object({
    blockedRequests: z.number(),
    failedAuth: z.number(),
    rateLimitHits: z.number(),
  }),
});

export async function registerSecurityRoutes(server: FastifyInstance) {
  // Security status endpoint
  server.get('/api/v1/security/status', async (request, reply) => {
    const status = {
      enabled: true,
      features: {
        rateLimit: !!process.env.SECURITY_RATE_LIMIT,
        authentication: !!process.env.SECURITY_API_KEYS,
        encryption: true,
        audit: process.env.SECURITY_ENABLE_AUDIT === 'true',
      },
      stats: {
        blockedRequests: 0, // Would come from metrics
        failedAuth: 0, // Would come from metrics
        rateLimitHits: 0, // Would come from metrics
      },
    };

    return status;
  });

  // Run security audit (admin only)
  server.post('/api/v1/security/audit', {
    preHandler: [
      validateInput(z.object({
        targetPath: z.string().optional(),
      })),
    ],
  }, async (request: FastifyRequest<{ Body: { targetPath?: string } }>, reply) => {
    // Check admin permissions (simplified for demo)
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey || !apiKey.includes('admin')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    const auditor = new SecurityAuditor();
    const targetPath = request.body.targetPath || process.cwd();
    
    try {
      const result = await auditor.runAudit(targetPath);
      const report = generateSecurityReport(result);
      
      // Track audit event
      appMetrics.audit.events.inc({
        event_type: 'security_audit',
        user_id: 'admin',
      });
      
      return {
        summary: result.summary,
        report,
        issues: result.issues,
      };
    } catch (error) {
      return reply.status(500).send({
        error: 'Audit failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Generate secure token
  server.post('/api/v1/security/generate-token', {
    preHandler: [
      validateInput(z.object({
        length: z.number().min(16).max(128).optional(),
        purpose: z.string().optional(),
      })),
    ],
  }, async (request: FastifyRequest<{ Body: { length?: number; purpose?: string } }>, reply) => {
    const { length = 32, purpose } = request.body;
    
    const token = generateSecureToken(length);
    const hashedToken = hashSensitiveData(token);
    
    // Log token generation
    appMetrics.audit.events.inc({
      event_type: 'token_generated',
      user_id: 'system',
    });
    
    return {
      token,
      hashedToken,
      purpose,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  });

  // Validate input against schema
  server.post('/api/v1/security/validate', {
    preHandler: [
      validateInput(z.object({
        schemaType: z.enum(['operation', 'prompt', 'workflow']),
        data: z.any(),
      })),
    ],
  }, async (request: FastifyRequest<{ Body: { schemaType: string; data: any } }>, reply) => {
    const { schemaType, data } = request.body;
    
    try {
      let schema;
      switch (schemaType) {
        case 'operation':
          schema = validators.operation.batch;
          break;
        case 'prompt':
          schema = validators.ai.prompt;
          break;
        case 'workflow':
          schema = validators.workflow.id;
          break;
        default:
          throw new Error('Invalid schema type');
      }
      
      const validated = await schema.parseAsync(data);
      
      return {
        valid: true,
        validated,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors,
        };
      }
      throw error;
    }
  });

  // Security headers test endpoint
  server.get('/api/v1/security/headers-test', async (request, reply) => {
    // This endpoint tests if security headers are properly set
    return {
      message: 'Check response headers for security headers',
      headers: {
        'X-Content-Type-Options': 'Should be nosniff',
        'X-Frame-Options': 'Should be DENY',
        'X-XSS-Protection': 'Should be 1; mode=block',
        'Content-Security-Policy': 'Should be present',
      },
    };
  });

  // Rate limit test endpoint
  server.get('/api/v1/security/rate-limit-test', async (request, reply) => {
    // This endpoint can be used to test rate limiting
    return {
      message: 'Request successful',
      timestamp: new Date().toISOString(),
      remaining: reply.getHeader('X-RateLimit-Remaining'),
      limit: reply.getHeader('X-RateLimit-Limit'),
    };
  });

  // Get security recommendations
  server.get('/api/v1/security/recommendations', async (request, reply) => {
    return {
      recommendations: [
        {
          category: 'Authentication',
          items: [
            'Use strong API keys (32+ characters)',
            'Rotate API keys regularly',
            'Implement IP allowlisting for production',
            'Use mutual TLS for service-to-service communication',
          ],
        },
        {
          category: 'Network Security',
          items: [
            'Always use HTTPS in production',
            'Implement firewall rules',
            'Use VPN for administrative access',
            'Enable DDoS protection',
          ],
        },
        {
          category: 'Data Protection',
          items: [
            'Encrypt sensitive data at rest',
            'Use secure key management (KMS)',
            'Implement data retention policies',
            'Regular backup and recovery testing',
          ],
        },
        {
          category: 'Monitoring',
          items: [
            'Monitor authentication failures',
            'Alert on unusual API usage patterns',
            'Track rate limit violations',
            'Review audit logs regularly',
          ],
        },
        {
          category: 'Development',
          items: [
            'Keep dependencies updated',
            'Use security linters',
            'Implement security testing in CI/CD',
            'Regular security training for developers',
          ],
        },
      ],
    };
  });

  // CSP report endpoint
  server.post('/api/v1/security/csp-report', async (request, reply) => {
    // Log CSP violations
    console.warn('CSP Violation:', request.body);
    
    appMetrics.errors.unhandled.inc({
      error_type: 'csp_violation',
    });
    
    reply.status(204).send();
  });
}

// Security utility endpoints
export async function registerSecurityUtilities(server: FastifyInstance) {
  // Password strength checker
  server.post('/api/v1/security/check-password', {
    preHandler: [
      validateInput(z.object({
        password: z.string(),
      })),
    ],
  }, async (request: FastifyRequest<{ Body: { password: string } }>, reply) => {
    const { password } = request.body;
    
    const checks = {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      common: !['password', '12345678', 'qwerty'].includes(password.toLowerCase()),
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    const strength = score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong';
    
    return {
      strength,
      score: `${score}/6`,
      checks,
      recommendations: Object.entries(checks)
        .filter(([_, passed]) => !passed)
        .map(([check]) => `Add ${check.replace('_', ' ')}`),
    };
  });

  // URL safety checker
  server.post('/api/v1/security/check-url', {
    preHandler: [
      validateInput(z.object({
        url: validators.common.url,
      })),
    ],
  }, async (request: FastifyRequest<{ Body: { url: string } }>, reply) => {
    const { url } = request.body;
    
    try {
      const parsed = new URL(url);
      
      const checks = {
        https: parsed.protocol === 'https:',
        knownHost: !parsed.hostname.includes('malicious'), // Simplified check
        noRedirects: !url.includes('bit.ly') && !url.includes('tinyurl'),
        validTld: /\.(com|org|net|io|dev|edu|gov)$/i.test(parsed.hostname),
      };
      
      const safe = Object.values(checks).every(Boolean);
      
      return {
        safe,
        checks,
        recommendation: safe ? 'URL appears safe' : 'Exercise caution with this URL',
      };
    } catch (error) {
      return reply.status(400).send({
        error: 'Invalid URL',
        message: 'Could not parse the provided URL',
      });
    }
  });
}