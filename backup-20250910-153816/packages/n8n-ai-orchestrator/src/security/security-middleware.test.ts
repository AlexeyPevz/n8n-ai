import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeSqlInput,
  sanitizeHtmlInput,
  sanitizePath,
  generateSecureToken,
  hashSensitiveData,
  verifyHashedData,
  CSPBuilder,
} from './security-middleware.js';

describe('Security Middleware', () => {
  describe('sanitizeSqlInput', () => {
    it('should remove SQL keywords', () => {
      expect(sanitizeSqlInput('SELECT * FROM users')).toBe('  FROM users');
      expect(sanitizeSqlInput('1; DROP TABLE users;')).toBe('1  TABLE users');
      expect(sanitizeSqlInput("admin' OR '1'='1")).toBe('admin OR 11');
    });

    it('should remove SQL comments', () => {
      expect(sanitizeSqlInput('value -- comment')).toBe('value  comment');
      expect(sanitizeSqlInput('value /* comment */')).toBe('value  comment ');
    });

    it('should handle normal input', () => {
      expect(sanitizeSqlInput('normal input')).toBe('normal input');
      expect(sanitizeSqlInput('user@example.com')).toBe('user@example.com');
    });
  });

  describe('sanitizeHtmlInput', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeHtmlInput('<script>alert("XSS")</script>'))
        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
      
      expect(sanitizeHtmlInput('<a href="javascript:alert()">link</a>'))
        .toBe('&lt;a href=&quot;javascript:alert()&quot;&gt;link&lt;&#x2F;a&gt;');
    });

    it('should escape quotes', () => {
      expect(sanitizeHtmlInput(`"quotes" and 'apostrophes'`))
        .toBe('&quot;quotes&quot; and &#x27;apostrophes&#x27;');
    });

    it('should handle normal text', () => {
      expect(sanitizeHtmlInput('Normal text without HTML')).toBe('Normal text without HTML');
    });
  });

  describe('sanitizePath', () => {
    it('should remove path traversal attempts', () => {
      expect(sanitizePath('../../../etc/passwd')).toBe('/etc/passwd');
      expect(sanitizePath('..\\..\\windows\\system32')).toBe('windowssystem32');
    });

    it('should remove special characters', () => {
      expect(sanitizePath('file; rm -rf /')).toBe('file rm -rf /');
      expect(sanitizePath('file$(whoami).txt')).toBe('filewhoami.txt');
    });

    it('should normalize multiple slashes', () => {
      expect(sanitizePath('path//to///file')).toBe('path/to/file');
    });

    it('should allow safe paths', () => {
      expect(sanitizePath('path/to/file.txt')).toBe('path/to/file.txt');
      expect(sanitizePath('file-name_123.ext')).toBe('file-name_123.ext');
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token of correct length', () => {
      const token = generateSecureToken(32);
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });

    it('should only contain hex characters', () => {
      const token = generateSecureToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('hashSensitiveData', () => {
    it('should hash data with salt', () => {
      const data = 'sensitive-password';
      const hashed = hashSensitiveData(data);
      
      expect(hashed).toContain(':'); // Should contain salt separator
      const [hash, salt] = hashed.split(':');
      expect(hash).toHaveLength(64); // SHA-256 = 64 hex chars
      expect(salt).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should produce different hashes for same data', () => {
      const data = 'same-data';
      const hash1 = hashSensitiveData(data);
      const hash2 = hashSensitiveData(data);
      expect(hash1).not.toBe(hash2); // Different salts
    });

    it('should produce same hash with same salt', () => {
      const data = 'test-data';
      const salt = 'fixed-salt';
      const hash1 = hashSensitiveData(data, salt);
      const hash2 = hashSensitiveData(data, salt);
      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyHashedData', () => {
    it('should verify correct data', () => {
      const data = 'password123';
      const hashed = hashSensitiveData(data);
      expect(verifyHashedData(data, hashed)).toBe(true);
    });

    it('should reject incorrect data', () => {
      const data = 'password123';
      const hashed = hashSensitiveData(data);
      expect(verifyHashedData('wrong-password', hashed)).toBe(false);
    });

    it('should handle invalid hash format', () => {
      expect(verifyHashedData('data', 'invalid-hash')).toBe(false);
    });
  });

  describe('CSPBuilder', () => {
    it('should build basic CSP', () => {
      const csp = new CSPBuilder()
        .defaultSrc("'self'")
        .build();
      
      expect(csp).toBe("default-src 'self'");
    });

    it('should build complex CSP', () => {
      const csp = new CSPBuilder()
        .defaultSrc("'self'")
        .scriptSrc("'self'", "'unsafe-inline'", 'https://cdn.example.com')
        .styleSrc("'self'", "'unsafe-inline'")
        .imgSrc("'self'", 'data:', 'https:')
        .connectSrc("'self'", 'wss:', 'https://api.example.com')
        .build();
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline' https://cdn.example.com");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: https:");
      expect(csp).toContain("connect-src 'self' wss: https://api.example.com");
    });

    it('should chain methods', () => {
      const builder = new CSPBuilder();
      expect(builder.defaultSrc("'self'")).toBe(builder);
      expect(builder.scriptSrc("'self'")).toBe(builder);
    });
  });
});