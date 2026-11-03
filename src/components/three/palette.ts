import type { NodeStatus } from "./types";

/** Mirrors the CSS tokens in orbital.css so WebGL materials follow the active theme. */
export const PALETTES = {
  dark: {
    core: "#354b93", coreEmissive: "#1d2f66", wire: "#80dce2", ringA: "#b5a5ff", ringB: "#80dce2",
    lightA: "#80dce2", lightB: "#b5a5ff", selected: "#f1f5ff",
    status: { on_track: "#80dce2", needs_work: "#ffb49b", mastered: "#c7f46f", no_data: "#72819a" } as Record<NodeStatus, string>,
  },
  light: {
    core: "#aeb3f0", coreEmissive: "#6264b6", wire: "#5277c4", ringA: "#705cba", ringB: "#3c70be",
    lightA: "#3c70be", lightB: "#8973ca", selected: "#17243a",
    status: { on_track: "#128c98", needs_work: "#df6d4d", mastered: "#385fba", no_data: "#7c8899" } as Record<NodeStatus, string>,
  },
} as const;

export type Palette = (typeof PALETTES)["dark"] | (typeof PALETTES)["light"];
