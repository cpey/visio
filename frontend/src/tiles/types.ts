import type { ComponentType } from "react";
import type { EntityProfile, Hass, VisioConfig } from "../types";
import type { ResolvedTile } from "../lib/resolve";

export type { Hass };
export type ResolvedTileLike = ResolvedTile;

export interface TileProps {
  hass: Hass;
  tile: ResolvedTile;
  /** Rendered full screen. */
  large?: boolean;
}

export type TileComponent = ComponentType<TileProps>;

export interface FieldSpec {
  key: keyof EntityProfile;
  label: string;
  kind: "text" | "number" | "bool" | "select" | "entity" | "url";
  options?: readonly string[];
  /** Display labels for select options (value → label). */
  optionLabels?: Record<string, string>;
  min?: number;
  max?: number;
  /** For kind "entity": restrict the picker to this domain. */
  domain?: string;
  /** Only show this field when the predicate holds for the current profile. */
  when?: (profile: EntityProfile) => boolean;
}

export interface TileDefinition {
  component: TileComponent;
  /** Click opens it full screen (cameras); controls (covers, switches) don't. */
  expandable: boolean;
}

export interface GroupControlProps {
  hass: Hass;
  /** Selected entities of this domain; empty = show the control disabled. */
  entityIds: string[];
  /** "Select all" state for this section, rendered inside the control. */
  selectAll: { checked: boolean; indeterminate: boolean; onChange(checked: boolean): void };
}

export interface DomainDefinition {
  /** Section title in the grid, e.g. "Cameras". */
  title: string;
  /** Settings fields specific to this domain (name/order/hidden are common). */
  fields: FieldSpec[];
  /** Tile type used for an entity of this domain, unless the profile overrides `tile`. */
  pickTile(profile: EntityProfile): string;
  /** One-line summary of a profile for the collapsed settings row, e.g. "Live video · 5 s". */
  summary?(profile: EntityProfile): string[];
  /** Optional control acting on several selected entities at once; enables selection. */
  groupControl?: ComponentType<GroupControlProps>;
  /** Optional control in the grid section header (e.g. blinds Automatic/Manual). */
  sectionControl?: ComponentType<SectionControlProps>;
  /** Optional extra block at the top of this domain's Settings tab (e.g. schedules). */
  settingsSection?: ComponentType<SettingsSectionProps>;
}

export interface SectionControlProps {
  hass: Hass;
  config: VisioConfig;
  /** Apply a config returned by the server. */
  onConfig(config: VisioConfig): void;
}

export interface SettingsSectionProps {
  hass: Hass;
  draft: VisioConfig;
  setDraft(update: (draft: VisioConfig) => VisioConfig): void;
  /** Entities of this domain known to Home Assistant. */
  entityIds: string[];
}
