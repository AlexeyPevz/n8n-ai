/**
 * Re-export from hooks package
 * This is a workaround for workspace imports
 */

// Defer to runtime require of built hooks package to avoid TS project coupling
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadBuiltinNodes: loadNodes } = require('@n8n-ai/hooks');
import type { INodeType, INodeTypeDescription } from 'n8n-workflow';

export function loadBuiltinNodes(): Array<{ description: INodeTypeDescription }> {
  return loadNodes() as any;
}