/**
 * JWT Session Management Middleware
 * ASVS V3.1-V3.6 Compliance
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';

// JWT payload schema
const JWTPayloadSchema = z.object({
  sub: z.string(), // user ID
  iat: z.number(), // issued at
  exp: z.number(), // expiration
  sessionId: z.string(),
  roles: z.array(z.string()).default([]),
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

// Session store (in production, use Redis)
class SessionStore {
  private sessions = new Map<string, {
    userId: string;
    roles: string[];
    createdAt: number;
    lastAccessed: number;
    expiresAt: number;
  }>();

  create(userId: string, roles: string[] = [], ttlMs: number = 3600000): string {
    const sessionId = randomBytes(32).toString('hex');
    const now = Date.now();
    
    this.sessions.set(sessionId, {
      userId,
      roles,
      createdAt: now,
      lastAccessed: now,
      expiresAt: now + ttlMs,
    });

    // Cleanup expired sessions
    this.cleanup();
    
    return sessionId;
  }

  get(sessionId: string): { userId: string; roles: string[] } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const now = Date.now();
    if (now > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last accessed
    session.lastAccessed = now;
    return {
      userId: session.userId,
      roles: session.roles,
    };
  }

  revoke(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  revokeUser(userId: string): number {
    let count = 0;
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
        count++;
      }
    }
    return count;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

const sessionStore = new SessionStore();

/**
 * Simple JWT implementation (in production, use jsonwebtoken)
 */
export class SimpleJWT {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  sign(payload: JWTPayload): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = createHash('sha256')
      .update(`${encodedHeader}.${encodedPayload}`)
      .update(this.secret)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verify(token: string): JWTPayload | null {
    try {
      const [header, payload, signature] = token.split('.');
      
      // Verify signature
      const expectedSignature = createHash('sha256')
        .update(`${header}.${payload}`)
        .update(this.secret)
        .digest('base64url');

      if (signature !== expectedSignature) {
        return null;
      }

      // Verify expiration
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (Date.now() >= decoded.exp * 1000) {
        return null;
      }

      return JWTPayloadSchema.parse(decoded);
    } catch {
      return null;
    }
  }
}

/**
 * JWT Authentication Middleware
 */
export function jwtAuthPlugin(fastify: FastifyInstance) {
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  const jwt = new SimpleJWT(jwtSecret);

  // Login endpoint
  fastify.post('/api/v1/auth/login', {
    schema: {
      body: z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    },
  }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };

    // Simple authentication (in production, use proper auth service)
    if (username === 'admin' && password === 'admin') {
      const sessionId = sessionStore.create('admin', ['admin'], 3600000); // 1 hour
      
      const payload: JWTPayload = {
        sub: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor((Date.now() + 3600000) / 1000),
        sessionId,
        roles: ['admin'],
      };

      const token = jwt.sign(payload);

      return {
        token,
        expiresIn: 3600,
        user: {
          id: 'admin',
          username: 'admin',
          roles: ['admin'],
        },
      };
    }

    reply.status(401).send({
      error: 'Invalid credentials',
    });
  });

  // Logout endpoint
  fastify.post('/api/v1/auth/logout', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.status(401).send({ error: 'No token provided' });
    }

    const payload = jwt.verify(token);
    if (payload) {
      sessionStore.revoke(payload.sessionId);
    }

    return { message: 'Logged out successfully' };
  });

  // JWT verification middleware
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth for public endpoints
    const publicPaths = [
      '/api/v1/ai/health',
      '/api/v1/auth/login',
      '/metrics',
    ];

    if (publicPaths.includes(request.url)) {
      return;
    }

    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.status(401).send({
        error: 'Authentication required',
        message: 'Please provide a valid JWT token',
      });
    }

    const payload = jwt.verify(token);
    if (!payload) {
      return reply.status(401).send({
        error: 'Invalid token',
        message: 'Token is invalid or expired',
      });
    }

    // Verify session exists
    const session = sessionStore.get(payload.sessionId);
    if (!session) {
      return reply.status(401).send({
        error: 'Session expired',
        message: 'Please login again',
      });
    }

    // Add user context to request
    (request as any).user = {
      id: payload.sub,
      sessionId: payload.sessionId,
      roles: payload.roles,
    };
  });
}

/**
 * Role-based access control middleware
 */
export function rbacMiddleware(requiredRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const hasRole = requiredRoles.some(role => user.roles.includes(role));
    if (!hasRole) {
      return reply.status(403).send({
        error: 'Insufficient permissions',
        message: `Required roles: ${requiredRoles.join(', ')}`,
      });
    }
  };
}