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

export class IntrospectAPI {
  private nodeTypes: Map<string, INodeTypeDescription> = new Map();

  /**
   * Регистрирует типы нод для интроспекции
   */
  registerNodeTypes(nodeTypes: INodeTypeDescription[]) {
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
    
    for (const [key, nodeType] of this.nodeTypes) {
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
    
    for (const [key, nodeType] of this.nodeTypes) {
      if (nodeType.name === type && nodeType.version > latestVersion) {
        latestVersion = nodeType.version;
        latestNode = nodeType;
      }
    }
    
    return latestNode ? this.convertToIntrospection(latestNode) : null;
  }

  /**
   * Конвертирует INodeTypeDescription в упрощенный формат для AI
   */
  private convertToIntrospection(nodeType: INodeTypeDescription): NodeIntrospection {
    return {
      name: nodeType.name,
      displayName: nodeType.displayName,
      type: nodeType.name,
      version: nodeType.version,
      description: nodeType.description,
      defaults: nodeType.defaults,
      inputs: nodeType.inputs,
      outputs: nodeType.outputs,
      properties: nodeType.properties.map(prop => ({
        name: prop.name,
        displayName: prop.displayName,
        type: prop.type,
        default: prop.default,
        required: prop.required,
        options: prop.options,
        typeOptions: prop.typeOptions,
        displayOptions: prop.displayOptions,
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
    currentNodeParameters: Record<string, any>
  ): Promise<INodePropertyOptions[]> {
    // TODO: Интегрировать с n8n для реального резолва
    // Пока возвращаем mock данные
    
    if (nodeType === 'n8n-nodes-base.httpRequest' && propertyName === 'authentication') {
      return [
        { name: 'None', value: 'none' },
        { name: 'Basic Auth', value: 'basicAuth' },
        { name: 'Header Auth', value: 'headerAuth' },
        { name: 'OAuth2', value: 'oAuth2' },
      ];
    }
    
    return [];
  }
}

// Экспортируем singleton
export const introspectAPI = new IntrospectAPI();