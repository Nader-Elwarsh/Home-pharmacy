import { useLoader } from '@/hooks/useLoader';
import { loadCabinet, loadItemDetail, type CabinetData, type ItemDetail } from '@/core/services/inventoryService';

export type { LoadState } from '@/hooks/useLoader';

export function useCabinet() {
  return useLoader<CabinetData>(() => loadCabinet(), []);
}

export function useItemDetail(id: string) {
  return useLoader<ItemDetail>(() => loadItemDetail(id), [id]);
}
