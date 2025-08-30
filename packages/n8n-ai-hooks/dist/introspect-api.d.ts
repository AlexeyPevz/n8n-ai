/**
 * Introspect API для n8n-ai
 * Этот модуль предоставляет runtime информацию о нодах
 */
import type { INodeTypeDescription, INodePropertyOptions } from 'n8n-workflow';
interface NodeIntrospection {
    name: string;
    displayName: string;
    type: string;
    version: number;
    description: string;
    defaults: Record<string, any>;
    inputs: string[];
    outputs: string[];
    properties: Array<{
        name: string;
        displayName: string;
        type: string;
        default?: any;
        required?: boolean;
        options?: INodePropertyOptions[];
        typeOptions?: Record<string, any>;
        displayOptions?: Record<string, any>;
    }>;
    credentials?: Array<{
        name: string;
        required?: boolean;
    }>;
}
export declare class IntrospectAPI {
    private nodeTypes;
    private loadOptionsCache;
    private readonly defaultTtlMs;
    constructor();
    /**
     * Регистрирует типы нод для интроспекции
     */
    registerNodeTypes(nodeTypes: INodeTypeDescription[]): void;
    /**
     * Получает список всех доступных нод
     */
    getAllNodes(): NodeIntrospection[];
    /**
     * Получает информацию о конкретной ноде
     */
    getNode(type: string, version?: number): NodeIntrospection | null;
    /**
     * Конвертирует INodeTypeDescription в упрощенный формат для AI
     */
    private convertToIntrospection;
    /**
     * Резолвит динамические опции для свойства ноды
     * (заглушка - требует интеграции с n8n core)
     */
    resolveLoadOptions(nodeType: string, propertyName: string, currentNodeParameters: Record<string, any>): Promise<INodePropertyOptions[]>;
    /**
     * Кэшируемый резолв loadOptions с TTL и поддержкой ETag/If-None-Match
     */
    resolveLoadOptionsCached(nodeType: string, propertyName: string, currentNodeParameters: Record<string, any>, ifNoneMatch?: string): Promise<{
        options?: INodePropertyOptions[];
        etag: string;
        fromCache: boolean;
        notModified: boolean;
        cacheTtlMs: number;
        expiresAt: number;
    }>;
    /**
     * Инвалидация кэша для конкретного свойства ноды
     */
    invalidateLoadOptions(nodeType: string, propertyName: string, currentNodeParameters: Record<string, any>): void;
    /**
     * Полная очистка кэша loadOptions
     */
    clearLoadOptionsCache(): void;
    private buildCacheKey;
    private computeEtag;
    private stableStringify;
}
export declare const introspectAPI: IntrospectAPI;
export interface LegacyNodeType {
    name: string;
    type: string;
    typeVersion: number;
    description: string;
    defaults: Record<string, any>;
    inputs: string[];
    outputs: string[];
    properties: Array<{
        name: string;
        displayName: string;
        type: string;
        default?: any;
        required?: boolean;
        options?: INodePropertyOptions[];
        typeOptions?: Record<string, any>;
        displayOptions?: Record<string, any>;
    }>;
}
export interface IntrospectAPIPublic extends IntrospectAPI {
    getAllNodeTypes(): Promise<LegacyNodeType[]>;
    getNodeType(type: string, version?: number): Promise<LegacyNodeType | null>;
}
export {};
//# sourceMappingURL=introspect-api.d.ts.map