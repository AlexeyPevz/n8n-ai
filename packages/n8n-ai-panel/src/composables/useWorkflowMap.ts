import { ref } from 'vue';
import axios from 'axios';
import type { MapData, MapNode, MapEdge } from '../types/workflow-map';

export function useWorkflowMap() {
  const isLoading = ref(false);
  const mapData = ref<MapData | null>(null);
  const nodes = ref<MapNode[]>([]);
  const edges = ref<MapEdge[]>([]);

  async function fetchMap(params: { depth: number; includeExternal: boolean }) {
    isLoading.value = true;
    try {
      const response = await axios.get('/api/v1/ai/workflow-map', {
        params,
      });
      mapData.value = response.data;
      return response.data as MapData;
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

