/**
 * Типы для UI компонентов
 * Заменяют импорты из n8n
 */

export interface Toast {
  showMessage: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    title: string;
    message?: string;
  }) => void;
  showError: (error: any, title?: string) => void;
}

export interface Modal {
  open: (name: string, data?: any) => void;
  close: (name: string) => void;
}

export interface I18n {
  baseText: (key: string, options?: { interpolate?: Record<string, any> }) => string;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
}

export interface WorkflowConnection {
  from: string;
  to: string;
  index?: number;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}