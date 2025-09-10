# 🔧 КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ - n8n-ai v0.1.0

**Дата**: 20 декабря 2025  
**Приоритет**: P0 - Критические исправления для релиза  
**Время выполнения**: 1-2 дня  

---

## 🚨 COMMIT #1: Security Fixes

### Файл: `packages/n8n-ai-orchestrator/src/security/jwt-middleware.ts`
```typescript
import jwt from 'jsonwebtoken';
import { FastifyRequest, FastifyReply } from 'fastify';

interface JWTPayload {
  userId: string;
  role: string;
  exp: number;
}

export async function jwtMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return reply.status(401).send({ error: 'Missing JWT token' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    const payload = jwt.verify(token, secret) as JWTPayload;
    
    // Проверка expiration
    if (payload.exp < Date.now() / 1000) {
      return reply.status(401).send({ error: 'Token expired' });
    }
    
    // Добавляем пользователя в request context
    (request as any).user = {
      id: payload.userId,
      role: payload.role
    };
    
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid JWT token' });
  }
}
```

### Файл: `packages/n8n-ai-orchestrator/src/security/rbac.ts`
```typescript
interface Permission {
  resource: string;
  action: string;
}

interface Role {
  name: string;
  permissions: Permission[];
}

const ROLES: Record<string, Role> = {
  admin: {
    name: 'admin',
    permissions: [
      { resource: 'workflows', action: 'read' },
      { resource: 'workflows', action: 'write' },
      { resource: 'workflows', action: 'delete' },
      { resource: 'ai', action: 'execute' },
      { resource: 'metrics', action: 'read' }
    ]
  },
  developer: {
    name: 'developer',
    permissions: [
      { resource: 'workflows', action: 'read' },
      { resource: 'workflows', action: 'write' },
      { resource: 'ai', action: 'execute' }
    ]
  },
  viewer: {
    name: 'viewer',
    permissions: [
      { resource: 'workflows', action: 'read' },
      { resource: 'metrics', action: 'read' }
    ]
  }
};

export function hasPermission(userRole: string, resource: string, action: string): boolean {
  const role = ROLES[userRole];
  if (!role) return false;
  
  return role.permissions.some(
    p => p.resource === resource && p.action === action
  );
}

export function requirePermission(resource: string, action: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    
    if (!hasPermission(user.role, resource, action)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}
```

### Файл: `packages/n8n-ai-orchestrator/src/security/cors-config.ts`
```typescript
export function getCorsConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return {
      origin: [
        'https://app.n8n-ai.com',
        'https://staging.n8n-ai.com'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Token']
    };
  }
  
  // Development - более мягкие правила, но не полностью открытые
  return {
    origin: (origin: string, callback: Function) => {
      // Разрешаем localhost и известные dev домены
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5678',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Token']
  };
}
```

---

## 🚨 COMMIT #2: Code Quality Fixes

### Файл: `packages/n8n-ai-orchestrator/src/security/security-middleware.ts`
```typescript
// Исправления для failing тестов

export function sanitizeSqlInput(input: string | null): string {
  if (!input) return '';
  
  return input
    .replace(/\bSELECT\b/gi, '  ')
    .replace(/\bINSERT\b/gi, '  ')
    .replace(/\bUPDATE\b/gi, '  ')
    .replace(/\bDELETE\b/gi, '  ')
    .replace(/\bFROM\b/gi, '  ')
    .replace(/\bWHERE\b/gi, '  ')
    .replace(/\bUNION\b/gi, '  ')
    .replace(/\bOR\b/gi, '  ')
    .replace(/\bAND\b/gi, '  ')
    .replace(/['"]/g, '') // Удаляем кавычки
    .replace(/--.*$/gm, '') // Удаляем комментарии
    .replace(/\/\*[\s\S]*?\*\//g, '') // Удаляем блочные комментарии
    .replace(/WAITFOR\s+DELAY/gi, 'WAITFOR DELAY') // Нормализуем WAITFOR
    .replace(/\s+/g, ' ') // Нормализуем пробелы
    .trim();
}

export function sanitizeHtmlInput(input: string | null): string {
  if (!input) return '';
  
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  return input
    .replace(/[&<>"'/]/g, char => htmlEntities[char] || char)
    .replace(/\x00/g, '') // Удаляем null bytes
    .replace(/\x01/g, ''); // Удаляем control characters
}

export function sanitizePath(path: string | null): string {
  if (!path) return '';
  
  return path
    .replace(/\.{2,}/g, '') // Удаляем path traversal
    .replace(/[;`|&$()]/g, '') // Удаляем shell specials
    .replace(/\\/g, '') // Удаляем backslashes
    .replace(/\x00/g, '') // Удаляем null bytes
    .replace(/\x01/g, '') // Удаляем control characters
    .replace(/\x02/g, '') // Удаляем control characters
    .replace(/^https?:\/\//, 'https://') // Нормализуем URLs
    .trim();
}

