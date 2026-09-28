import { useMemo, useState } from "react";
import type { EntityProfile, Hass, Layout, VisioConfig } from "../types";
import { DISCOVERED_DOMAINS, discoverEntities, domainOf, withDefaults } from "../lib/resolve";
import { COMMON_FIELDS, DOMAINS } from "../tiles/registry";
import type { FieldSpec } from "../tiles/types";
import { Icon } from "./icons";
import { SystemSettings } from "./SystemSettings";

interface Props {
  hass: Hass;
  config: VisioConfig;
  onSave(config: VisioConfig): Promise<void>;
  onClose(): void;
}

const LAYOUTS_TAB = "layouts";
const SYSTEM_TAB = "system";

function FieldInput({
  hass,
  field,
  value,
  onChange,
}: {
  hass: Hass;
  field: FieldSpec;
  value: unknown;
  onChange(value: unknown): void;
}) {
  switch (field.kind) {
    case "bool":
      return (
        <input
          type="checkbox"
          className="switch"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case "number":
      return (
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "select":
      return (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {field.optionLabels?.[o] ?? o}
            </option>
          ))}
        </select>
      );
    case "entity": {
      const options = Object.keys(hass.states)
        .filter((id) => !field.domain || domainOf(id) === field.domain)
        .sort();
      return (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          {options.map((id) => (
            <option key={id} value={id}>
              {hass.states[id].attributes.friendly_name ?? id}
            </option>
          ))}
        </select>
      );
    }
    default:
      return (
        <input
          type={field.kind === "url" ? "url" : "text"}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
  }
}

