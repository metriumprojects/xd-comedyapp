import { create } from 'zustand';

interface ReelsState {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
}

export const useReelsStore = create<ReelsState>((set) => ({
  activeIndex: 0,
  setActiveIndex: (index: number) => set({ activeIndex: index }),
  isModalOpen: false,
  setModalOpen: (open: boolean) => set({ isModalOpen: open }),
}));
