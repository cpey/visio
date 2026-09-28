import { useEffect, useRef } from "react";
import type { Theme } from "../lib/theme";
import { Icon, type IconName } from "./icons";

export interface MenuItem {
  label: string;
  icon: IconName;
  onClick?: () => void;
  href?: string;
}

interface Props {
  open: boolean;
  onClose(): void;
  userName?: string;
  layouts: { id: string; name: string }[];
  currentLayout: string;
  onSelectLayout(id: string): void;
  items: MenuItem[];
  theme: Theme;
  onTheme(theme: Theme): void;
  /** Installed Visio version; dev deploys look like "0.2.0-dev+ab4b01a". */
  version?: string | null;
  notice?: string;
}

const THEMES: { id: Theme; label: string; icon: IconName }[] = [
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
];

/** Left-side navigation pane: layouts and app actions, hidden behind the menu button. */
export function Drawer({
  open,
  onClose,
  userName,
  layouts,
  currentLayout,
  onSelectLayout,
  items,
  theme,
  onTheme,
  version,
  notice,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const run = (item: MenuItem) => {
    onClose();
    item.onClick?.();
  };

  return (
    <div className={`drawer${open ? " drawer--open" : ""}`} aria-hidden={!open}>
      <div className="drawer__backdrop" onClick={onClose} />
      <nav className="drawer__panel" ref={panelRef} tabIndex={-1} aria-label="Menu">
        <div className="drawer__head">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="brand__name">Visio</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu">
            <Icon name="close" />
          </button>
        </div>
        {userName && <div className="drawer__user">Signed in as {userName}</div>}

        {notice && (
          <div className="drawer__notice">
            <Icon name="alert" size={18} />
            <span>{notice}</span>
          </div>
        )}

        {layouts.length > 0 && (
          <div className="drawer__group">
            <div className="drawer__label">Layouts</div>
            {layouts.map((l) => (
              <button
                key={l.id}
                className={`drawer__item${l.id === currentLayout ? " drawer__item--active" : ""}`}
                onClick={() => {
                  onSelectLayout(l.id);
                  onClose();
                }}
              >
                <Icon name="layout" size={20} />
                <span>{l.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="drawer__group drawer__group--end">
          <div className="drawer__label">Appearance</div>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={theme === t.id}
                className={`segmented__option${theme === t.id ? " segmented__option--active" : ""}`}
                onClick={() => onTheme(t.id)}
              >
                <Icon name={t.icon} size={18} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="drawer__group">
          {items.map((item) =>
            item.href ? (
              <a key={item.label} className="drawer__item" href={item.href}>
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
              </a>
            ) : (
              <button key={item.label} className="drawer__item" onClick={() => run(item)}>
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
              </button>
            ),
          )}
        </div>
        {version && (
          <div className={`drawer__version${version.includes("-dev") ? " drawer__version--dev" : ""}`}>
            Visio {version}
            {version.includes("-dev") && <span className="badge badge--stale">dev build</span>}
          </div>
        )}
      </nav>
    </div>
  );
}
