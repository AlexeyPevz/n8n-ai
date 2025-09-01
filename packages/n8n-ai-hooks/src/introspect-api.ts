/**
 * Introspect API для n8n-ai
 * Этот модуль предоставляет runtime информацию о нодах
 */

import type { INodeTypeDescription, INodePropertyOptions } from 'n8n-workflow';
import { createHash } from 'node:crypto';
import { loadBuiltinNodes } from './load-builtin-nodes';

interface NodeIntrospection {
  name: string;
  displayName: string;
  type: string;
  version: number;
  description: string;
  defaults: Record<string, unknown>;
  inputs: string[];
  outputs: string[];
  properties: Array<{
    name: string;
    displayName: string;
    type: string;
    default?: unknown;
    required?: boolean;
    options?: INodePropertyOptions[];
    typeOptions?: Record<string, unknown>;
    displayOptions?: Record<string, unknown>;
  }>;
  credentials?: Array<{
    name: string;
    required?: boolean;
  }>;
}

export class IntrospectAPI {
  private nodeTypes: Map<string, INodeTypeDescription> = new Map();
  private loadOptionsCache: Map<string, { etag: string; options: INodePropertyOptions[]; expiresAt: number } > = new Map();
  private readonly defaultTtlMs: number = Number(process.env.N8N_AI_LOADOPTIONS_TTL_MS ?? 60000);
  private externalLoadOptionsResolver?: (
    nodeType: string,
    propertyName: string,
    currentNodeParameters: Record<string, unknown>
  ) => Promise<INodePropertyOptions[]>;

  constructor() {
    // Предзагружаем встроенные ноды, чтобы экземпляр сразу был полезен в тестах/рантайме
    try {
      const builtin = loadBuiltinNodes();
      this.registerNodeTypes(builtin);
    } catch {
      // best-effort; в некоторых окружениях загрузка может быть недоступна
    }
  }

  /**
   * Регистрирует типы нод для интроспекции
   */
  registerNodeTypes(nodeTypes: INodeTypeDescription[]): void {
    for (const nodeType of nodeTypes) {
      const key = `${nodeType.name}:${nodeType.version}`;
      this.nodeTypes.set(key, nodeType);
    }
  }

  /**
   * Получает список всех доступных нод
   */
  getAllNodes(): NodeIntrospection[] {
    const nodes: NodeIntrospection[] = [];
    for (const _entry of this.nodeTypes) {
      const nodeType = _entry[1];
      nodes.push(this.convertToIntrospection(nodeType));
    }
    
    return nodes;
  }

  /**
   * Получает информацию о конкретной ноде
   */
  getNode(type: string, version?: number): NodeIntrospection | null {
    // Попробуем найти с версией
    if (version !== undefined) {
      const key = `${type}:${version}`;
      const nodeType = this.nodeTypes.get(key);
      if (nodeType) {
        return this.convertToIntrospection(nodeType);
      }
    }
    
    // Ищем последнюю версию
    let latestVersion = 0;
    let latestNode: INodeTypeDescription | null = null;
    
    for (const _entry of this.nodeTypes) {
      const nodeType = _entry[1];
      const nodeVersion = Array.isArray(nodeType.version) 
        ? nodeType.version[nodeType.version.length - 1] 
        : nodeType.version;
        
      if (nodeType.name === type && nodeVersion > latestVersion) {
        latestVersion = nodeVersion;
        latestNode = nodeType;
      }
    }
    
    return latestNode ? this.convertToIntrospection(latestNode) : null;
  }

