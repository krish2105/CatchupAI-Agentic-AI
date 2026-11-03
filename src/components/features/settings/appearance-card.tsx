"use client";

import { Segmented, Switch } from "@/components/ui/controls";
import { setPreferences, usePreferences, type MotionPref, type ThemePref } from "@/lib/preferences/store";

export default function AppearanceCard() {
  const prefs = usePreferences();
  return (
    <div className="card setting-card">
      <div className="split-head"><h3>Look and feel</h3></div>
      <div className="setting-line">
        <div>
          <strong id="appearance-label">Appearance</strong>
          <p>Switch between the complete light and dark systems, or follow your device.</p>
        </div>
        <Segmented<ThemePref>
          label="Appearance"
          value={prefs.theme}
          onChange={(theme) => setPreferences({ theme })}
          options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]}
        />
      </div>
      <div className="setting-line">
        <div>
          <strong>3D views</strong>
          <p>Show the learning universe and dashboard orbit in WebGL. When off, every feature still works through lists.</p>
        </div>
        <Switch label="3D views" checked={prefs.threeD} onChange={(threeD) => setPreferences({ threeD })} />
      </div>
      <div className="setting-line">
        <div>
          <strong>Motion</strong>
          <p>Reduce stops continuous orbiting and transitions. System follows your device setting{prefs.motion === "system" ? ` (currently ${prefs.reducedMotion ? "reduced" : "full"})` : ""}.</p>
        </div>
        <Segmented<MotionPref>
          label="Motion"
          value={prefs.motion}
          onChange={(motion) => setPreferences({ motion })}
          options={[{ value: "system", label: "System" }, { value: "reduce", label: "Reduce" }, { value: "full", label: "Full" }]}
        />
      </div>
    </div>
  );
}
