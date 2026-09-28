import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "visio-theme";
export const DEFAULT_THEME: Theme = "light";

/** Per-device preference (e.g. the TV dark, phones light); storage may be unavailable. */
export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(loadTheme);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // Not persisted; still applies for this session.
    }
  }, []);
  return [theme, setTheme];
}

/** Page background / browser chrome colour per theme (standalone app only). */
export const PAGE_COLOR: Record<Theme, string> = { light: "#f3f6fb", dark: "#0a0d12" };