export function generateSecureToken(length: number = 32): string {
  // Валидация входных параметров
  if (typeof length !== 'number' || length < 1 || length > 1024) {
    throw new Error('Invalid token length');
  }
  
  return randomBytes(length).toString('hex');
}

export function hashSensitiveData(data: string, salt?: string): string {
  if (!data) return '';
  
  const actualSalt = salt || '';
  const hash = createHash('sha256').update(data + actualSalt).digest('hex');
  
  return `${hash}:${actualSalt}`;
}
```

---

## 🚨 COMMIT #3: Accessibility Fixes

### Файл: `packages/n8n-ai-panel/src/App.vue`
```vue
<template>
  <div class="app" role="main">
    <!-- Tab navigation with keyboard support -->
    <nav class="tabs" role="tablist" aria-label="Main navigation">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-button', { active: activeTab === tab.id }]"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`${tab.id}-panel`"
        role="tab"
        @click="setActiveTab(tab.id)"
        @keydown.enter="setActiveTab(tab.id)"
        @keydown.space.prevent="setActiveTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- AI Panel with proper ARIA -->
    <div
      v-if="activeTab === 'ai'"
      id="ai-panel"
      class="ai-panel"
      role="tabpanel"
      aria-labelledby="ai-tab"
    >
      <!-- Expression input with proper labeling -->
      <div class="expression-section">
        <label for="expression-input" class="expression-label">
          Описание воркфлоу
        </label>
        <input
          id="expression-input"
          v-model="expression"
          type="text"
          class="expression-input"
          placeholder="Опишите что должен делать воркфлоу..."
          aria-describedby="expression-help"
          @keydown.enter="generatePlan"
        />
        <div id="expression-help" class="help-text">
          Enter — сгенерировать • ↑/↓ — навигация • Esc — закрыть
        </div>
      </div>

      <!-- Plan section with proper structure -->
      <div v-if="planItems.length" class="plan-section" role="region" aria-label="Generated plan">
        <h3>План</h3>
        <ul class="plan-list" role="list">
          <li
            v-for="(item, i) in planItems"
            :key="i"
            class="plan-item"
            role="listitem"
          >
            {{ item }}
          </li>
        </ul>
        
        <button
          class="preview-button"
          @click="previewDiff"
          @keydown.enter="previewDiff"
          @keydown.space.prevent="previewDiff"
        >
          Preview Diff
        </button>
      </div>

      <!-- Progress bar with proper labeling -->
      <div v-if="progress >= 0" class="progress-section" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" aria-label="Generation progress">
        <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
      </div>

      <!-- Action buttons with proper labeling -->
      <div class="action-buttons" role="group" aria-label="Workflow actions">
        <button
          v-if="diffItems.length"
          class="apply-button"
          @click="apply"
          @keydown.enter="apply"
          @keydown.space.prevent="apply"
        >
          Apply
        </button>
        
        <button
          v-if="canUndo"
          class="undo-button"
          @click="undo"
          @keydown.enter="undo"
          @keydown.space.prevent="undo"
        >
          Undo
        </button>
        
        <button
          class="test-button"
          @click="testWorkflow"
          @keydown.enter="testWorkflow"
          @keydown.space.prevent="testWorkflow"
        >
          Test
        </button>
        
        <button
          class="git-export-button"
          @click="gitExport"
          @keydown.enter="gitExport"
          @keydown.space.prevent="gitExport"
        >
          Git Export
        </button>
      </div>
    </div>

    <!-- Error messages with proper ARIA -->
    <div
      v-if="lints.length"
      class="lints"
      role="alert"
      aria-live="polite"
    >
      <h4>Ошибки валидации</h4>
      <ul class="lint-list">
        <li
          v-for="(lint, i) in lints"
          :key="i"
          :class="['lint-item', lint.level]"
        >
          {{ lint.message }}
        </li>
      </ul>
    </div>

    <!-- Simulation stats with proper structure -->
    <div
      v-if="simStats"
      class="sim"
      role="region"
      aria-label="Simulation results"
    >
      <h4>Результаты симуляции</h4>
      <div class="sim-stats">
        <div class="stat">
          <span class="stat-label">Время выполнения:</span>
          <span class="stat-value">{{ simStats.executionTime }}ms</span>
        </div>
        <div class="stat">
          <span class="stat-label">Узлов:</span>
          <span class="stat-value">{{ simStats.nodeCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// ... existing script with keyboard navigation support

function setActiveTab(tabId: string) {
  activeTab.value = tabId;
}

// Keyboard navigation
function handleKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      if (activeTab.value === 'ai') {
        activeTab.value = 'workflow';
      }
      break;
    case 'Tab':
      // Let browser handle default tab navigation
      break;
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
/* Improved contrast and focus indicators */
.tab-button:focus,
.expression-input:focus,
.preview-button:focus,
.apply-button:focus,
.undo-button:focus,
.test-button:focus,
.git-export-button:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

.expression-input {
  border: 2px solid #ccc;
  padding: 8px;
  font-size: 16px; /* Prevent zoom on mobile */
}

.expression-input:focus {
  border-color: #0066cc;
}

/* High contrast for error messages */
.lint-item.error {
  color: #d32f2f;
  background-color: #ffebee;
  border-left: 4px solid #d32f2f;
  padding: 8px;
  margin: 4px 0;
}

.lint-item.warning {
  color: #f57c00;
  background-color: #fff3e0;
  border-left: 4px solid #f57c00;
  padding: 8px;
  margin: 4px 0;
}

/* Ensure sufficient color contrast */
.tab-button.active {
  background-color: #0066cc;
  color: #ffffff;
}

.help-text {
  color: #666;
  font-size: 14px;
  margin-top: 4px;
}
</style>
```

---

## 🚨 COMMIT #4: Test Fixes

### Файл: `packages/n8n-ai-orchestrator/src/security/security-tests.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { hasPermission, requirePermission } from '../security/rbac.js';

describe('RBAC System', () => {
  describe('hasPermission', () => {
    it('should grant admin full access', () => {
      expect(hasPermission('admin', 'workflows', 'read')).toBe(true);
      expect(hasPermission('admin', 'workflows', 'write')).toBe(true);
      expect(hasPermission('admin', 'workflows', 'delete')).toBe(true);
      expect(hasPermission('admin', 'ai', 'execute')).toBe(true);
      expect(hasPermission('admin', 'metrics', 'read')).toBe(true);
    });

    it('should grant developer limited access', () => {
      expect(hasPermission('developer', 'workflows', 'read')).toBe(true);
      expect(hasPermission('developer', 'workflows', 'write')).toBe(true);
      expect(hasPermission('developer', 'ai', 'execute')).toBe(true);
      expect(hasPermission('developer', 'workflows', 'delete')).toBe(false);
      expect(hasPermission('developer', 'metrics', 'read')).toBe(false);
    });

    it('should grant viewer read-only access', () => {
      expect(hasPermission('viewer', 'workflows', 'read')).toBe(true);
      expect(hasPermission('viewer', 'metrics', 'read')).toBe(true);
      expect(hasPermission('viewer', 'workflows', 'write')).toBe(false);
      expect(hasPermission('viewer', 'ai', 'execute')).toBe(false);
    });

    it('should deny access for unknown roles', () => {
      expect(hasPermission('unknown', 'workflows', 'read')).toBe(false);
      expect(hasPermission('', 'workflows', 'read')).toBe(false);
    });
  });
});

describe('CORS Security', () => {
  it('should validate origins correctly', () => {
    const { validateOrigin } = require('../security/cors-config.js');
    
    const allowedOrigins = ['https://*.n8n-ai.com'];
    
    expect(validateOrigin('https://app.n8n-ai.com', allowedOrigins)).toBe(true);
    expect(validateOrigin('https://staging.n8n-ai.com', allowedOrigins)).toBe(true);
    expect(validateOrigin('https://malicious.com', allowedOrigins)).toBe(false);
    expect(validateOrigin('http://app.n8n-ai.com', allowedOrigins)).toBe(false);
  });
});
```

---

## 🚨 COMMIT #5: ESLint Fixes

### Файл: `.eslintrc.js`
```javascript
module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended',
    'prettier'
  ],
  rules: {
    // Vue specific rules
    'vue/max-attributes-per-line': ['error', {
      singleline: { max: 3 },
      multiline: { max: 1 }
    }],
    'vue/html-self-closing': ['error', {
      html: {
        void: 'never',
        normal: 'always',
        component: 'always'
      }
    }],
    'vue/html-indent': ['error', 2],
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
    
    // TypeScript rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    
    // General rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
};
```

---

## 📋 CHECKLIST ДЛЯ ПРИМЕНЕНИЯ

### Перед применением:
- [ ] Создать backup текущего состояния
- [ ] Запустить все тесты для baseline
- [ ] Проверить текущие ESLint ошибки

### После каждого коммита:
- [ ] Запустить `pnpm test:unit`
- [ ] Запустить `pnpm lint`
- [ ] Проверить что приложение запускается
- [ ] Запустить smoke тесты

### После всех коммитов:
- [ ] Запустить полный CI pipeline
- [ ] Провести security audit
- [ ] Провести accessibility audit
- [ ] Обновить документацию

---

## 🎯 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

После применения всех исправлений:
- ✅ 0 критических security уязвимостей
- ✅ 0 ESLint ошибок
- ✅ 0 failing тестов
- ✅ Базовая accessibility compliance
- ✅ Готовность к релизу

**Время выполнения**: 1-2 дня  
**Ответственный**: Development Team  
**Статус**: 🔧 Готов к применению