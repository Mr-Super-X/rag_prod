import { ref, type Ref } from "vue";

interface AsyncState<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  execute: (fn: () => Promise<T>) => Promise<T | null>;
}

export function useAsync<T>(): AsyncState<T> {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function execute(fn: () => Promise<T>): Promise<T | null> {
    loading.value = true;
    error.value = null;
    try {
      const result = await fn();
      data.value = result;
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "操作失败";
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { data, loading, error, execute };
}
