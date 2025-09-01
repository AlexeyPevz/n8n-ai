import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityAuditor, SecurityFinding } from './security-audit.js';
import type { INodeGraph } from '@n8n-ai/schemas';

describe('SecurityAuditor', () => {
  let auditor: SecurityAuditor;

  beforeEach(() => {
    auditor = new SecurityAuditor();
  });

  describe('code analysis', () => {
    it('should detect vulnerable dependencies', async () => {
      const code = `
        const express = require('express');
        const mysql = require('mysql');
        const eval = require('eval');
        const shell = require('child_process');
      `;

      const findings = await auditor.auditCode(code);

      expect(findings).toContainEqual(
        expect.objectContaining({
          severity: 'high',
          type: 'DANGEROUS_IMPORT',
          message: expect.stringContaining('eval'),
        })
      );

      expect(findings).toContainEqual(
        expect.objectContaining({
          severity: 'high',
          type: 'DANGEROUS_IMPORT',
          message: expect.stringContaining('child_process'),
        })
      );
    });

    it('should detect hardcoded secrets', async () => {
      const code = `
        const apiKey = 'sk-1234567890abcdef';
        const password = 'P@ssw0rd123!';
        const token = 'ghp_abcdefghijklmnopqrstuvwxyz';
        const awsKey = 'AKIAIOSFODNN7EXAMPLE';
      `;

      const findings = await auditor.auditCode(code);

      expect(findings.filter(f => f.type === 'HARDCODED_SECRET')).toHaveLength(4);
      expect(findings).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          type: 'HARDCODED_SECRET',
          message: expect.stringContaining('API key'),
        })
      );
    });

    it('should detect SQL injection vulnerabilities', async () => {
      const code = `
        const query = \`SELECT * FROM users WHERE id = \${userId}\`;
        db.query('SELECT * FROM products WHERE name = "' + productName + '"');
        const sql = "DELETE FROM orders WHERE id = " + orderId;
      `;

      const findings = await auditor.auditCode(code);

      expect(findings.filter(f => f.type === 'SQL_INJECTION')).toHaveLength(3);
      expect(findings).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          type: 'SQL_INJECTION',
          message: expect.stringContaining('SQL injection'),
        })
      );
    });

    it('should detect command injection', async () => {
      const code = `
        exec('rm -rf ' + userInput);
        shell.exec(\`docker run \${imageName}\`);
        const output = execSync('ls ' + directory);
      `;

      const findings = await auditor.auditCode(code);

      expect(findings.filter(f => f.type === 'COMMAND_INJECTION')).toHaveLength(3);
      expect(findings).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          type: 'COMMAND_INJECTION',
          message: expect.stringContaining('command injection'),
        })
      );
    });

    it('should detect path traversal', async () => {
      const code = `
        fs.readFile('../' + filename);
        const path = userPath + '/file.txt';
        fs.writeFile(\`./uploads/\${req.body.filename}\`, data);
      `;

      const findings = await auditor.auditCode(code);

      expect(findings).toContainEqual(
        expect.objectContaining({
          severity: 'high',
          type: 'PATH_TRAVERSAL',
          message: expect.stringContaining('path traversal'),
        })
      );
    });

    it('should detect weak cryptography', async () => {
      const code = `
        crypto.createHash('md5');
        crypto.createCipher('des', key);
        const hash = sha1(password);
      `;

      const findings = await auditor.auditCode(code);

      expect(findings.filter(f => f.type === 'WEAK_CRYPTO')).toHaveLength(3);
      expect(findings).toContainEqual(
        expect.objectContaining({
          severity: 'medium',
          type: 'WEAK_CRYPTO',
          message: expect.stringContaining('weak'),
        })
      );
    });
  });

  describe('workflow security audit', () => {
    it('should audit workflow for security issues', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'exec',
            name: 'Execute Command',
            type: 'n8n-nodes-base.executeCommand',
            position: [0, 0],
            parameters: {
              command: 'rm -rf {{$json.path}}',
            },
          },
          {
            id: 'http',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            position: [250, 0],
            parameters: {
              url: 'http://internal-api.local/admin',
              authentication: 'genericCredentialType',
              genericAuthType: 'httpBasicAuth',
              httpBasicAuth: {
                user: 'admin',
                password: 'admin123',
              },
            },
          },
          {
            id: 'function',
            name: 'Function',
            type: 'n8n-nodes-base.function',
            position: [500, 0],
            parameters: {
              functionCode: `
                const apiKey = 'sk-secret-key-12345';
                eval(items[0].json.code);
                return items;
              `,
            },
          },
        ],
        connections: {
          exec: { main: [[{ node: 'http', type: 'main', index: 0 }]] },
          http: { main: [[{ node: 'function', type: 'main', index: 0 }]] },
        },
      };

      const findings = await auditor.auditWorkflow(workflow);

      // Should find multiple security issues
      expect(findings.length).toBeGreaterThan(3);

      // Command injection in executeCommand
      expect(findings).toContainEqual(
        expect.objectContaining({
          nodeId: 'exec',
          type: 'COMMAND_INJECTION',
          severity: 'critical',
        })
      );

      // Hardcoded credentials in HTTP node
      expect(findings).toContainEqual(
        expect.objectContaining({
          nodeId: 'http',
          type: 'HARDCODED_CREDENTIAL',
          severity: 'high',
        })
      );

      // eval() usage in Function node
      expect(findings).toContainEqual(
        expect.objectContaining({
          nodeId: 'function',
          type: 'DANGEROUS_FUNCTION',
          severity: 'critical',
        })
      );

      // Hardcoded API key in Function node
      expect(findings).toContainEqual(
        expect.objectContaining({
          nodeId: 'function',
          type: 'HARDCODED_SECRET',
          severity: 'critical',
        })
      );
    });

    it('should check for SSRF vulnerabilities', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'http',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            position: [0, 0],
            parameters: {
              url: '={{$json.userUrl}}', // User-controlled URL
              method: 'GET',
            },
          },
        ],
        connections: {},
      };

      const findings = await auditor.auditWorkflow(workflow);

      expect(findings).toContainEqual(
        expect.objectContaining({
          nodeId: 'http',
          type: 'SSRF',
          severity: 'high',
          message: expect.stringContaining('Server-Side Request Forgery'),
        })
      );
    });

    it('should detect missing authentication', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'webhook',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            position: [0, 0],
            parameters: {
              path: 'admin-panel',
              httpMethod: 'POST',
              // No authentication configured
            },
          },
        ],
        connections: {},
      };

      const findings = await auditor.auditWorkflow(workflow);

      expect(findings).toContainEqual(
        expect.objectContaining({
          nodeId: 'webhook',
          type: 'MISSING_AUTHENTICATION',
          severity: 'medium',
          message: expect.stringContaining('authentication'),
        })
      );
    });
  });

  describe('security recommendations', () => {
    it('should provide remediation advice', () => {
      const findings: SecurityFinding[] = [
        {
          type: 'SQL_INJECTION',
          severity: 'critical',
          message: 'SQL injection vulnerability',
          line: 10,
          column: 5,
        },
        {
          type: 'HARDCODED_SECRET',
          severity: 'critical',
          message: 'Hardcoded API key',
          line: 20,
          column: 10,
        },
      ];

      const recommendations = auditor.getRecommendations(findings);

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          finding: 'SQL_INJECTION',
          recommendation: expect.stringContaining('parameterized queries'),
          priority: 'critical',
        })
      );

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          finding: 'HARDCODED_SECRET',
          recommendation: expect.stringContaining('environment variables'),
          priority: 'critical',
        })
      );
    });
  });

  describe('security score calculation', () => {
    it('should calculate security score', () => {
      const findings: SecurityFinding[] = [
        { type: 'SQL_INJECTION', severity: 'critical', message: '' },
        { type: 'HARDCODED_SECRET', severity: 'critical', message: '' },
        { type: 'WEAK_CRYPTO', severity: 'medium', message: '' },
        { type: 'PATH_TRAVERSAL', severity: 'high', message: '' },
      ];

      const score = auditor.calculateSecurityScore(findings);

      expect(score).toMatchObject({
        score: expect.any(Number),
        grade: expect.stringMatching(/[A-F]/),
        summary: {
          critical: 2,
          high: 1,
          medium: 1,
          low: 0,
        },
      });

      expect(score.score).toBeLessThan(50); // Poor score due to critical findings
      expect(score.grade).toMatch(/[D-F]/); // Poor grade
    });

    it('should give good score for secure code', () => {
      const findings: SecurityFinding[] = []; // No findings

      const score = auditor.calculateSecurityScore(findings);

      expect(score.score).toBe(100);
      expect(score.grade).toBe('A');
    });
  });

  describe('compliance checks', () => {
    it('should check OWASP compliance', async () => {
      const code = `
        // Unsafe deserialization
        const obj = JSON.parse(userInput);
        
        // Missing security headers
        app.get('/', (req, res) => {
          res.send(sensitiveData);
        });
        
        // Weak session management
        session.cookie.secure = false;
        session.cookie.httpOnly = false;
      `;

      const compliance = await auditor.checkCompliance(code, 'OWASP');

      expect(compliance.compliant).toBe(false);
      expect(compliance.violations).toContainEqual(
        expect.objectContaining({
          rule: 'A08:2021',
          description: expect.stringContaining('Software and Data Integrity'),
        })
      );
    });
  });
});