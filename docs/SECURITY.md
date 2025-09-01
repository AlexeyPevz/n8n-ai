# Security Guide

## Overview

n8n-ai implements comprehensive security measures to protect against common vulnerabilities and ensure safe operation in production environments.

## Security Features

### 1. Input Validation

All user inputs are validated using Zod schemas:

```typescript
// Example: Validating operation requests
const OperationSchema = z.object({
  op: z.enum(['add_node', 'remove_node', ...]),
  name: z.string().regex(/^[a-zA-Z0-9\-_]+$/),
  parameters: z.record(z.any()).refine(/* security checks */),
});
```

### 2. Rate Limiting

Configurable rate limiting per endpoint and globally:

```typescript
const securityConfig = {
  rateLimit: {
    global: { max: 100, timeWindow: 60000 }, // 100 req/min
    perEndpoint: {
      'POST:/api/v1/ai/plan': { max: 10, timeWindow: 60000 }, // 10 req/min
    }
  }
};
```

### 3. Authentication

API key authentication with secure hashing:

```bash
# Request with API key
curl -H "X-API-Key: your-secure-api-key" http://localhost:3000/api/v1/ai/plan
```

### 4. Security Headers

Automatic security headers on all responses:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HTTPS only)
- `Content-Security-Policy`

### 5. Sanitization

Multiple levels of input sanitization:

```typescript
// HTML sanitization
sanitizeHtmlInput(userInput);

// SQL injection prevention
sanitizeSqlInput(queryParam);

// Path traversal prevention
sanitizePath(filePath);
```

## Vulnerability Prevention

### 1. Injection Attacks

#### SQL Injection
- All database queries use parameterized statements
- Input sanitization removes SQL keywords
- Schema validation prevents malicious payloads

#### NoSQL Injection
- MongoDB queries are validated
- Object depth limits prevent nested attacks
- Operator validation blocks dangerous operations

#### Command Injection
- No direct shell command execution
- All system calls use safe APIs
- Input validation prevents shell metacharacters

### 2. Cross-Site Scripting (XSS)

- All user content is HTML-escaped
- Content Security Policy restricts script sources
- React/Vue auto-escaping for frontend
- `innerHTML` usage is prohibited

### 3. Cross-Site Request Forgery (CSRF)

- SameSite cookie attributes
- Origin validation for state-changing requests
- Double-submit cookie pattern available

### 4. XML External Entity (XXE)

- XML parsing disabled by default
- When needed, DTD processing is disabled
- Entity expansion limits enforced

### 5. Broken Authentication

- API keys stored as hashed values
- Constant-time comparison prevents timing attacks
- Rate limiting on authentication endpoints
- Failed auth attempts are logged

### 6. Sensitive Data Exposure

- All sensitive data encrypted at rest
- TLS/HTTPS enforced in production
- Secrets never logged or exposed in errors
- Environment variables for configuration

### 7. Security Misconfiguration

- Secure defaults for all settings
- Security headers automatically applied
- Error messages don't leak system info
- Directory listing disabled

### 8. Using Components with Known Vulnerabilities

- Regular dependency updates
- Automated vulnerability scanning
- Security audit command available
- Dependency version pinning

### 9. Insufficient Logging & Monitoring

- Comprehensive security event logging
- Failed authentication attempts tracked
- Anomaly detection for usage patterns
- Integration with monitoring systems

## AI-Specific Security

### 1. Prompt Injection Prevention

```typescript
// Prompt validation
const PromptSchema = z.string()
  .max(10000)
  .refine(val => {
    const dangerous = [
      'ignore previous instructions',
      'system:',
      '```python',
    ];
    return !dangerous.some(keyword => 
      val.toLowerCase().includes(keyword)
    );
  });
```

### 2. Model Security

- Rate limiting on AI endpoints
- Token usage monitoring
- Cost control mechanisms
- Output validation

### 3. Data Privacy

- No storage of sensitive prompts
- User data isolation
- Audit logs for compliance
- Data retention policies

## Configuration

### Environment Variables

```bash
# Security settings
SECURITY_API_KEYS=key1,key2,key3  # Comma-separated API keys
SECURITY_RATE_LIMIT=100            # Requests per minute
SECURITY_MAX_BODY_SIZE=5242880     # 5MB
SECURITY_TRUSTED_PROXIES=10.0.0.0/8
SECURITY_ENABLE_AUDIT=true
```

### Security Configuration

```typescript
const securityConfig = {
  rateLimit: {
    global: { max: 100, timeWindow: 60000 },
  },
  cors: {
    origins: ['https://app.n8n.io'],
    credentials: true,
  },
  headers: {
    hsts: true,
    csp: new CSPBuilder()
      .defaultSrc("'self'")
      .scriptSrc("'self'", "'unsafe-inline'")
      .build(),
  },
  auth: {
    apiKeys: process.env.SECURITY_API_KEYS?.split(','),
  },
  maxBodySize: 5 * 1024 * 1024, // 5MB
};
```

## Security Checklist

### Development

- [ ] Enable strict TypeScript mode
- [ ] Use latest dependencies
- [ ] Validate all inputs
- [ ] Sanitize all outputs
- [ ] Implement proper error handling
- [ ] Avoid dangerous functions (eval, etc.)
- [ ] Use secure random generation
- [ ] Implement proper authentication

### Deployment

- [ ] Enable HTTPS/TLS
- [ ] Set secure headers
- [ ] Configure rate limiting
- [ ] Enable audit logging
- [ ] Set up monitoring
- [ ] Configure firewalls
- [ ] Implement backup strategy
- [ ] Document security procedures

### Monitoring

- [ ] Monitor failed auth attempts
- [ ] Track rate limit violations
- [ ] Alert on security events
- [ ] Review audit logs regularly
- [ ] Monitor resource usage
- [ ] Track error rates
- [ ] Check for anomalies

## Security Audit

Run security audit:

```bash
npm run security:audit
```

This will check for:
- Vulnerable dependencies
- Dangerous code patterns
- Hardcoded secrets
- Missing validation
- Weak cryptography
- Insecure protocols

## Incident Response

### 1. Detection
- Monitoring alerts
- User reports
- Audit log anomalies
- Performance degradation

### 2. Response
- Isolate affected systems
- Preserve evidence
- Notify stakeholders
- Begin investigation

### 3. Recovery
- Patch vulnerabilities
- Restore from backups
- Update security measures
- Document lessons learned

### 4. Prevention
- Update security policies
- Enhance monitoring
- Security training
- Regular audits

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Email security@n8n-ai.io with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work on a fix.

## Security Resources

- [OWASP Top 10](https://owasp.org/Top10/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)