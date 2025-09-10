import { ref } from 'vue';

// Use fetch to simplify mocking in unit tests
import type { MapData, MapNode, MapEdge } from '../types/workflow-map';

export function useWorkflowMap(): any {
  const isLoading = ref(true);
  const mapData = ref<MapData | null>(null);
  const nodes = ref<MapNode[]>([]);
  const edges = ref<MapEdge[]>([]);

  async function fetchMap(params: { depth: number; includeExternal: boolean }) {
    isLoading.value = true;
    try {
      const url = new URL('/api/v1/ai/workflow-map', 'http://localhost');
      url.searchParams.set('depth', String(params.depth));
      url.searchParams.set('includeExternal', String(params.includeExternal));
      const response = await fetch(url.pathname + url.search, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      mapData.value = data as MapData;
      return data as MapData;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    isLoading,
    mapData,
    nodes,
    edges,
    fetchMap,
  };
}
