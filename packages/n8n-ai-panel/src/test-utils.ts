/**
 * Test utilities for n8n-ai-panel
 */

/**
 * Delay function for tests
 * @param ms Milliseconds to delay
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for next tick in Vue
 */
export const nextTick = (): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

/**
 * Type-safe wrapper access for Vue test utils
 */
export interface TypedWrapper<T extends Record<string, any>> {
  vm: T;
  emitted(): Record<string, any[][]>;
}

/**
 * Cast wrapper to typed version for accessing VM properties
 */
export function getTypedWrapper<T extends Record<string, any>>(wrapper: any): TypedWrapper<T> {
  return wrapper as TypedWrapper<T>;
}

/**
 * Check if element contains specific text content
 */
export function hasTextContent(wrapper: any, selector: string, text: string): boolean {
  const element = wrapper.find(selector);
  return element.exists() && element.text().includes(text);
}

/**
 * Access component data in a test-safe way
 */
export async function getComponentData(wrapper: any, key: string): Promise<any> {
  // Try to access via vm first
  if (wrapper.vm && key in wrapper.vm) {
    return wrapper.vm[key];
  }
  // Otherwise check if it's in the rendered output
  return undefined;
}

/**
 * Set component data in a test-safe way
 */
export async function setComponentData(wrapper: any, data: Record<string, any>): Promise<void> {
  try {
    await wrapper.setData(data);
  } catch (e) {
    // If setData fails, try to trigger the behavior through UI interactions
    console.warn('setData failed, manual interaction may be required:', e);
  }
}