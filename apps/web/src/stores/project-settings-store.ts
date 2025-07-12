import { create } from "zustand";

export interface ProjectSettings {
  fps: number;
  quality: "480p" | "720p" | "1080p" | "1440p" | "2160p";
  customBitrate: number;
  resolution: string;
}

interface ProjectSettingsStore {
  settings: ProjectSettings;
  updateFps: (fps: number) => void;
  updateQuality: (quality: ProjectSettings["quality"]) => void;
  updateCustomBitrate: (bitrate: number) => void;
  updateResolution: (resolution: string) => void;
  resetSettings: () => void;
}

const defaultSettings: ProjectSettings = {
  fps: 30,
  quality: "1080p",
  customBitrate: 5000,
  resolution: "1920x1080",
};

export const useProjectSettingsStore = create<ProjectSettingsStore>((set) => ({
  settings: defaultSettings,
  
  updateFps: (fps) =>
    set((state) => ({
      settings: { ...state.settings, fps },
    })),
    
  updateQuality: (quality) =>
    set((state) => ({
      settings: { ...state.settings, quality },
    })),
    
  updateCustomBitrate: (customBitrate) =>
    set((state) => ({
      settings: { ...state.settings, customBitrate },
    })),
    
  updateResolution: (resolution) =>
    set((state) => ({
      settings: { ...state.settings, resolution },
    })),
    
  resetSettings: () => set({ settings: defaultSettings }),
})); 