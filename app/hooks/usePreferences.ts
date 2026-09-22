"use client";

import { useEffect, useState } from "react";
import { loadPrefs, persistPrefs, PREF_DEFAULTS, type Preferences } from "@/lib/preferences";

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(PREF_DEFAULTS);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  function update(patch: Partial<Preferences>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      persistPrefs(next);
      return next;
    });
  }

  return { prefs, update };
}