/** Drop undefined values so the stored document stays minimal. */
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function DeviceRow({
  hass,
  id,
  stored,
  open,
  onToggle,
  onChange,
}: {
  hass: Hass;
  id: string;
  stored: EntityProfile | undefined;
  open: boolean;
  onToggle(): void;
  onChange(key: keyof EntityProfile, value: unknown): void;
}) {
  const profile = withDefaults(id, stored, hass.states[id]);
  const domain = domainOf(id);
  // Device-specific options first, then the general ones (name, order, hidden, battery).
  const fields = [...(DOMAINS[domain]?.fields ?? []), ...COMMON_FIELDS].filter((f) => !f.when || f.when(profile));
  const haName = hass.states[id]?.attributes.friendly_name ?? id;
  const chips = [
    ...(profile.hidden ? ["Hidden"] : []),
    ...(DOMAINS[domain]?.summary?.(profile) ?? []),
    ...(profile.hide_battery ? ["Battery hidden"] : []),
  ];

  return (
    <div className={`row${open ? " row--open" : ""}${id in hass.states ? "" : " row--missing"}`}>
      <button className="row__head" onClick={onToggle} aria-expanded={open}>
        <span className="row__text">
          <span className="row__name">{profile.name || haName}</span>
          <span className="row__meta">
            {chips.length ? chips.join(" · ") : "Default settings"}
          </span>
        </span>
        <span className="row__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="row__body">
          <code className="row__id">{id}</code>
          {fields.map((field) => (
            <label key={field.key} className={`field${field.kind === "bool" ? " field--bool" : ""}`}>
              <span className="field__label">{field.label}</span>
              <FieldInput
                hass={hass}
                field={field}
                value={profile[field.key]}
                onChange={(v) => onChange(field.key, v)}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function Settings({ hass, config, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<VisioConfig>(() => structuredClone(config));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const entityIds = useMemo(() => {
    const ids = new Set([...discoverEntities(hass.states), ...Object.keys(draft.entities)]);
    return [...ids].sort((a, b) =>
      (hass.states[a]?.attributes.friendly_name ?? a).localeCompare(hass.states[b]?.attributes.friendly_name ?? b),
    );
  }, [hass.states, draft.entities]);

  const byDomain = useMemo(
    () => DISCOVERED_DOMAINS.map((d) => [d, entityIds.filter((id) => domainOf(id) === d)] as const),
    [entityIds],
  );
  const tabs = [
    ...byDomain.filter(([, ids]) => ids.length).map(([d, ids]) => ({ id: d, label: DOMAINS[d]?.title ?? d, count: ids.length })),
    { id: LAYOUTS_TAB, label: "Layouts", count: Object.keys(draft.layouts).length },
    { id: SYSTEM_TAB, label: "System" },
  ] as { id: string; label: string; count?: number }[];
  const [tab, setTab] = useState<string>(() => tabs[0].id);

  const dirty = JSON.stringify(draft) !== JSON.stringify(config);
  const isDeviceTab = tab !== LAYOUTS_TAB && tab !== SYSTEM_TAB;
  const DomainSettings = isDeviceTab ? DOMAINS[tab]?.settingsSection : undefined;

  const setProfile = (id: string, key: keyof EntityProfile, value: unknown) =>
    setDraft((d) => ({
      ...d,
      entities: { ...d.entities, [id]: clean({ ...d.entities[id], [key]: value }) },
    }));

  const setLayout = (id: string, patch: Partial<Layout>) =>
    setDraft((d) => ({ ...d, layouts: { ...d.layouts, [id]: clean({ ...d.layouts[id], ...patch }) } }));

  const addLayout = () => {
    const id = prompt("Layout id (lowercase letters, digits, - or _), e.g. tv");
    if (id && /^[a-z0-9_-]{1,32}$/.test(id) && !draft.layouts[id]) {
      setLayout(id, { name: id, columns: 3 });
    }
  };

  const removeLayout = (id: string) =>
    setDraft((d) => {
      const layouts = { ...d.layouts };
      delete layouts[id];
      return { ...d, layouts };
    });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Forget profiles of entities that no longer exist in HA.
      const entities = Object.fromEntries(
        Object.entries(draft.entities).filter(([id, p]) => id in hass.states && Object.keys(p).length),
      );
      await onSave({ ...draft, entities });
      setMessage("Saved");
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const displayName = (eid: string) =>
    draft.entities[eid]?.name || hass.states[eid]?.attributes.friendly_name || eid;

  return (
    <div className="view settings">
      <header className="header">
        <button className="icon-btn icon-btn--menu" onClick={onClose} aria-label="Back">
          <Icon name="back" />
        </button>
        <h1 className="title">Settings</h1>
        <span className="settings__msg">{message ?? (dirty ? "Unsaved changes" : "")}</span>
        <button className="btn" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tabs__tab${tab === t.id ? " tabs__tab--active" : ""}`}
            onClick={() => {
              setTab(t.id);
              setOpenRow(null);
            }}
          >
            {t.label}
            {t.count !== undefined && <span className="tabs__count">{t.count}</span>}
          </button>
        ))}
      </nav>

      {isDeviceTab && DomainSettings && (
        <DomainSettings
          hass={hass}
          draft={draft}
          setDraft={setDraft}
          entityIds={(byDomain.find(([d]) => d === tab)?.[1] ?? []).filter((id) => id in hass.states)}
        />
      )}

      {tab === SYSTEM_TAB ? (
        <SystemSettings hass={hass} draft={draft} setDraft={setDraft} />
      ) : isDeviceTab ? (
        <section className="rows">
          {DomainSettings && <h2 className="rows__title">Devices</h2>}
          {(byDomain.find(([d]) => d === tab)?.[1] ?? []).map((id) => (
            <DeviceRow
              key={id}
              hass={hass}
              id={id}
              stored={draft.entities[id]}
              open={openRow === id}
              onToggle={() => setOpenRow((o) => (o === id ? null : id))}
              onChange={(key, v) => setProfile(id, key, v)}
            />
          ))}
        </section>
      ) : (
        <section className="rows">
          <p className="hint">
            Switch layouts from the menu, or link one with <code>?layout=&lt;id&gt;</code>.
          </p>
          {Object.entries(draft.layouts).map(([id, layout]) => (
            <div key={id} className="card">
              <div className="card__title">
                <span>
                  {layout.name || id} <code>{id}</code>
                </span>
                {Object.keys(draft.layouts).length > 1 && (
                  <button className="btn btn--ghost" onClick={() => removeLayout(id)}>
                    Remove
                  </button>
                )}
              </div>
              <label className="field">
                <span className="field__label">Name</span>
                <input value={layout.name ?? ""} onChange={(e) => setLayout(id, { name: e.target.value })} />
              </label>
              <label className="field">
                <span className="field__label">Camera columns</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={layout.columns ?? 3}
                  onChange={(e) => setLayout(id, { columns: Number(e.target.value) })}
                />
              </label>
              <div className="field field--stack">
                <span className="field__label">Shown devices</span>
                <span className="hint">None ticked shows everything, including new devices.</span>
                <div className="checklist-groups">
                  {byDomain
                    .filter(([, ids]) => ids.length)
                    .map(([d, ids]) => (
                      <fieldset key={d} className="checklist">
                        <legend>{DOMAINS[d]?.title ?? d}</legend>
                        {ids.map((eid) => (
                          <label key={eid}>
                            <input
                              type="checkbox"
                              checked={layout.entities?.includes(eid) ?? false}
                              onChange={(e) => {
                                const current = layout.entities ?? [];
                                const next = e.target.checked
                                  ? [...current, eid]
                                  : current.filter((x) => x !== eid);
                                setLayout(id, { entities: next.length ? next : undefined });
                              }}
                            />
                            {displayName(eid)}
                          </label>
                        ))}
                      </fieldset>
                    ))}
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn--ghost" onClick={addLayout}>
            Add layout
          </button>
        </section>
      )}
    </div>
  );
}
