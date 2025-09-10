/**
 * Edge Cases and Negative Tests for Security Middleware
 * Tests boundary conditions, error cases, and malicious inputs
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeSqlInput,
  sanitizeHtmlInput,
  sanitizePath,
  generateSecureToken,
  hashSensitiveData,
  verifyHashedData,
  CSPBuilder,
} from './security-middleware.js';

describe('Security Middleware - Edge Cases & Negative Tests', () => {
  describe('sanitizeSqlInput - Edge Cases', () => {
    it('should handle empty string', () => {
      expect(sanitizeSqlInput('')).toBe('');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeSqlInput(null as any)).toBe('');
      expect(sanitizeSqlInput(undefined as any)).toBe('');
    });

    it('should handle very long input', () => {
      const longInput = 'SELECT '.repeat(1000) + 'FROM users';
      const result = sanitizeSqlInput(longInput);
      expect(result).not.toContain('SELECT');
      expect(result.length).toBeLessThan(longInput.length);
    });

    it('should handle unicode characters', () => {
      expect(sanitizeSqlInput('SELECT * FROM 用户')).toBe('  FROM 用户');
      expect(sanitizeSqlInput('SELECT * FROM пользователи')).toBe('  FROM пользователи');
    });

    it('should handle mixed case SQL keywords', () => {
      expect(sanitizeSqlInput('SeLeCt * FrOm UsErS')).toBe('  FrOm UsErS');
      expect(sanitizeSqlInput('sElEcT * fRoM uSeRs')).toBe('  fRoM uSeRs');
    });

    it('should handle nested comments', () => {
      expect(sanitizeSqlInput('SELECT /* outer /* inner */ comment */ * FROM users'))
        .toBe('  comment  FROM users');
    });

    it('should handle multiple semicolons', () => {
      expect(sanitizeSqlInput('SELECT * FROM users;;;')).toBe('  FROM users');
    });

    it('should handle SQL injection with line breaks', () => {
      const malicious = `SELECT * FROM users
WHERE id = 1; DROP TABLE users; --`;
      const result = sanitizeSqlInput(malicious);
      expect(result).not.toContain('DROP');
      expect(result).not.toContain('--');
    });

    it('should handle boolean-based blind SQL injection', () => {
      expect(sanitizeSqlInput("1' AND '1'='1")).toBe('1 AND 11');
      expect(sanitizeSqlInput("1' OR '1'='1")).toBe('1 OR 11');
      expect(sanitizeSqlInput("1' AND '1'='2")).toBe('1 AND 12');
    });

    it('should handle time-based blind SQL injection', () => {
      expect(sanitizeSqlInput("1'; WAITFOR DELAY '00:00:05'--")).toBe('1 WAITFOR DELAY 00005');
      expect(sanitizeSqlInput("1' AND SLEEP(5)--")).toBe('1 AND SLEEP5');
    });

    it('should handle union-based injection', () => {
      expect(sanitizeSqlInput("1' UNION SELECT * FROM users--")).toBe('1 UNION  FROM users');
      expect(sanitizeSqlInput("1' UNION ALL SELECT * FROM users--")).toBe('1 UNION ALL  FROM users');
    });
  });

  describe('sanitizeHtmlInput - Edge Cases', () => {
    it('should handle empty string', () => {
      expect(sanitizeHtmlInput('')).toBe('');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeHtmlInput(null as any)).toBe('');
      expect(sanitizeHtmlInput(undefined as any)).toBe('');
    });

    it('should handle very long input', () => {
      const longInput = '<script>'.repeat(1000) + 'alert("xss")</script>';
      const result = sanitizeHtmlInput(longInput);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should handle unicode characters', () => {
      expect(sanitizeHtmlInput('<script>alert("测试")</script>'))
        .toBe('&lt;script&gt;alert(&quot;测试&quot;)&lt;&#x2F;script&gt;');
    });

    it('should handle mixed case HTML tags', () => {
      expect(sanitizeHtmlInput('<ScRiPt>alert("xss")</ScRiPt>'))
        .toBe('&lt;ScRiPt&gt;alert(&quot;xss&quot;)&lt;&#x2F;ScRiPt&gt;');
    });

    it('should handle nested HTML tags', () => {
      expect(sanitizeHtmlInput('<div><script>alert("xss")</script></div>'))
        .toBe('&lt;div&gt;&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;&lt;&#x2F;div&gt;');
    });

    it('should handle HTML entities in attributes', () => {
      expect(sanitizeHtmlInput('<img src="javascript:alert(\'xss\')" onerror="alert(\'xss\')">'))
        .toBe('&lt;img src=&quot;javascript:alert(&#x27;xss&#x27;)&quot; onerror=&quot;alert(&#x27;xss&#x27;)&quot;&gt;');
    });

    it('should handle CSS injection attempts', () => {
      expect(sanitizeHtmlInput('<style>body{background:url("javascript:alert(\'xss\')")}</style>'))
        .toBe('&lt;style&gt;body{background:url(&quot;javascript:alert(&#x27;xss&#x27;)&quot;)}&lt;&#x2F;style&gt;');
    });

    it('should handle SVG injection attempts', () => {
      expect(sanitizeHtmlInput('<svg onload="alert(\'xss\')"></svg>'))
        .toBe('&lt;svg onload=&quot;alert(&#x27;xss&#x27;)&quot;&gt;&lt;&#x2F;svg&gt;');
    });

    it('should handle data URI injection attempts', () => {
      expect(sanitizeHtmlInput('<img src="data:text/html,<script>alert(\'xss\')</script>">'))
        .toBe('&lt;img src=&quot;data:text/html,&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;&quot;&gt;');
    });

    it('should handle null bytes', () => {
      expect(sanitizeHtmlInput('<script\x00>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    it('should handle control characters', () => {
      expect(sanitizeHtmlInput('<script\x01>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });
  });

  describe('sanitizePath - Edge Cases', () => {
    it('should handle empty string', () => {
      expect(sanitizePath('')).toBe('');
    });

    it('should handle null and undefined', () => {
      expect(sanitizePath(null as any)).toBe('');
      expect(sanitizePath(undefined as any)).toBe('');
    });

    it('should handle very long paths', () => {
      const longPath = '../'.repeat(1000) + 'etc/passwd';
      const result = sanitizePath(longPath);
      expect(result).not.toContain('..');
      expect(result.length).toBeLessThan(longPath.length);
    });

    it('should handle unicode characters', () => {
      expect(sanitizePath('路径/文件.txt')).toBe('路径/文件.txt');
      expect(sanitizePath('путь/файл.txt')).toBe('путь/файл.txt');
    });

    it('should handle mixed path separators', () => {
      expect(sanitizePath('path\\to/file')).toBe('pathto/file');
      expect(sanitizePath('path/to\\file')).toBe('path/tofile');
    });

    it('should handle multiple consecutive dots', () => {
      expect(sanitizePath('..../etc/passwd')).toBe('/etc/passwd');
      expect(sanitizePath('.....\\windows\\system32')).toBe('windowssystem32');
    });

    it('should handle null bytes', () => {
      expect(sanitizePath('file\x00.txt')).toBe('file.txt');
      expect(sanitizePath('path\x00/to/file')).toBe('pathto/file');
    });

    it('should handle control characters', () => {
      expect(sanitizePath('file\x01.txt')).toBe('file.txt');
      expect(sanitizePath('path\x02/to/file')).toBe('pathto/file');
    });

    it('should handle special shell characters', () => {
      expect(sanitizePath('file$(whoami).txt')).toBe('filewhoami.txt');
      expect(sanitizePath('file`whoami`.txt')).toBe('filewhoami.txt');
      expect(sanitizePath('file$(id).txt')).toBe('fileid.txt');
    });

    it('should handle Windows-specific paths', () => {
      expect(sanitizePath('C:\\Windows\\System32')).toBe('CWindowssystem32');
      expect(sanitizePath('\\\\server\\share\\file')).toBe('serversharefile');
    });

    it('should handle URLs disguised as paths', () => {
      expect(sanitizePath('https://evil.com/malware.exe')).toBe('https://evil.com/malware.exe');
      expect(sanitizePath('ftp://evil.com/malware.exe')).toBe('ftp://evil.com/malware.exe');
    });
  });

  describe('generateSecureToken - Edge Cases', () => {
    it('should handle zero length', () => {
      const token = generateSecureToken(0);
      expect(token).toBe('');
    });

    it('should handle negative length', () => {
      const token = generateSecureToken(-1);
      expect(token).toBe('');
    });

    it('should handle very large length', () => {
      const token = generateSecureToken(10000);
      expect(token).toHaveLength(20000); // 10000 bytes = 20000 hex chars
    });

    it('should handle fractional length', () => {
      const token = generateSecureToken(32.7);
      expect(token).toHaveLength(64); // Should be rounded down
    });

    it('should handle NaN length', () => {
      const token = generateSecureToken(NaN);
      expect(token).toBe('');
    });

    it('should handle Infinity length', () => {
      const token = generateSecureToken(Infinity);
      expect(token).toBe('');
    });

    it('should handle string length', () => {
      const token = generateSecureToken('32' as any);
      expect(token).toHaveLength(64);
    });

    it('should generate different tokens for same length', () => {
      const tokens = Array.from({ length: 100 }, () => generateSecureToken(32));
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(100);
    });
  });

  describe('hashSensitiveData - Edge Cases', () => {
    it('should handle empty string', () => {
      const hashed = hashSensitiveData('');
      expect(hashed).toContain(':');
      const [hash, salt] = hashed.split(':');
      expect(hash).toHaveLength(64);
      expect(salt).toHaveLength(32);
    });

    it('should handle null and undefined', () => {
      const hashed1 = hashSensitiveData(null as any);
      const hashed2 = hashSensitiveData(undefined as any);
      expect(hashed1).toContain(':');
      expect(hashed2).toContain(':');
    });

    it('should handle very long data', () => {
      const longData = 'a'.repeat(100000);
      const hashed = hashSensitiveData(longData);
      expect(hashed).toContain(':');
      const [hash, salt] = hashed.split(':');
      expect(hash).toHaveLength(64);
      expect(salt).toHaveLength(32);
    });

    it('should handle unicode data', () => {
      const unicodeData = '测试数据🔐';
      const hashed = hashSensitiveData(unicodeData);
      expect(hashed).toContain(':');
      const [hash, salt] = hashed.split(':');
      expect(hash).toHaveLength(64);
      expect(salt).toHaveLength(32);
    });

    it('should handle empty salt', () => {
      const hashed = hashSensitiveData('test', '');
      expect(hashed).toContain(':');
      const [hash, salt] = hashed.split(':');
      expect(hash).toHaveLength(64);
      expect(salt).toBe('');
    });

    it('should handle very long salt', () => {
      const longSalt = 'a'.repeat(1000);
      const hashed = hashSensitiveData('test', longSalt);
      expect(hashed).toContain(':');
      const [hash, salt] = hashed.split(':');
      expect(hash).toHaveLength(64);
      expect(salt).toBe(longSalt);
    });

    it('should handle special characters in salt', () => {
      const specialSalt = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hashed = hashSensitiveData('test', specialSalt);
      expect(hashed).toContain(':');
      const [hash, salt] = hashed.split(':');
      expect(hash).toHaveLength(64);
      expect(salt).toBe(specialSalt);
    });
  });

  describe('verifyHashedData - Edge Cases', () => {
    it('should handle empty data', () => {
      const hashed = hashSensitiveData('');
      expect(verifyHashedData('', hashed)).toBe(true);
      expect(verifyHashedData('not-empty', hashed)).toBe(false);
    });

    it('should handle null and undefined data', () => {
      const hashed = hashSensitiveData('test');
      expect(verifyHashedData(null as any, hashed)).toBe(false);
      expect(verifyHashedData(undefined as any, hashed)).toBe(false);
    });

    it('should handle malformed hash', () => {
      expect(verifyHashedData('test', '')).toBe(false);
      expect(verifyHashedData('test', 'invalid')).toBe(false);
      expect(verifyHashedData('test', 'hash:')).toBe(false);
      expect(verifyHashedData('test', ':salt')).toBe(false);
      expect(verifyHashedData('test', 'hash:salt:extra')).toBe(false);
    });

    it('should handle hash with wrong length', () => {
      expect(verifyHashedData('test', 'short:salt')).toBe(false);
      expect(verifyHashedData('test', 'verylonghashthatexceeds64characters:salt')).toBe(false);
    });

    it('should handle salt with wrong length', () => {
      const hashed = hashSensitiveData('test');
      const [hash] = hashed.split(':');
      expect(verifyHashedData('test', `${hash}:shortsalt`)).toBe(false);
    });

    it('should handle case sensitivity', () => {
      const hashed = hashSensitiveData('Test');
      expect(verifyHashedData('test', hashed)).toBe(false);
      expect(verifyHashedData('TEST', hashed)).toBe(false);
      expect(verifyHashedData('Test', hashed)).toBe(true);
    });

    it('should handle whitespace', () => {
      const hashed = hashSensitiveData(' test ');
      expect(verifyHashedData('test', hashed)).toBe(false);
      expect(verifyHashedData(' test ', hashed)).toBe(true);
    });
  });

  describe('CSPBuilder - Edge Cases', () => {
    it('should handle empty builder', () => {
      const csp = new CSPBuilder().build();
      expect(csp).toBe('');
    });

    it('should handle empty sources', () => {
      const csp = new CSPBuilder()
        .defaultSrc()
        .scriptSrc()
        .build();
      expect(csp).toBe('default-src ; script-src ');
    });

    it('should handle duplicate sources', () => {
      const csp = new CSPBuilder()
        .defaultSrc("'self'", "'self'", 'https://example.com', 'https://example.com')
        .build();
      expect(csp).toBe("default-src 'self' 'self' https://example.com https://example.com");
    });

    it('should handle special characters in sources', () => {
      const csp = new CSPBuilder()
        .defaultSrc("'self'", 'https://example.com:8080', 'https://sub.example.com')
        .build();
      expect(csp).toContain("'self'");
      expect(csp).toContain('https://example.com:8080');
      expect(csp).toContain('https://sub.example.com');
    });

    it('should handle very long CSP', () => {
      const sources = Array.from({ length: 100 }, (_, i) => `https://example${i}.com`);
      const csp = new CSPBuilder()
        .defaultSrc(...sources)
        .build();
      expect(csp).toContain('https://example0.com');
      expect(csp).toContain('https://example99.com');
    });

    it('should handle null and undefined sources', () => {
      const csp = new CSPBuilder()
        .defaultSrc("'self'", null as any, undefined as any, 'https://example.com')
        .build();
      expect(csp).toContain("'self'");
      expect(csp).toContain('https://example.com');
    });

    it('should handle empty string sources', () => {
      const csp = new CSPBuilder()
        .defaultSrc("'self'", '', 'https://example.com')
        .build();
      expect(csp).toContain("'self'");
      expect(csp).toContain('https://example.com');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large inputs efficiently', () => {
      const largeInput = 'SELECT '.repeat(10000) + 'FROM users';
      const start = Date.now();
      const result = sanitizeSqlInput(largeInput);
      const end = Date.now();
      
      expect(result).not.toContain('SELECT');
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle many tokens efficiently', () => {
      const start = Date.now();
      const tokens = Array.from({ length: 1000 }, () => generateSecureToken(32));
      const end = Date.now();
      
      expect(tokens).toHaveLength(1000);
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle many hash operations efficiently', () => {
      const start = Date.now();
      const hashes = Array.from({ length: 1000 }, (_, i) => hashSensitiveData(`data${i}`));
      const end = Date.now();
      
      expect(hashes).toHaveLength(1000);
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});