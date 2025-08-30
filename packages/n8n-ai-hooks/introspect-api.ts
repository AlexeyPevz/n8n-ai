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
      defaults: nodeType.defaults,
      inputs: inputs,
      outputs: outputs,
      properties: nodeType.properties.map(prop => ({
        name: prop.name,
        displayName: prop.displayName,
        type: prop.type as string,
        default: prop.default,
        required: prop.required,
        options: prop.options as INodePropertyOptions[] | undefined,
        typeOptions: prop.typeOptions as Record<string, any> | undefined,
        displayOptions: prop.displayOptions as Record<string, any> | undefined,
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
    // Мини-реализация: несколько известных свойств
    if (nodeType === 'n8n-nodes-base.httpRequest') {
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
}

// Экспортируем singleton
export const introspectAPI = new IntrospectAPI();