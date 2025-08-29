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
}
export declare const introspectAPI: IntrospectAPI;
export {};
//# sourceMappingURL=introspect-api.d.ts.map