# 15 | Orbital Atelier: canonical end-to-end UI design

**Status:** A new, original standalone interactive concept, not a connected backend application.

## Open these FIRST

- `design-reference/CatchUp_AI_Orbital_Atelier.html` -- **canonical visual and interaction specification**; open in a browser. It is one self-contained HTML file requiring no CDN, fonts or API keys.
- `design-reference/Orbital_Dark_Desktop.png`, `Orbital_Light_Desktop.png`, `Orbital_3D_Atlas.png`, `Orbital_Recovery_Lab.png`, `Orbital_Mobile_Dark.png`, and `Orbital_Mobile_Light.png` -- visual QA references.
- `public/orbital-atelier-preview.html` -- a copy available at `/orbital-atelier-preview.html` when Next.js dev server runs.
- The **previous** `design-reference/CatchUp_AI_Interactive_Prototype.html` is retained for history, not the implementation target.

## Concept and design philosophy

**Orbital Atelier**: an academic mission-control interface where knowledge becomes a navigable 3D constellation. The experience blends editorial type, precise spatial graphics, a restrained palette, layered card materials and transparent agent operations. It should feel like a purpose-built premium product, not a generic template or visually overloaded 3D portfolio.

Inspiration was researched from public design examples, but all mockup visuals, canvas geometry, typography and layout are original; do not reproduce other sites' assets or layouts.

### Direct references and what to learn from them

1. [Awwwards: Portfolio Arthur Engel](https://www.awwwards.com/sites/portfolio-arthur-engel) -- spatial sci-fi storytelling and memorable navigation. **Adapt** narrative intent, not unrelated game-like navigation.
2. [Awwwards 3D collection](https://www.awwwards.com/websites/3d/) -- breadth of 3D direction; do not treat a showcase as evidence of practical accessibility.
3. [Codrops: Atelier UI / WebGL + DOM, Oct 21 2026](https://tympanus.net/codrops/2026/10/21/atelier-ui-webgl-dom/) -- keep real HTML and WebGL in sync rather than replacing meaningful controls with inaccessible 3D.
4. [Codrops 3D Creative Hub](https://tympanus.net/codrops/hub/tag/3D/) -- ideas for material, depth, tasteful animation and interaction.
5. [React Three Fiber stable docs](https://r3f.docs.pmnd.rs/) -- v9 with React 19; v10 alpha at time of research.
6. [React Three Fiber accessibility preferences](https://a11y.docs.pmnd.rs/access-user-preferences) -- respect color scheme and reduced motion.
7. [R3F performance scaling](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/scaling-performance.mdx) -- adapt quality and avoid sustained heavy postprocessing.

## Design tokens

| Token | Dark | Light |
| --- | --- | --- |
| Body | `#090d18` | `#f3f2ee` |
| Sidebar | `#0d1322` | `#f8f8f5` |
| Primary surface | `#111a2b` | `#ffffff` |
| Text | `#f1f5ff` | `#17243a` |
| Secondary text | `#9eacc3` | `#607088` |
| Primary action | `#c7f46f` | `#385fba` |
| Primary action text | `#182413` | `#ffffff` |
| Violet accent | `#b5a5ff` | `#6b58c7` |
| Aqua accent | `#80dce2` | `#128c98` |
| Warm accent | `#ffb49b` | `#df6d4d` |

Use semantic CSS variables. No hard-coded dark-only text in light mode. Both modes must include hero, canvas overlays, nav, input fields, charts, cards, notifications, modal, badges and tool traces. Save preference locally in the demo; use authenticated profile preferences if practical in production.

## Nine-screen UX inventory

| Mockup screen | Production route | Required interactions |
| --- | --- | --- |
| Mission control | `/dashboard` | status, capacity, priorities, lesson overview, start recovery |
| Learning universe | `/universe` | real R3F interactive topic nodes; accessible HTML topic list; keyboard alternative |
| AI copilot | `/assistant` | streamed/structured requests, real authorized tools, citations, proposal link |
| Recovery lab | `/recovery` | compare 3 deterministic scenarios, adjustable capacity, feasibility, approval preview |
| Knowledge vault | `/courses` and `/courses/[id]` | course list, private PDF upload, processing status, grounded citations |
| Study schedule | `/planner` | approved tasks, completion, persistence, deadlines and availability |
| Practice arena | `/quizzes` | quiz, saved attempts, feedback and source evidence |
| Your momentum | `/insights` | honest metrics calculated from persisted plans and assessments |
| Preferences | `/settings` | dark/light/system, 3D on/off, reduced motion, auth/profile settings |

Include `/login` and loading/error/empty/suspense views in real application.

## Interactive 3D: meaningful rather than decorative-only

**Standalone prototype:** perspective-projected 3D nodes, a faceted knowledge core, orbital paths, drag rotation, keyboard arrow rotation, topic selection and dark/light palettes; rendered using **Canvas 2D** to keep a self-contained, offline HTML. It does **not** use Three.js or real API data.

**Production:** stable `@react-three/fiber@9` with React 19 + Three.js. Make `LearningUniverse` its own route and a small `KnowledgeOrb` for the dashboard. Use actual learner data to determine node labels and color/state, not random colors or hallucinated scores. Clicking a node should open a **DOM** drawer with topic mastery, document citations, deadlines, and actions. Keyboard and screen readers must be able to use a parallel DOM topic list without dragging the canvas.

Engineering contract:
- Keep semantic HTML for buttons, forms, inputs, citations, information and action approval; reserve WebGL for spatial visualization.
- One context for the universe scene where possible; lazy-load via dynamic imports. `dpr` cap ~1.5, motion/quality budgets, visibility pausing, no mandatory heavy shaders/GLTF downloads.
- Honor `prefers-reduced-motion`, `prefers-color-scheme`, explicit toggle and no-WebGL fallback. Preserve data access when canvas is unavailable.
- Desktop pointer drag and keyboard arrows for the 3D context; no automatic complex 3D movement on low-end mobile.
- Real tool activity must come from executed backend trace data; prototype agent steps are **simulated** and must never leak into production state.

## Screen-specific visual language

- Dashboard hero: large editorial promise and learning universe. Do not bury the primary CTA in the art.
- Recovery lab: visual comparison + feasibility math; selected scenario card has strong focus outline; approval preview stays normal HTML.
- AI copilot: prompt chips, clear tool trace and source citations. Show loading/cancellation/errors and label proposed vs executed actions.
- Knowledge vault: compact sculptural course cards, upload state, visible indexing progress and retry.
- Planner: generous schedule rows, completion affordances, time zone clarity.
- Quiz: readable high-contrast options and source-backed explanations after answering.
- Insights: honest charts; never imply measured grades from illustrative demo data.
- Preferences: theme toggle in header **and** settings, explicit reduced motion and 3D switches.

## Explicit non-goals

Do not build a VR environment, mandatory 3D-only navigation, costly particle effects on every screen, unbounded animation loops in hidden tabs, a multi-agent swarm, or flashy effects that delay the core recovery path. These undermine the hackathon's main agentic deliverable.

## Visual acceptance gates

1. Test at least 1440x900, 1024x768, 390x844 and 320x700 in both dark and light.
2. Full theme toggle works throughout, survives page refresh and never breaks readability or focus.
3. Working keyboard/mobile navigation, no horizontal overflow, accessible controls and visible text alternative to spatial topic selection.
4. Interactive 3D is responsive but all core tasks work when 3D/motion is disabled.
5. User can complete: assistant -> compare scenarios -> approve -> planner -> mark complete -> quiz -> insights.
6. **After integrating backend:** every state and citation is real. No prototype fakes remain in production.
