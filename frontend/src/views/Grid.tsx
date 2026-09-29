import { useEffect, useState } from "react";
import type { Hass, Layout, VisioConfig } from "../types";
import type { ResolvedTile } from "../lib/resolve";
import { DOMAINS, tileDefinitionFor } from "../tiles/registry";
import { Icon } from "./icons";

interface Props {
  hass: Hass;
  layout: Layout;
  tiles: ResolvedTile[];
  refreshing?: boolean;
  onRefresh?: () => void;
  onOpenMenu?: () => void;
  /** Show a dot on the menu button (something in the menu needs attention). */
  menuAlert?: boolean;
  /** For domain section controls (e.g. blinds Automatic/Manual). */
  config?: VisioConfig;
  onConfig?: (config: VisioConfig) => void;
}

/** Group tiles by domain, keeping the order they arrive in. */
function sections(tiles: ResolvedTile[]): [string, ResolvedTile[]][] {
  const groups = new Map<string, ResolvedTile[]>();
  for (const tile of tiles) {
    if (!groups.has(tile.domain)) groups.set(tile.domain, []);
    groups.get(tile.domain)!.push(tile);
  }
  return [...groups.entries()];
}

export function Grid({ hass, layout, tiles, refreshing, onRefresh, onOpenMenu, menuAlert, config, onConfig }: Props) {
  const [focused, setFocused] = useState<string | null>(null);
  // Selected entities for domains with a group control (e.g. blinds).
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const setSelection = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const toggle = (entityId: string) => setFocused((f) => (f === entityId ? null : entityId));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") setFocused(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="view">
      <header className="header">
        {onOpenMenu && (
          <button className="icon-btn icon-btn--menu" onClick={onOpenMenu} aria-label="Open menu">
            <Icon name="menu" />
            {menuAlert && <span className="icon-btn__dot" />}
          </button>
        )}
        <h1 className="title">{layout.name ?? "Visio"}</h1>
        {onRefresh && (
          <button
            className={`icon-btn${refreshing ? " icon-btn--spinning" : ""}`}
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
          >
            <Icon name="refresh" />
          </button>
        )}
      </header>

      {tiles.length === 0 ? (
        <div className="empty">Nothing to show yet. Add a camera or blinds integration in Home Assistant.</div>
      ) : (
        sections(tiles).map(([domain, sectionTiles], _i, all) => {
          const controls = !sectionTiles.some((t) => tileDefinitionFor(t).expandable);
          const GroupControl = DOMAINS[domain]?.groupControl;
          const SectionControl = DOMAINS[domain]?.sectionControl;
          const sectionIds = sectionTiles.map((t) => t.entityId);
          const chosen = sectionIds.filter((id) => selected.has(id));
          const allChosen = chosen.length === sectionIds.length;
          return (
            <section key={domain} className="section">
              {(all.length > 1 || SectionControl) && (
                <div className="section__head">
                  {all.length > 1 && <h2 className="section__title">{DOMAINS[domain]?.title ?? domain}</h2>}
                  {SectionControl && config && onConfig && (
                    <SectionControl hass={hass} config={config} onConfig={onConfig} />
                  )}
                </div>
              )}
              {/* Always rendered (disabled when empty) so the layout doesn't shift. */}
              {GroupControl && sectionIds.length > 1 && (
                <GroupControl
                  hass={hass}
                  entityIds={chosen}
                  allIds={sectionIds}
                  selectAll={{
                    checked: allChosen,
                    indeterminate: chosen.length > 0 && !allChosen,
                    onChange: (on) => setSelection(sectionIds, on),
                  }}
                />
              )}
              <div
                className={`grid${controls ? " grid--controls" : ""}`}
                style={controls ? undefined : { gridTemplateColumns: `repeat(${layout.columns ?? 3}, minmax(0, 1fr))` }}
              >
                {sectionTiles.map((tile) => {
                  const { component: Tile, expandable } = tileDefinitionFor(tile);
                  const isFocused = focused === tile.entityId;
                  if (!expandable) {
                    const isSelected = selected.has(tile.entityId);
                    if (GroupControl) {
                      // Selectable card: the whole card toggles selection (tap, Enter or Space).
                      const toggleSelected = () => setSelection([tile.entityId], !isSelected);
                      return (
                        <div
                          key={tile.entityId}
                          className={`grid__cell grid__cell--selectable${isSelected ? " grid__cell--selected" : ""}`}
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-label={tile.name}
                          tabIndex={0}
                          onClick={toggleSelected}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleSelected();
                            }
                          }}
                        >
                          <span className={`select-box${isSelected ? " select-box--on" : ""}`} aria-hidden="true" />
                          <Tile hass={hass} tile={tile} />
                        </div>
                      );
                    }
                    return (
                      <div key={tile.entityId} className="grid__cell grid__cell--static">
                        <Tile hass={hass} tile={tile} />
                      </div>
                    );
                  }
                  return (
                    // div, not button: tiles may contain links. Focusable for TV remotes.
                    // Full screen enlarges this same cell (CSS) so a live stream keeps its
                    // session; a second instance would open a second session, which
                    // providers like Ring refuse.
                    <div
                      key={tile.entityId}
                      className={`grid__cell${isFocused ? " grid__cell--focused" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(tile.entityId)}
                      onKeyDown={(e) => e.key === "Enter" && toggle(tile.entityId)}
                    >
                      <Tile hass={hass} tile={tile} large={isFocused} />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
