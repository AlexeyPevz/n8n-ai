/**
 * Role-Based Access Control (RBAC) System
 * ASVS V4.1-V4.6 Compliance
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Permission schema
export const PermissionSchema = z.object({
  resource: z.string(),
  action: z.enum(['read', 'write', 'delete', 'execute']),
  conditions: z.record(z.any()).optional(),
});

export type Permission = z.infer<typeof PermissionSchema>;

// Role schema
export const RoleSchema = z.object({
  name: z.string(),
  permissions: z.array(PermissionSchema),
  inherits: z.array(z.string()).optional(),
});

export type Role = z.infer<typeof RoleSchema>;

// User schema
export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  roles: z.array(z.string()),
  attributes: z.record(z.any()).optional(),
});

export type User = z.infer<typeof UserSchema>;

// RBAC Engine
export class RBACEngine {
  private roles = new Map<string, Role>();
  private users = new Map<string, User>();

  constructor() {
    this.initializeDefaultRoles();
  }

  private initializeDefaultRoles(): void {
    // Admin role - full access
    this.addRole({
      name: 'admin',
      permissions: [
        { resource: '*', action: 'read' },
        { resource: '*', action: 'write' },
        { resource: '*', action: 'delete' },
        { resource: '*', action: 'execute' },
      ],
    });

    // Developer role - limited access
    this.addRole({
      name: 'developer',
      permissions: [
        { resource: 'workflows', action: 'read' },
        { resource: 'workflows', action: 'write' },
        { resource: 'ai', action: 'execute' },
        { resource: 'metrics', action: 'read' },
      ],
    });

    // Viewer role - read only
    this.addRole({
      name: 'viewer',
      permissions: [
        { resource: 'workflows', action: 'read' },
        { resource: 'metrics', action: 'read' },
      ],
    });

    // API role - for external integrations
    this.addRole({
      name: 'api',
      permissions: [
        { resource: 'workflows', action: 'read' },
        { resource: 'workflows', action: 'write' },
        { resource: 'ai', action: 'execute' },
      ],
    });
  }

  addRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  getUser(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  hasPermission(userId: string, resource: string, action: string, context?: Record<string, any>): boolean {
    const user = this.getUser(userId);
    if (!user) return false;

    // Check each role
    for (const roleName of user.roles) {
      const role = this.roles.get(roleName);
      if (!role) continue;

      // Check direct permissions
      if (this.checkRolePermissions(role, resource, action, context)) {
        return true;
      }

      // Check inherited roles
      if (role.inherits) {
        for (const inheritedRoleName of role.inherits) {
          const inheritedRole = this.roles.get(inheritedRoleName);
          if (inheritedRole && this.checkRolePermissions(inheritedRole, resource, action, context)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private checkRolePermissions(role: Role, resource: string, action: string, context?: Record<string, any>): boolean {
    for (const permission of role.permissions) {
      // Check wildcard resource
      if (permission.resource === '*') {
        return true;
      }

      // Check exact resource match
      if (permission.resource === resource && permission.action === action) {
        // Check conditions if any
        if (permission.conditions && context) {
          return this.evaluateConditions(permission.conditions, context);
        }
        return true;
      }

      // Check resource pattern (e.g., 'workflows:*')
      if (permission.resource.endsWith(':*')) {
        const resourcePrefix = permission.resource.slice(0, -2);
        if (resource.startsWith(resourcePrefix) && permission.action === action) {
          if (permission.conditions && context) {
            return this.evaluateConditions(permission.conditions, context);
          }
          return true;
        }
      }
    }

    return false;
  }

  private evaluateConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = context[key];
      if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  // Get user's effective permissions
  getEffectivePermissions(userId: string): Permission[] {
    const user = this.getUser(userId);
    if (!user) return [];

    const permissions: Permission[] = [];
    const added = new Set<string>();

    for (const roleName of user.roles) {
      const role = this.roles.get(roleName);
      if (!role) continue;

      // Add direct permissions
      for (const permission of role.permissions) {
        const key = `${permission.resource}:${permission.action}`;
        if (!added.has(key)) {
          permissions.push(permission);
          added.add(key);
        }
      }

      // Add inherited permissions
      if (role.inherits) {
        for (const inheritedRoleName of role.inherits) {
          const inheritedRole = this.roles.get(inheritedRoleName);
          if (inheritedRole) {
            for (const permission of inheritedRole.permissions) {
              const key = `${permission.resource}:${permission.action}`;
              if (!added.has(key)) {
                permissions.push(permission);
                added.add(key);
              }
            }
          }
        }
      }
    }

    return permissions;
  }
}

// Global RBAC instance
export const rbac = new RBACEngine();

// Initialize default users
rbac.addUser({
  id: 'admin',
  username: 'admin',
  roles: ['admin'],
});

rbac.addUser({
  id: 'developer',
  username: 'developer',
  roles: ['developer'],
});

rbac.addUser({
  id: 'viewer',
  username: 'viewer',
  roles: ['viewer'],
});

/**
 * RBAC Middleware Factory
 */
export function requirePermission(resource: string, action: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({
        error: 'Authentication required',
        message: 'Please login to access this resource',
      });
    }

    const context = {
      userId: user.id,
      ...(request.query as Record<string, any>),
    };

    if (!rbac.hasPermission(user.id, resource, action, context)) {
      return reply.status(403).send({
        error: 'Access denied',
        message: `Insufficient permissions for ${action} on ${resource}`,
        required: { resource, action },
        user: { id: user.id, roles: user.roles },
      });
    }
  };
}

/**
 * Resource ownership middleware
 */
export function requireOwnership(resourceIdParam: string = 'id') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const resourceId = (request.params as any)[resourceIdParam];
    if (!resourceId) {
      return reply.status(400).send({ error: 'Resource ID required' });
    }

    // Check if user owns the resource (simplified - in production, check database)
    const isOwner = user.id === 'admin' || resourceId.includes(user.id);
    if (!isOwner) {
      return reply.status(403).send({
        error: 'Access denied',
        message: 'You can only access your own resources',
      });
    }
  };
}

/**
 * Admin-only middleware
 */
export function requireAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!user.roles.includes('admin')) {
      return reply.status(403).send({
        error: 'Admin access required',
        message: 'This action requires administrator privileges',
      });
    }
  };
}