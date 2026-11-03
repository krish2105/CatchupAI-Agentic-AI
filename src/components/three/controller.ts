/**
 * Mutable orientation state shared between the DOM host (pointer/keyboard input)
 * and the R3F frame loop. Kept outside React state so input never re-renders the scene.
 */
export class SceneController {
  targetX = 0;
  targetY = 0;
  private invalidateFrame: (() => void) | null = null;

  attach(invalidate: () => void) {
    this.invalidateFrame = invalidate;
    return () => {
      if (this.invalidateFrame === invalidate) this.invalidateFrame = null;
    };
  }

  nudge(dy: number, dx: number) {
    this.targetY += dy;
    this.targetX = Math.max(-0.6, Math.min(0.6, this.targetX + dx));
    this.invalidateFrame?.();
  }

  spin(delta: number) {
    this.targetY += Math.min(delta, 0.05) * 0.12;
  }
}
