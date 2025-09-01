export function getSecurityPreset() {
    const preset = process.env.SECURITY_PRESET || 'development';
    const common = {
        cors: {
            origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
            credentials: true,
        },
        rateLimit: {
            global: {
                max: parseInt(process.env.SECURITY_RATE_LIMIT || '100'),
                timeWindow: parseInt(process.env.SECURITY_RATE_WINDOW || '60000'),
            },
        },
        auth: {
            apiKeys: process.env.SECURITY_API_KEYS?.split(',').filter(Boolean) || [],
            jwtSecret: process.env.JWT_SECRET,
        },
        maxBodySize: parseInt(process.env.MAX_BODY_SIZE || '5242880'),
        trustedProxies: process.env.SECURITY_TRUSTED_PROXIES?.split(',').filter(Boolean) || [],
    };
    if (preset === 'production') {
        common.cors = { origins: [process.env.APP_URL || 'https://app.n8n.io'], credentials: true };
    }
    return common;
}
import { CSPBuilder } from './security-middleware.js';
/**
 * Get security configuration from environment
 */
export function getSecurityConfig() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    // Parse API keys
    const apiKeys = process.env.SECURITY_API_KEYS?.split(',').filter(Boolean) || [];
    // Parse trusted proxies
    const trustedProxies = process.env.SECURITY_TRUSTED_PROXIES?.split(',').filter(Boolean) || [];
    // Build CSP
    const csp = new CSPBuilder()
        .defaultSrc("'self'")
        .scriptSrc("'self'", isDevelopment ? "'unsafe-inline'" : '')
        .styleSrc("'self'", "'unsafe-inline'") // Needed for some UI libraries
        .imgSrc("'self'", 'data:', 'https:')
        .connectSrc("'self'", isDevelopment ? 'ws://localhost:*' : '')
        .fontSrc("'self'", 'https://fonts.gstatic.com')
        .build();
    return {
        rateLimit: {
            global: {
                max: parseInt(process.env.SECURITY_RATE_LIMIT || '100'),
                timeWindow: parseInt(process.env.SECURITY_RATE_WINDOW || '60000'), // 1 minute
            },
            perEndpoint: {
                // AI endpoints have stricter limits
                'POST:/api/v1/ai/plan': {
                    max: parseInt(process.env.AI_RATE_LIMIT || '10'),
                    timeWindow: 60000,
                },
                'POST:/api/v1/ai/ask': {
                    max: parseInt(process.env.AI_RATE_LIMIT || '10'),
                    timeWindow: 60000,
                },
                // Auth endpoints
                'POST:/api/v1/auth/login': {
                    max: 5,
                    timeWindow: 300000, // 5 minutes
                },
                // File uploads
                'POST:/api/v1/upload': {
                    max: 10,
                    timeWindow: 3600000, // 1 hour
                },
            },
        },
        cors: {
            origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true,
        },
        headers: {
            csp,
            hsts: !isDevelopment,
        },
        auth: {
            apiKeys,
            jwtSecret: process.env.JWT_SECRET,
        },
        maxBodySize: parseInt(process.env.MAX_BODY_SIZE || '5242880'), // 5MB
        trustedProxies,
    };
}
/**
 * Security presets for different environments
 */
export const securityPresets = {
    development: {
        rateLimit: {
            global: { max: 1000, timeWindow: 60000 },
        },
        cors: {
            origins: ['*'],
            credentials: true,
        },
        headers: {
            hsts: false,
        },
        auth: {
            apiKeys: [],
        },
    },
    production: {
        rateLimit: {
            global: { max: 100, timeWindow: 60000 },
            perEndpoint: {
                'POST:/api/v1/ai/plan': { max: 10, timeWindow: 60000 },
                'POST:/api/v1/auth/login': { max: 3, timeWindow: 300000 },
            },
        },
        cors: {
            origins: [process.env.APP_URL || 'https://app.n8n.io'],
            credentials: true,
        },
        headers: {
            hsts: true,
            csp: new CSPBuilder()
                .defaultSrc("'self'")
                .scriptSrc("'self'")
                .styleSrc("'self'", "'unsafe-inline'")
                .imgSrc("'self'", 'data:', 'https:')
                .connectSrc("'self'")
                .build(),
        },
        auth: {
            apiKeys: process.env.SECURITY_API_KEYS?.split(',') || [],
            jwtSecret: process.env.JWT_SECRET,
        },
        maxBodySize: 5 * 1024 * 1024, // 5MB
    },
    strict: {
        rateLimit: {
            global: { max: 50, timeWindow: 60000 },
            perEndpoint: {
                'POST:/api/v1/ai/plan': { max: 5, timeWindow: 300000 },
                'POST:/api/v1/auth/login': { max: 3, timeWindow: 600000 },
            },
        },
        cors: {
            origins: [process.env.APP_URL || 'https://app.n8n.io'],
            credentials: false,
        },
        headers: {
            hsts: true,
            csp: new CSPBuilder()
                .defaultSrc("'none'")
                .scriptSrc("'self'")
                .styleSrc("'self'")
                .imgSrc("'self'")
                .connectSrc("'self'")
                .build(),
        },
        auth: {
            apiKeys: process.env.SECURITY_API_KEYS?.split(',') || [],
            jwtSecret: process.env.JWT_SECRET,
        },
        maxBodySize: 1 * 1024 * 1024, // 1MB
    },
};
/**
 * Get security preset
 */
export function getSecurityPreset() {
    const preset = process.env.SECURITY_PRESET || 'development';
    if (preset === 'custom') {
        return getSecurityConfig();
    }
    return securityPresets[preset] || securityPresets.development;
}
