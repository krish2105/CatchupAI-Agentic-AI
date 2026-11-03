import type { NodeStatus } from "./types";

/** Mirrors the Nature Flow tokens (nature.css) so WebGL materials follow the active theme. */
export const PALETTES = {
  dark: {
    core: "#2a5a48", coreEmissive: "#123a2c", wire: "#7ed0ca", ringA: "#e5bc6a", ringB: "#7ed0ca",
    lightA: "#7ed0ca", lightB: "#e5bc6a", selected: "#ecf3ec",
    status: { on_track: "#7ed0ca", needs_work: "#e5bc6a", mastered: "#8fe0b0", no_data: "#6f8a7c" } as Record<NodeStatus, string>,
  },
  light: {
    core: "#9dbfa9", coreEmissive: "#5e8c78", wire: "#2d6a52", ringA: "#c99a3c", ringB: "#21746f",
    lightA: "#fff4d8", lightB: "#9fd0cb", selected: "#1c3328",
    status: { on_track: "#21746f", needs_work: "#b7791f", mastered: "#22704a", no_data: "#8a9c92" } as Record<NodeStatus, string>,
  },
} as const;

export type Palette = (typeof PALETTES)["dark"] | (typeof PALETTES)["light"];
