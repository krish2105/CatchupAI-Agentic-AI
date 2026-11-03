# 03 | Visual + 3D Design System -- Orbital Atelier V2

The **canonical** complete spec is `docs/15_ORBITAL_ATELIER_VISUAL_REDESIGN.md`; this document is a quick map for agents expecting the original 03 file.

## Visual direction

Original, Awwwards-informed but not copied: editorial typography, depth through a faceted knowledge core and orbital worlds, sculptural cards, meaningful state illustration. The standalone `design-reference/CatchUp_AI_Orbital_Atelier.html` shows nine fully navigable screens with both light and dark palettes and real interactive perspective projection built with Canvas 2D. The earlier reference `CatchUp_AI_Interactive_Prototype.html` is historical.

## Product color tokens

| Role | Dark | Light |
| --- | --- | --- |
| Background | `#090d18` | `#f3f2ee` |
| Sidebar | `#0d1322` | `#f8f8f5` |
| Surface | `#111a2b` | `#ffffff` |
| Foreground | `#f1f5ff` | `#17243a` |
| Secondary | `#9eacc3` | `#607088` |
| CTA | `#c7f46f` | `#385fba` |
| Violet | `#b5a5ff` | `#6b58c7` |
| Aqua | `#80dce2` | `#128c98` |
| Coral | `#ffb49b` | `#df6d4d` |

## 3D production requirement

- Actual client R3F-v9 learning universe route `/universe`, dashboard mini-orb, nodes corresponding to **real** courses/topics and evidence status, accessible DOM inspector/list.
- Use a single scene/canvas where practical, lazy mount, dpr max 1.5, user-controlled 3D/motion and no-WebGL fallback. WebGL is never a gate for core workflows.
- Light/dark changes must update scene lights, background, line materials and labels as well as normal CSS.
- Nothing can pretend to be a real agent trace or student analytics value. In the standalone demo all student/AI actions are simulated.

## Recommended delivery sequence

First port the shared shell and all nine routes while building real P0 backend slices, then connect R3F universe to real data and evidence. Keep security, planner feasibility and approved writes ahead of cosmetic 3D polish. See doc 16.
