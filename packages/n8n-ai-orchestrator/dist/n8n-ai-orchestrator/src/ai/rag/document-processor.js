import { createHash } from 'node:crypto';
export class DocumentProcessor {
    /**
     * Process node type description into documents
     */
    static processNodeType(node) {
        const documents = [];
        const nodeId = `node:${node.name}`;
        // Main node document
        const mainContent = this.buildNodeContent(node);
        documents.push({
            id: nodeId,
            content: mainContent,
            metadata: {
                source: 'node-description',
                type: 'node-doc',
                nodeType: node.name,
                title: node.displayName,
            },
        });
        // Process each property as a separate document for detailed search
        if (node.properties) {
            for (const prop of node.properties) {
                if (prop.description) {
                    const propId = `${nodeId}:prop:${prop.name}`;
                    const propContent = this.buildPropertyContent(node.name, prop);
                    documents.push({
                        id: propId,
                        content: propContent,
                        metadata: {
                            source: 'node-property',
                            type: 'node-doc',
                            nodeType: node.name,
                            title: `${node.displayName} - ${prop.displayName}`,
                        },
                    });
                }
            }
        }
        return documents;
    }
    /**
     * Process workflow examples
     */
    static processWorkflowExample(workflow, metadata) {
        const id = this.generateId(`example:${metadata.title}`);
        const content = [
            `Workflow Example: ${metadata.title}`,
            metadata.description || '',
            `Tags: ${metadata.tags?.join(', ') || 'none'}`,
            '',
            'Nodes used:',
            ...workflow.nodes.map((n) => `- ${n.type}: ${n.name}`),
            '',
            'Connections:',
            ...this.describeConnections(workflow),
        ].join('\n');
        return {
            id,
            content,
            metadata: {
                source: 'workflow-example',
                type: 'example',
                title: metadata.title,
            },
        };
    }
    /**
     * Process documentation/guide
     */
    static processGuide(content, metadata) {
        const id = this.generateId(`guide:${metadata.title}`);
        return {
            id,
            content: `${metadata.title}\n\n${content}`,
            metadata: {
                source: metadata.category || 'guide',
                type: 'guide',
                title: metadata.title,
                url: metadata.url,
            },
        };
    }
    /**
     * Split long documents into chunks
     */
    static chunkDocument(doc, maxChunkSize = 1500) {
        if (doc.content.length <= maxChunkSize) {
            return [doc];
        }
        const chunks = [];
        const lines = doc.content.split('\n');
        let currentChunk = [];
        let currentSize = 0;
        for (const line of lines) {
            if (currentSize + line.length > maxChunkSize && currentChunk.length > 0) {
                // Save current chunk
                chunks.push({
                    id: `${doc.id}:chunk:${chunks.length}`,
                    content: currentChunk.join('\n'),
                    metadata: {
                        ...doc.metadata,
                        originalId: doc.id,
                        chunkIndex: chunks.length,
                    },
                });
                currentChunk = [line];
                currentSize = line.length;
            }
            else {
                currentChunk.push(line);
                currentSize += line.length + 1;
            }
        }
        // Save last chunk
        if (currentChunk.length > 0) {
            chunks.push({
                id: `${doc.id}:chunk:${chunks.length}`,
                content: currentChunk.join('\n'),
                metadata: {
                    ...doc.metadata,
                    originalId: doc.id,
                    chunkIndex: chunks.length,
                },
            });
        }
        return chunks;
    }
    static buildNodeContent(node) {
        const sections = [
            `Node: ${node.displayName} (${node.name})`,
            `Description: ${node.description}`,
            `Version: ${node.version}`,
            '',
        ];
        // Add input/output info
        sections.push('Inputs/Outputs:');
        sections.push(`- Inputs: ${Array.isArray(node.inputs) ? node.inputs.join(', ') : node.inputs}`);
        sections.push(`- Outputs: ${Array.isArray(node.outputs) ? node.outputs.join(', ') : node.outputs}`);
        sections.push('');
        // Add properties overview
        if (node.properties && node.properties.length > 0) {
            sections.push('Properties:');
            for (const prop of node.properties) {
                const required = prop.required ? ' (required)' : '';
                const type = prop.type;
                sections.push(`- ${prop.displayName}${required}: ${type} - ${prop.description || 'No description'}`);
                if (prop.options && prop.options.length > 0) {
                    const optionsList = prop.options.map((opt) => typeof opt === 'object' ? opt.name : opt).join(', ');
                    sections.push(`  Options: ${optionsList}`);
                }
            }
        }
        // Add credentials info
        if (node.credentials && node.credentials.length > 0) {
            sections.push('');
            sections.push('Credentials:');
            for (const cred of node.credentials) {
                const required = cred.required === false ? ' (optional)' : '';
                sections.push(`- ${cred.name}${required}`);
            }
        }
        return sections.join('\n');
    }
    static buildPropertyContent(nodeType, property) {
        const sections = [
            `Property: ${property.displayName} (${property.name})`,
            `Node: ${nodeType}`,
            `Type: ${property.type}`,
            `Required: ${property.required ? 'Yes' : 'No'}`,
            `Description: ${property.description || 'No description'}`,
        ];
        if (property.default !== undefined) {
            sections.push(`Default: ${JSON.stringify(property.default)}`);
        }
        if (property.options && property.options.length > 0) {
            sections.push('');
            sections.push('Options:');
            for (const opt of property.options) {
                if (typeof opt === 'object') {
                    sections.push(`- ${opt.name}: ${opt.description || opt.value}`);
                }
                else {
                    sections.push(`- ${opt}`);
                }
            }
        }
        if (property.typeOptions) {
            sections.push('');
            sections.push('Type Options:');
            sections.push(JSON.stringify(property.typeOptions, null, 2));
        }
        if (property.displayOptions) {
            sections.push('');
            sections.push('Display Conditions:');
            sections.push(JSON.stringify(property.displayOptions, null, 2));
        }
        return sections.join('\n');
    }
    static describeConnections(workflow) {
        const descriptions = [];
        if (workflow.connections) {
            for (const [fromNode, connections] of Object.entries(workflow.connections)) {
                for (const [outputType, outputs] of Object.entries(connections)) {
                    for (const output of outputs) {
                        for (const connection of output) {
                            descriptions.push(`${fromNode} → ${connection.node} (${outputType})`);
                        }
                    }
                }
            }
        }
        return descriptions.length > 0 ? descriptions : ['No connections'];
    }
    static generateId(input) {
        return createHash('sha256').update(input).digest('hex').substring(0, 16);
    }
}
