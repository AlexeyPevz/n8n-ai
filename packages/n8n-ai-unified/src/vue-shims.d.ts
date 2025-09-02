declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
  export const DIFF_PREVIEW_MODAL_KEY: string;
  export const SECRETS_WIZARD_MODAL_KEY: string;
}