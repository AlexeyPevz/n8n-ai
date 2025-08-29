/**
 * Introspect API для n8n-ai
 * Этот модуль предоставляет runtime информацию о нодах
 */
export class IntrospectAPI {
    nodeTypes = new Map();
    /**
     * Регистрирует типы нод для интроспекции
     */
    registerNodeTypes(nodeTypes) {
        for (const nodeType of nodeTypes) {
            const key = `${nodeType.name}:${nodeType.version}`;
            this.nodeTypes.set(key, nodeType);
        }
    }
    /**
     * Получает список всех доступных нод
     */
    getAllNodes() {
        const nodes = [];
        for (const [key, nodeType] of this.nodeTypes) {
            nodes.push(this.convertToIntrospection(nodeType));
        }
        return nodes;
    }
    /**
     * Получает информацию о конкретной ноде
     */
    getNode(type, version) {
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
        let latestNode = null;
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
    convertToIntrospection(nodeType) {
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
    async resolveLoadOptions(nodeType, propertyName, currentNodeParameters) {
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
