import { create } from "zustand";

export const useCollectedDataStore = create((set) => ({
  isCapturedImage: false,
  imageSrc: null,

  setIsCapturedImage: (state) => set(() => ({ isCapturedImage: state })),
  setImageSrc: (state) => set(() => ({ imageSrc: state })),
}));
