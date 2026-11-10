import { describe, expect, it } from "vitest";
import { buildRecoveryAgent, GUIDE_INSTRUCTIONS, INSTRUCTIONS } from "@/lib/agents/recovery-agent";

describe("Guide me, don't tell me (Socratic mode)", () => {
  it("adds the guiding rules to the same agent's instructions, with the same tools", () => {
    const guide = buildRecoveryAgent("m", undefined, "guide");
    const answer = buildRecoveryAgent("m");
    expect(guide.instructions).toBe(`${INSTRUCTIONS}${GUIDE_INSTRUCTIONS}`);
    expect(answer.instructions).toBe(INSTRUCTIONS);
    expect(guide.tools.map((t) => t.name)).toEqual(answer.tools.map((t) => t.name));
    expect(GUIDE_INSTRUCTIONS).toMatch(/one .*guiding question/i);
    expect(GUIDE_INSTRUCTIONS).toMatch(/two attempts/i);
    expect(GUIDE_INSTRUCTIONS).toMatch(/couldn't verify that/i);
  });
});
