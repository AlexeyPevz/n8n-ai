import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
/**
 * Security audit scanner
 */
export class SecurityAuditor {
    issues = [];
    /**
     * Run complete security audit
     */
    async runAudit(projectPath) {
        this.issues = [];
        // Check for common vulnerabilities
        await this.checkDependencies(projectPath);
        await this.checkCodePatterns(projectPath);
        await this.checkConfiguration(projectPath);
        await this.checkAuthentication(projectPath);
        await this.checkDataValidation(projectPath);
        await this.checkCrypto(projectPath);
        await this.checkFileOperations(projectPath);
        await this.checkNetworking(projectPath);
        // Generate summary
        const summary = {
            critical: this.issues.filter(i => i.severity === 'critical').length,
            high: this.issues.filter(i => i.severity === 'high').length,
            medium: this.issues.filter(i => i.severity === 'medium').length,
            low: this.issues.filter(i => i.severity === 'low').length,
            total: this.issues.length,
        };
        return {
            issues: this.issues,
            summary,
            timestamp: new Date(),
        };
    }
    /**
     * Check for vulnerable dependencies
     */
    async checkDependencies(projectPath) {
        try {
            const packageJson = await readFile(join(projectPath, 'package.json'), 'utf-8');
            const pkg = JSON.parse(packageJson);
            // Check for known vulnerable versions
            const vulnerableDeps = {
                'lodash': '<4.17.21',
                'minimist': '<1.2.6',
                'axios': '<0.21.2',
                'node-fetch': '<2.6.7',
            };
            for (const [dep, safeVersion] of Object.entries(vulnerableDeps)) {
                if (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]) {
                    const version = pkg.dependencies?.[dep] || pkg.devDependencies?.[dep];
                    // Simplified version check - in production use semver
                    this.addIssue({
                        severity: 'high',
                        type: 'vulnerable-dependency',
                        file: 'package.json',
                        description: `Potentially vulnerable dependency: ${dep}@${version}`,
                        recommendation: `Update ${dep} to version ${safeVersion} or higher`,
                    });
                }
            }
        }
        catch (error) {
            // Skip if package.json not found
        }
    }
    /**
     * Check for dangerous code patterns
     */
    async checkCodePatterns(projectPath) {
        const dangerousPatterns = [
            {
                pattern: /eval\s*\(/g,
                severity: 'critical',
                description: 'Use of eval() detected',
                recommendation: 'Avoid eval() - use safer alternatives like JSON.parse or Function constructor with validation',
            },
            {
                pattern: /new\s+Function\s*\(/g,
                severity: 'high',
                description: 'Dynamic function creation detected',
                recommendation: 'Avoid dynamic function creation or validate input thoroughly',
            },
            {
                pattern: /innerHTML\s*=/g,
                severity: 'high',
                description: 'Direct innerHTML assignment detected',
                recommendation: 'Use textContent or sanitize HTML input to prevent XSS',
            },
            {
                pattern: /document\.write/g,
                severity: 'medium',
                description: 'document.write usage detected',
                recommendation: 'Use modern DOM manipulation methods instead',
            },
            {
                pattern: /process\.env\./g,
                severity: 'low',
                description: 'Environment variable access',
                recommendation: 'Ensure sensitive data in env vars is properly protected',
            },
            {
                pattern: /crypto\.createHash\(['"]md5['"]\)/g,
                severity: 'high',
                description: 'MD5 hash usage detected',
                recommendation: 'Use SHA-256 or stronger hash algorithms',
            },
            {
                pattern: /setTimeout\s*\([^,]+,\s*0\)/g,
                severity: 'low',
                description: 'setTimeout with user input detected',
                recommendation: 'Validate any dynamic timeout values',
            },
        ];
        // Scan source files
        await this.scanDirectory(projectPath, async (filePath, content) => {
            if (!filePath.endsWith('.ts') && !filePath.endsWith('.js'))
                return;
            for (const { pattern, severity, description, recommendation } of dangerousPatterns) {
                const matches = content.match(pattern);
                if (matches) {
                    this.addIssue({
                        severity,
                        type: 'dangerous-pattern',
                        file: filePath,
                        description: `${description} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`,
                        recommendation,
                    });
                }
            }
        });
    }
    /**
     * Check configuration security
     */
    async checkConfiguration(projectPath) {
        // Check for hardcoded secrets
        const secretPatterns = [
            /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi,
            /secret\s*[:=]\s*["'][^"']+["']/gi,
            /password\s*[:=]\s*["'][^"']+["']/gi,
            /token\s*[:=]\s*["'][^"']+["']/gi,
        ];
        await this.scanDirectory(projectPath, async (filePath, content) => {
            // Skip node_modules and test files
            if (filePath.includes('node_modules') || filePath.includes('.test.'))
                return;
            for (const pattern of secretPatterns) {
                if (pattern.test(content)) {
                    this.addIssue({
                        severity: 'critical',
                        type: 'hardcoded-secret',
                        file: filePath,
                        description: 'Potential hardcoded secret detected',
                        recommendation: 'Move secrets to environment variables or secure key management system',
                    });
                }
            }
        });
    }
    /**
     * Check authentication implementation
     */
    async checkAuthentication(projectPath) {
        // Check for missing authentication
        const authPatterns = {
            missingAuth: /\/(api|v\d+)\/[^/]+/,
            weakToken: /token\.length\s*<\s*\d{1,2}/,
            noRateLimit: /server\.(get|post|put|delete)\(/,
        };
        // Add authentication checks
        this.addIssue({
            severity: 'medium',
            type: 'authentication',
            description: 'Ensure all API endpoints have proper authentication',
            recommendation: 'Implement API key or JWT authentication for all endpoints',
        });
    }
    /**
     * Check data validation
     */
    async checkDataValidation(projectPath) {
        // Check for missing input validation
        await this.scanDirectory(projectPath, async (filePath, content) => {
            if (!filePath.endsWith('.ts'))
                return;
            // Check for request handlers without validation
            const handlerPattern = /\.(get|post|put|delete|patch)\s*\([^)]+\)\s*{/g;
            const validationPattern = /validate|schema|zod|joi/i;
            const handlers = content.match(handlerPattern);
            if (handlers && !validationPattern.test(content)) {
                this.addIssue({
                    severity: 'high',
                    type: 'missing-validation',
                    file: filePath,
                    description: 'Request handlers without input validation detected',
                    recommendation: 'Add input validation using Zod or similar validation library',
                });
            }
        });
    }
    /**
     * Check cryptographic operations
     */
    async checkCrypto(projectPath) {
        const weakCrypto = [
            { pattern: /Math\.random\(\)/g, context: 'token|secret|password|key', severity: 'high' },
            { pattern: /DES|RC4|MD5/g, context: '', severity: 'high' },
            { pattern: /sha1/gi, context: 'password|hash', severity: 'medium' },
        ];
        await this.scanDirectory(projectPath, async (filePath, content) => {
            if (!filePath.endsWith('.ts') && !filePath.endsWith('.js'))
                return;
            for (const { pattern, context, severity } of weakCrypto) {
                const matches = content.match(pattern);
                if (matches && (!context || new RegExp(context, 'i').test(content))) {
                    this.addIssue({
                        severity,
                        type: 'weak-crypto',
                        file: filePath,
                        description: 'Weak cryptographic operation detected',
                        recommendation: 'Use crypto.randomBytes() for secure random values and SHA-256+ for hashing',
                    });
                }
            }
        });
    }
    /**
     * Check file operations
     */
    async checkFileOperations(projectPath) {
        const filePatterns = [
            { pattern: /readFile|writeFile|unlink/g, check: 'path validation' },
            { pattern: /createReadStream|createWriteStream/g, check: 'path validation' },
            { pattern: /\.\.\//g, check: 'path traversal' },
        ];
        await this.scanDirectory(projectPath, async (filePath, content) => {
            if (!filePath.endsWith('.ts'))
                return;
            for (const { pattern, check } of filePatterns) {
                if (pattern.test(content)) {
                    this.addIssue({
                        severity: 'medium',
                        type: 'file-operations',
                        file: filePath,
                        description: `File operations detected - ensure ${check}`,
                        recommendation: 'Validate and sanitize all file paths, prevent directory traversal',
                    });
                }
            }
        });
    }
    /**
     * Check networking security
     */
    async checkNetworking(projectPath) {
        // Check for insecure protocols
        const insecureProtocols = [
            { pattern: /http:\/\//g, severity: 'medium', exclude: 'localhost|127.0.0.1' },
            { pattern: /ftp:\/\//g, severity: 'high', exclude: '' },
            { pattern: /telnet:\/\//g, severity: 'high', exclude: '' },
        ];
        await this.scanDirectory(projectPath, async (filePath, content) => {
            for (const { pattern, severity, exclude } of insecureProtocols) {
                const matches = content.match(pattern);
                if (matches) {
                    const filtered = exclude
                        ? matches.filter(m => !new RegExp(exclude).test(m))
                        : matches;
                    if (filtered.length > 0) {
                        this.addIssue({
                            severity,
                            type: 'insecure-protocol',
                            file: filePath,
                            description: `Insecure protocol usage: ${filtered[0]}`,
                            recommendation: 'Use HTTPS/TLS for all external communications',
                        });
                    }
                }
            }
        });
    }
    /**
     * Helper to scan directory recursively
     */
    async scanDirectory(dir, callback) {
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    await this.scanDirectory(fullPath, callback);
                }
                else if (entry.isFile()) {
                    try {
                        const content = await readFile(fullPath, 'utf-8');
                        await callback(fullPath, content);
                    }
                    catch {
                        // Skip files that can't be read
                    }
                }
            }
        }
        catch {
            // Skip directories that can't be accessed
        }
    }
    /**
     * Add issue to results
     */
    addIssue(issue) {
        this.issues.push(issue);
    }
}
/**
 * Generate security report
 */
export function generateSecurityReport(result) {
    const lines = [
        '# Security Audit Report',
        '',
        `Generated: ${result.timestamp.toISOString()}`,
        '',
        '## Summary',
        '',
        `- Critical Issues: ${result.summary.critical}`,
        `- High Severity: ${result.summary.high}`,
        `- Medium Severity: ${result.summary.medium}`,
        `- Low Severity: ${result.summary.low}`,
        `- Total Issues: ${result.summary.total}`,
        '',
    ];
    if (result.issues.length > 0) {
        lines.push('## Issues Found', '');
        const grouped = result.issues.reduce((acc, issue) => {
            if (!acc[issue.severity])
                acc[issue.severity] = [];
            acc[issue.severity].push(issue);
            return acc;
        }, {});
        for (const severity of ['critical', 'high', 'medium', 'low']) {
            const issues = grouped[severity];
            if (issues && issues.length > 0) {
                lines.push(`### ${severity.toUpperCase()} Severity`, '');
                for (const issue of issues) {
                    lines.push(`#### ${issue.type}`);
                    if (issue.file)
                        lines.push(`- File: ${issue.file}`);
                    if (issue.line)
                        lines.push(`- Line: ${issue.line}`);
                    lines.push(`- Description: ${issue.description}`);
                    lines.push(`- Recommendation: ${issue.recommendation}`);
                    lines.push('');
                }
            }
        }
    }
    else {
        lines.push('No security issues found! 🎉');
    }
    return lines.join('\n');
}
