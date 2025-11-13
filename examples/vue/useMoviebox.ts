import { ref, computed } from 'vue';

import {
  MovieboxSession,
  search,
  getMovieDetails,
  createLogger
} from 'moviebox-js-sdk';

const session = new MovieboxSession({
  logger: createLogger({ level: 'error', name: 'moviebox-vue' })
});

export function useMovieboxSearch() {
  const query = ref('');
  const loading = ref(false);
  const results = ref([]);
  const error = ref<string | null>(null);

  const hasResults = computed(() => results.value.length > 0);

  const runSearch = async () => {
    if (!query.value.trim()) {
      results.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const response = await search(session, { query: query.value.trim() });
      results.value = response.results;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  };

  const loadDetails = async (detailPath: string) => {
    loading.value = true;
    try {
      return await getMovieDetails(session, { detailPath });
    } finally {
      loading.value = false;
    }
  };

  return {
    query,
    loading,
    results,
    error,
    hasResults,
    runSearch,
    loadDetails
  };
}
