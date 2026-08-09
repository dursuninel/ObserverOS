import { create } from 'zustand';

interface UiViewState {
  readonly selectedWorldEntityId: string | null;
  readonly selectWorldEntity: (entityId: string | null) => void;
}

/** UI-only state. Authoritative simulation data must not be stored here. */
export const useUiStore = create<UiViewState>((set) => ({
  selectedWorldEntityId: null,
  selectWorldEntity: (selectedWorldEntityId) => {
    set({ selectedWorldEntityId });
  },
}));