  /**
   * Конвертирует INodeTypeDescription в упрощенный формат для AI
   */
  private convertToIntrospection(nodeType: INodeTypeDescription): NodeIntrospection {
    // Обрабатываем версию (может быть массивом)
    const version = Array.isArray(nodeType.version) 
      ? nodeType.version[nodeType.version.length - 1] 
      : nodeType.version;
    
    // Обрабатываем inputs/outputs (могут быть сложными типами)
    const inputs = Array.isArray(nodeType.inputs) 
      ? nodeType.inputs.map(input => typeof input === 'string' ? input : 'main')
      : ['main'];
    
    const outputs = Array.isArray(nodeType.outputs)
      ? nodeType.outputs.map(output => typeof output === 'string' ? output : 'main') 
      : ['main'];
    
    return {
      name: nodeType.name,
      displayName: nodeType.displayName,
      type: nodeType.name,
      version: version,
      description: nodeType.description,
      defaults: nodeType.defaults as Record<string, unknown>,
      inputs: inputs,
      outputs: outputs,
      properties: nodeType.properties.map(prop => ({
        name: prop.name,
        displayName: prop.displayName,
        type: prop.type as string,
        default: (prop as unknown as { default?: unknown }).default,
        required: prop.required,
        options: prop.options as INodePropertyOptions[] | undefined,
        typeOptions: prop.typeOptions as Record<string, unknown> | undefined,
        displayOptions: prop.displayOptions as Record<string, unknown> | undefined,
      })),
      credentials: nodeType.credentials,
    };
  }

  /**
   * Резолвит динамические опции для свойства ноды
   * (заглушка - требует интеграции с n8n core)
   */
  async resolveLoadOptions(
    nodeType: string,
    propertyName: string,
    currentNodeParameters: Record<string, unknown>
  ): Promise<INodePropertyOptions[]> {
    // Если настроен внешний резолвер (из ядра n8n) — используем его
    if (this.externalLoadOptionsResolver) {
      try {
        const opts = await this.externalLoadOptionsResolver(nodeType, propertyName, currentNodeParameters);
        if (Array.isArray(opts)) return opts;
      } catch {
        // fallback ниже
      }
    }
    // Мини-реализация: несколько известных свойств
    if (nodeType === 'n8n-nodes-base.httpRequest') {
      if (propertyName === 'method') {
        return [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'HEAD', value: 'HEAD' },
          { name: 'OPTIONS', value: 'OPTIONS' },
        ];
      }
      if (propertyName === 'authentication') {
        return [
          { name: 'None', value: 'none' },
          { name: 'Basic Auth', value: 'basicAuth' },
          { name: 'Header Auth', value: 'headerAuth' },
          { name: 'OAuth2', value: 'oAuth2' },
        ];
      }
      if (propertyName === 'responseFormat') {
        return [
          { name: 'JSON', value: 'json' },
          { name: 'Text', value: 'text' },
          { name: 'Binary', value: 'binary' },
        ];
      }
    }

