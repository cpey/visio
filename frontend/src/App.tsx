import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getConfig, getVersion, setConfig } from "./api/config";
import { fetchEntityDevices } from "./api/registry";
import { usePullToRefresh } from "./lib/pull";
import { missingFromLayout, pickLayout, resolveTiles } from "./lib/resolve";
import { PAGE_COLOR, useTheme } from "./lib/theme";
import type { Hass, VisioConfig } from "./types";
import { Drawer, type MenuItem } from "./views/Drawer";
import { Grid } from "./views/Grid";
import { PullIndicator } from "./views/PullIndicator";
import { Settings } from "./views/Settings";

interface Props {
  hass: Hass;
  /** Extra menu entries, e.g. log out in the standalone app. */
  menuItems?: MenuItem[];
  /** Standalone page: also theme the page background and browser bar. */
  pageChrome?: boolean;
}

function layoutFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("layout");
}

export function App({ hass, menuItems = [], pageChrome = false }: Props) {
  const [theme, setTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [layoutParam, setLayoutParam] = useState(layoutFromUrl);
  const [config, setConfigState] = useState<VisioConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "settings">("grid");
  const [deviceOf, setDeviceOf] = useState<Map<string, string>>(() => new Map());
  const [version, setVersion] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Bumped on refresh: remounts the grid so every tile restarts its stream/polling.
  const [generation, setGeneration] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const hassRef = useRef(hass);
  hassRef.current = hass;
  const isAdmin = hass.user?.is_admin ?? false;

  const load = useCallback(async () => {
    const [cfg, devices] = await Promise.all([getConfig(hassRef.current), fetchEntityDevices(hassRef.current)]);
    setConfigState(cfg);
    setDeviceOf(devices);
    setError(null);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err?.message ?? "Could not load Visio config"));
    getVersion(hassRef.current).then(setVersion);
  }, [load]);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // Keep the spinner up briefly so the refresh is visible even when instant.
      await Promise.all([load(), new Promise((r) => setTimeout(r, 600))]);
      setGeneration((g) => g + 1);
    } catch (err) {
      setError((err as Error)?.message ?? "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshing]);

  // `config` in the condition: the root element only exists once config has loaded.
  const pull = usePullToRefresh(rootRef, refresh, !!config && view === "grid" && !refreshing);

  const save = useCallback(
    async (next: VisioConfig) => setConfigState(await setConfig(hass, next)),
    [hass],
  );

  const [layoutId, layout] = config ? pickLayout(config, layoutParam) : [null, null];

  // Keep ?layout= in the URL so links and home-screen shortcuts can target a layout.
  const selectLayout = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("layout", id);
    window.history.replaceState(null, "", url.toString());
    setLayoutParam(id);
  };
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const tiles = useMemo(
    () => (config && layout ? resolveTiles(hass.states, config, layout, false, deviceOf) : []),
    [hass.states, config, layout, deviceOf],
  );

  // Standalone app: the page itself (overscroll area, browser bar) follows the theme too.
  useEffect(() => {
    if (!pageChrome) return;
    document.body.style.background = PAGE_COLOR[theme];
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PAGE_COLOR[theme]);
  }, [theme, pageChrome]);

  let content: ReactNode;
  if (error) {
    content = <div className="empty">⚠ {error}</div>;
  } else if (!config || !layout) {
    content = <div className="empty">Loading…</div>;
  } else if (view === "settings" && isAdmin) {
    content = <Settings hass={hass} config={config} onSave={save} onClose={() => setView("grid")} />;
  } else {
    const missing = isAdmin ? missingFromLayout(hass.states, layout) : [];
    const items: MenuItem[] = [
      { label: "Refresh", icon: "refresh", onClick: refresh },
      ...(isAdmin ? [{ label: "Settings", icon: "settings" as const, onClick: () => setView("settings") }] : []),
      ...menuItems,
    ];
    content = (
      <div ref={rootRef} className="app-root">
        <PullIndicator pull={pull} refreshing={refreshing} />
        <Drawer
          open={menuOpen}
          onClose={closeMenu}
          userName={hass.user?.name}
          layouts={Object.entries(config.layouts).map(([id, l]) => ({ id, name: l.name || id }))}
          currentLayout={layoutId ?? ""}
          onSelectLayout={selectLayout}
          items={items}
          theme={theme}
          onTheme={setTheme}
          version={version}
          notice={
            missing.length
              ? `${missing.length} device${missing.length > 1 ? "s" : ""} not in this layout: ${missing
                  .map((id) => hass.states[id]?.attributes.friendly_name ?? id)
                  .join(", ")}`
              : undefined
          }
        />
        <Grid
          key={generation}
          hass={hass}
          layout={layout}
          tiles={tiles}
          refreshing={refreshing}
          onRefresh={refresh}
          onOpenMenu={() => setMenuOpen(true)}
          menuAlert={missing.length > 0}
          config={config}
          onConfig={setConfigState}
        />
      </div>
    );
  }

  return <div className={`theme theme--${theme}`}>{content}</div>;
}
