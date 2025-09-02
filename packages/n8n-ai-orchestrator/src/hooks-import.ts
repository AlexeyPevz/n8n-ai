/**
 * Re-export from hooks package
 * This is a workaround for workspace imports
 */

import { loadBuiltinNodes as loadNodes } from '../../n8n-ai-hooks/src/load-builtin-nodes';
import type { INodeType, INodeTypeDescription } from 'n8n-workflow';

export function loadBuiltinNodes(): Array<{ description: INodeTypeDescription }> {
  return loadNodes() as any;
}