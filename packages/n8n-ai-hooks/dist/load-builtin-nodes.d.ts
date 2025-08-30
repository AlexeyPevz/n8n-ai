/**
 * Загрузчик встроенных нод n8n
 * Этот модуль загружает описания всех базовых нод из n8n-nodes-base
 */
import type { INodeTypeDescription } from 'n8n-workflow';
/**
 * Создает базовое описание ноды для Introspect API
 * Это временное решение пока не подключена реальная n8n
 */
export declare function createNodeTypeDescription(name: string, displayName: string): INodeTypeDescription;
/**
 * Загружает все базовые ноды
 */
export declare function loadBuiltinNodes(): INodeTypeDescription[];
//# sourceMappingURL=load-builtin-nodes.d.ts.map