    // Заглушка по умолчанию
    return [];
  }

  /**
   * Кэшируемый резолв loadOptions с TTL и поддержкой ETag/If-None-Match
   */
  async resolveLoadOptionsCached(
    nodeType: string,
    propertyName: string,
    currentNodeParameters: Record<string, unknown>,
    ifNoneMatch?: string
  ): Promise<{
    options?: INodePropertyOptions[];
    etag: string;
    fromCache: boolean;
    notModified: boolean;
    cacheTtlMs: number;
    expiresAt: number;
  }> {
    const cacheKey = this.buildCacheKey(nodeType, propertyName, currentNodeParameters);
    const now = Date.now();
    const ttlMs = this.defaultTtlMs;

    const cached = this.loadOptionsCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      const notModified = ifNoneMatch && ifNoneMatch === cached.etag;
      return {
        options: notModified ? undefined : cached.options,
        etag: cached.etag,
        fromCache: true,
        notModified: Boolean(notModified),
        cacheTtlMs: ttlMs,
        expiresAt: cached.expiresAt
      };
    }

    // Получаем актуальные опции (с таймаутом при необходимости)
    const options = await this.resolveLoadOptions(nodeType, propertyName, currentNodeParameters);
    const etag = this.computeEtag(options);
    const entry = { etag, options, expiresAt: now + ttlMs };
    this.loadOptionsCache.set(cacheKey, entry);
    const notModified = ifNoneMatch && ifNoneMatch === etag;
    return {
      options: notModified ? undefined : options,
      etag,
      fromCache: false,
      notModified: Boolean(notModified),
      cacheTtlMs: ttlMs,
      expiresAt: entry.expiresAt
    };
  }

  /**
   * Инвалидация кэша для конкретного свойства ноды
   */
  invalidateLoadOptions(nodeType: string, propertyName: string, currentNodeParameters: Record<string, unknown>): void {
    const cacheKey = this.buildCacheKey(nodeType, propertyName, currentNodeParameters);
    this.loadOptionsCache.delete(cacheKey);
  }

  /**
   * Полная очистка кэша loadOptions
   */
  clearLoadOptionsCache(): void {
    this.loadOptionsCache.clear();
  }

  private buildCacheKey(nodeType: string, propertyName: string, currentNodeParameters: Record<string, unknown>): string {
    const base = `${nodeType}::${propertyName}::${this.stableStringify(currentNodeParameters)}`;
    return createHash('sha1').update(base).digest('hex');
  }

  private computeEtag(options: INodePropertyOptions[]): string {
    const payload = this.stableStringify(options);
    return 'W/"' + createHash('sha1').update(payload).digest('hex') + '"';
  }

  private stableStringify(value: unknown): string {
    const seen = new WeakSet<object>();
    const stringify = (v: unknown): unknown => {
      if (v === null || typeof v !== 'object') return v;
      if (seen.has(v as object)) return undefined;
      seen.add(v as object);
      if (Array.isArray(v)) return v.map((i) => stringify(i));
      const keys = Object.keys(v).sort();
      const out: Record<string, unknown> = {};
      for (const k of keys) out[k] = stringify((v as Record<string, unknown>)[k]);
      return out;
    };
    return JSON.stringify(stringify(value));
  }

  /**
   * Интеграция с ядром n8n: установка внешнего резолвера loadOptions
   */
  setExternalLoadOptionsResolver(
    resolver: (
      nodeType: string,
      propertyName: string,
      currentNodeParameters: Record<string, unknown>
    ) => Promise<INodePropertyOptions[]>
  ): void {
    this.externalLoadOptionsResolver = resolver;
  }
}

// Экспортируем singleton
export const introspectAPI = new IntrospectAPI();

// Совместимость с более ранним API, ожидаемым тестами
// Возвращает список нод в формате { name, type, typeVersion, ... }
export interface LegacyNodeType {
  name: string;
  type: string;
  typeVersion: number;
  description: string;
  defaults: Record<string, unknown>;
  inputs: string[];
  outputs: string[];
  properties: Array<{
    name: string;
    displayName: string;
    type: string;
    default?: unknown;
    required?: boolean;
    options?: INodePropertyOptions[];
    typeOptions?: Record<string, unknown>;
    displayOptions?: Record<string, unknown>;
  }>;
}

export interface IntrospectAPIPublic extends IntrospectAPI {
  getAllNodeTypes(): Promise<LegacyNodeType[]>;
  getNodeType(type: string, version?: number): Promise<LegacyNodeType | null>;
}

// Расширяем прототип методами, не нарушая существующие названия внутренних методов
(IntrospectAPI.prototype as unknown as { getAllNodeTypes: () => Promise<LegacyNodeType[]> }).getAllNodeTypes = async function(this: IntrospectAPI): Promise<LegacyNodeType[]> {
  const nodes = (this as unknown as { getAllNodes: () => NodeIntrospection[] }).getAllNodes();
  return nodes.map((n) => ({
    name: n.displayName,
    type: n.type,
    typeVersion: n.version,
    description: n.description,
    defaults: n.defaults,
    inputs: n.inputs,
    outputs: n.outputs,
    properties: n.properties,
  }));
};

(IntrospectAPI.prototype as unknown as { getNodeType: (type: string, version?: number) => Promise<LegacyNodeType | null> }).getNodeType = async function(this: IntrospectAPI, type: string, version?: number): Promise<LegacyNodeType | null> {
  const node = (this as unknown as { getNode: (t: string, v?: number) => NodeIntrospection | null }).getNode(type, version);
  if (!node) return null;
  return {
    name: node.displayName,
    type: node.type,
    typeVersion: node.version,
    description: node.description,
    defaults: node.defaults,
    inputs: node.inputs,
    outputs: node.outputs,
    properties: node.properties,
  };
};


