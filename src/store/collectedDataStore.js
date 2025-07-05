import { create } from "zustand";

export const useCollectedDataStore = create((set) => ({
  isCapturedImage: false,

  setIsCapturedImage: (state) => set(() => ({ isCapturedImage: state })),
}));
