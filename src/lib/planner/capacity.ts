/** Pure deterministic feasibility utility; independent of AI and database. */
export type CapacityResult = {
  requiredMinutes: number;
  availableMinutes: number;
  shortfallMinutes: number;
  spareMinutes: number;
  coveragePercent: number;
  feasible: boolean;
};

export function assessCapacity(requiredMinutes: number, availableMinutes: number): CapacityResult {
  if (![requiredMinutes, availableMinutes].every((v) => Number.isFinite(v) && v >= 0)) {
    throw new RangeError("Minutes must be finite nonnegative numbers");
  }
  const shortfallMinutes = Math.max(0, requiredMinutes - availableMinutes);
  const spareMinutes = Math.max(0, availableMinutes - requiredMinutes);
  return {
    requiredMinutes,
    availableMinutes,
    shortfallMinutes,
    spareMinutes,
    coveragePercent: requiredMinutes === 0 ? 100 : Math.min(100, Math.round((availableMinutes / requiredMinutes) * 100)),
    feasible: requiredMinutes <= availableMinutes,
  };
}
