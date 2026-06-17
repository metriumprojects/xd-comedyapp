import { create } from 'zustand';

interface UIStore {
  isTabBarVisible: boolean;
  setTabBarVisible: (visible: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isTabBarVisible: true,
  setTabBarVisible: (visible) => set({ isTabBarVisible: visible }),
}));
