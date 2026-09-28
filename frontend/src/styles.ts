// Injected into the panel's shadow root (and the standalone page, with :host → :root, body).
// Two themes: dark (Pantone navy, the :host defaults) and light (.theme--light overrides).
export const styles = `
:host {
  /* Dark theme: near-black with a faint blue glow. */
  --bg: #0a0d12;
  --bg-rgb: 10, 13, 18;
  --bg-glow: rgba(78, 161, 255, .06);
  --surface: rgba(255, 255, 255, .035);
  --surface-solid: #131820;
  --surface-2: rgba(255, 255, 255, .07);
  --surface-3: rgba(255, 255, 255, .11);
  --hairline: rgba(255, 255, 255, .08);
  --text: #eef2f7;
  --muted: #8994a5;
  --faint: #5c6675;
  --accent: #5aa9ff;
  --accent-soft: rgba(90, 169, 255, .14);
  --live: #ff5a5f;
  --motion: #ffb224;
  --radius: 18px;
  --radius-sm: 12px;
  --shadow: 0 10px 30px rgba(0, 0, 0, .35);
  --on-accent: #06121f;
  --media-bg: #05070a;
  --input-bg: rgba(0, 0, 0, .22);
  --glow-2: rgba(120, 140, 255, .04);
  display: block;
  min-height: 100%;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
* { box-sizing: border-box; }

/* Theme wrapper: carries the background so both themes paint the whole view. */
.theme {
  min-height: 100vh; color: var(--text);
  background:
    radial-gradient(1200px 600px at 10% -10%, var(--bg-glow), transparent 60%),
    radial-gradient(900px 500px at 110% 10%, var(--glow-2), transparent 60%),
    var(--bg);
}
.theme--light {
  --bg: #f3f6fb;
  --bg-rgb: 243, 246, 251;
  --bg-glow: rgba(31, 122, 224, .08);
  --glow-2: rgba(120, 140, 255, .06);
  --surface: #ffffff;
  --surface-solid: #ffffff;
  --surface-2: rgba(15, 35, 64, .06);
  --surface-3: rgba(15, 35, 64, .11);
  --hairline: rgba(15, 35, 64, .10);
  --text: #0f1b2d;
  --muted: #56667d;
  --faint: #8594a9;
  --accent: #1f7ae0;
  --accent-soft: rgba(31, 122, 224, .12);
  --live: #e5484d;
  --motion: #d98a00;
  --shadow: 0 8px 24px rgba(15, 35, 64, .10);
  --on-accent: #ffffff;
  --media-bg: #e4e9f1;
  --input-bg: #ffffff;
}
button { font: inherit; color: inherit; }
code { color: var(--muted); font-size: .85em; }

/* ---------- Layout shell ---------- */
.app-root { min-height: 100%; }
.view {
  display: flex; flex-direction: column; gap: 22px; min-height: 100%;
  padding: 0 max(20px, env(safe-area-inset-right)) max(28px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  max-width: 1800px; margin: 0 auto;
}
.header {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; gap: 12px;
  margin: 0 -20px; padding: calc(12px + env(safe-area-inset-top)) 20px 12px;
  background: linear-gradient(var(--bg) 20%, rgba(var(--bg-rgb), .72));
  backdrop-filter: saturate(160%) blur(14px); -webkit-backdrop-filter: saturate(160%) blur(14px);
  border-bottom: 1px solid var(--hairline);
}
.title { margin: 0; flex: 1; font-size: 1.25rem; font-weight: 650; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty { padding: 80px 16px; text-align: center; color: var(--muted); font-size: 1.1rem; }

/* ---------- Buttons ---------- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--accent); color: var(--on-accent); border: 0; border-radius: var(--radius-sm);
  padding: 10px 18px; font-weight: 600; cursor: pointer;
  transition: background .15s, transform .08s, opacity .15s;
}
.btn:hover:not(:disabled) { filter: brightness(1.08); }
.btn:active:not(:disabled) { transform: scale(.97); }
.btn:disabled { opacity: .45; cursor: default; }
.btn--ghost { background: var(--surface-2); color: var(--text); font-weight: 500; }
.btn--ghost:hover:not(:disabled) { background: var(--surface-3); filter: none; }

.icon-btn {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 42px; height: 42px; border-radius: 12px; border: 0; background: transparent;
  color: var(--muted); cursor: pointer; transition: background .15s, color .15s;
}
.icon-btn:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
.icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.icon-btn--menu { margin-left: -8px; color: var(--text); }
.icon-btn__dot { position: absolute; top: 9px; right: 9px; width: 8px; height: 8px; border-radius: 50%; background: var(--motion); box-shadow: 0 0 0 2px var(--bg); }
.icon-btn--spinning .refresh-icon, .pull--refreshing .refresh-icon { animation: visio-spin .8s linear infinite; }
@keyframes visio-spin { to { transform: rotate(360deg); } }

/* ---------- Side pane ---------- */
.drawer { position: fixed; inset: 0; z-index: 30; pointer-events: none; }
.drawer--open { pointer-events: auto; }
.drawer__backdrop { position: absolute; inset: 0; background: rgba(3, 5, 8, .6); opacity: 0; transition: opacity .25s; backdrop-filter: blur(2px); }
.drawer--open .drawer__backdrop { opacity: 1; }
.drawer__panel {
  position: absolute; top: 0; bottom: 0; left: 0; width: min(320px, 86vw);
  display: flex; flex-direction: column; gap: 18px;
  padding: calc(18px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
  background: var(--surface-solid); border-right: 1px solid var(--hairline); box-shadow: var(--shadow);
  transform: translateX(-102%); transition: transform .28s cubic-bezier(.2, .8, .2, 1); outline: none;
  overflow-y: auto;
}
.drawer--open .drawer__panel { transform: none; }
.drawer__head { display: flex; align-items: center; justify-content: space-between; padding-left: 6px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand__mark { display: grid; grid-template-columns: repeat(2, 9px); gap: 3px; }
.brand__mark i { width: 9px; height: 9px; border-radius: 3px; background: var(--surface-3); }
.brand__mark i:first-child { background: var(--accent); }
.brand__name { font-size: 1.2rem; font-weight: 700; letter-spacing: -.01em; }
.drawer__user { color: var(--muted); font-size: .9rem; padding: 0 8px; }
.drawer__notice { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: var(--radius-sm); background: rgba(255, 178, 36, .1); color: var(--motion); font-size: .88rem; }
.drawer__notice svg { flex: none; margin-top: 1px; }
.drawer__group { display: flex; flex-direction: column; gap: 2px; }
.drawer__group--end { margin-top: auto; border-top: 1px solid var(--hairline); padding-top: 12px; }
.drawer__label { color: var(--faint); font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; padding: 0 10px 6px; }
.drawer__item {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 12px;
  border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text);
  text-align: left; text-decoration: none; cursor: pointer; font-size: .98rem;
}
.drawer__item svg { color: var(--muted); }
.drawer__item:hover { background: var(--surface-2); }
.drawer__item--active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.drawer__item--active svg { color: var(--accent); }
.drawer__version { display: flex; align-items: center; gap: 8px; padding: 0 10px; color: var(--faint); font-size: .78rem; font-variant-numeric: tabular-nums; }
.drawer__version--dev { color: var(--motion); }
.segmented { display: flex; gap: 4px; padding: 4px; margin: 0 4px; border-radius: 12px; background: var(--surface-2); }
.segmented__option {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 8px 10px; border: 0; border-radius: 9px; background: transparent; color: var(--muted);
  font-weight: 550; cursor: pointer;
}
.segmented__option--active { background: var(--surface-solid); color: var(--text); box-shadow: 0 1px 4px rgba(0, 0, 0, .15); }

/* ---------- Sections & grid ---------- */
.section { display: flex; flex-direction: column; gap: 12px; }
.section__head { display: flex; align-items: center; gap: 12px 16px; min-height: 28px; flex-wrap: wrap; }
/* e.g. Blinds view with no schedules: nothing to show in the head row */
.section__head:empty { display: none; }
.mode-control { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.mode-control__hint { color: var(--muted); font-size: .85rem; font-variant-numeric: tabular-nums; }
.segmented--compact { margin: 0; padding: 3px; }
.segmented--compact .segmented__option { padding: 6px 12px; font-size: .88rem; }
@media (max-width: 700px) { .mode-control { margin-left: 0; width: 100%; justify-content: space-between; } }
.section__title { margin: 0; font-size: .78rem; font-weight: 650; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; }
.select-all { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: .88rem; cursor: pointer; }
.select-all input, .select-box { width: 20px; height: 20px; accent-color: var(--accent); cursor: pointer; }
.select-box { position: absolute; top: 18px; left: 16px; z-index: 1; margin: 0; }

.grid { display: grid; gap: 14px; }
.grid--controls { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
@media (max-width: 700px) { .grid { grid-template-columns: 1fr !important; gap: 12px; } }
.grid__cell { position: relative; cursor: pointer; border-radius: var(--radius); outline: none; }
.grid__cell--static { cursor: default; }
.grid__cell:focus-visible { box-shadow: 0 0 0 3px var(--accent); }
.grid__cell--selectable .control__head { padding-left: 32px; }
.grid__cell--selected .tile { border-color: rgba(90, 169, 255, .55); background: rgba(90, 169, 255, .06); }

/* ---------- Tiles ---------- */
.tile {
  position: relative; background: var(--surface); border-radius: var(--radius);
  overflow: hidden; border: 1px solid var(--hairline); aspect-ratio: 16 / 9;
  transition: border-color .2s, box-shadow .2s;
}
.grid__cell:not(.grid__cell--static):not(.grid__cell--focused):hover .tile { border-color: rgba(255, 255, 255, .16); box-shadow: var(--shadow); }
.tile--motion { border-color: var(--motion); box-shadow: 0 0 0 1px var(--motion), 0 0 24px rgba(255, 178, 36, .25); }
.tile--stale img { filter: grayscale(.85) brightness(.6); }
.tile__media { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--media-bg); }
.tile__media img, .tile__media video { width: 100%; height: 100%; object-fit: cover; }
.tile__bar {
  position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 8px;
  padding: 36px 14px 12px; background: linear-gradient(transparent, rgba(0, 0, 0, .78));
  color: #fff; /* camera overlay text stays white in both themes */
}
.tile__name { font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -.005em; }
.tile__status { color: rgba(238, 242, 247, .7); font-size: .82rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tile__empty { color: var(--muted); font-size: .95rem; }
.tile__placeholder { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--muted); padding: 16px; text-align: center; }
.tile__placeholder a { color: var(--accent); text-decoration: none; font-weight: 600; }

.badge { display: inline-flex; align-items: center; gap: 6px; font-size: .7rem; font-weight: 700; letter-spacing: .06em; padding: 3px 9px; border-radius: 999px; }
.badge--live { background: rgba(255, 90, 95, .92); color: #fff; }
.badge--live::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #fff; animation: visio-pulse 1.6s ease-in-out infinite; }
@keyframes visio-pulse { 50% { opacity: .25; } }
.badge--motion { background: var(--motion); color: #1a1200; }
.badge--stale { background: var(--surface-3); color: var(--text); }

/* Kept rendered (not display:none) so the browser decodes frames while the fallback shows. */
.live-host--hidden { position: absolute; inset: 0; opacity: 0; pointer-events: none; }

.grid__cell--focused {
  position: fixed; inset: 0; z-index: 25; background: rgba(3, 5, 8, .96); border-radius: 0; cursor: zoom-out;
  display: flex; align-items: center; justify-content: center;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}
.grid__cell--focused > * { width: min(100%, calc((100vh - 32px) * 16 / 9)); }
.grid__cell--focused .tile { width: 100%; border-color: transparent; }

/* ---------- Control tiles (blinds) ---------- */
.tile--control { aspect-ratio: auto; padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 14px; }
.tile--unavailable { opacity: .5; }
.control__head { display: flex; align-items: center; gap: 12px; min-height: 26px; }
.control__head .tile__status { color: var(--muted); }
.control__buttons { display: flex; gap: 8px; }
.control__buttons .btn { flex: 1; padding: 10px 0; background: var(--surface-2); color: var(--text); font-weight: 550; }
.control__buttons .btn:hover:not(:disabled) { background: var(--surface-3); filter: none; }
.control__slider { display: grid; grid-template-columns: 64px 1fr 44px; align-items: center; gap: 12px; color: var(--muted); font-size: .9rem; }
.control__slider input { width: 100%; accent-color: var(--accent); height: 28px; cursor: pointer; }
.control__value { text-align: right; font-variant-numeric: tabular-nums; color: var(--text); font-weight: 550; }

.blind-viz {
  position: relative; flex: none; width: 24px; height: 28px; border-radius: 4px;
  border: 1.5px solid var(--muted); overflow: hidden;
  background: linear-gradient(180deg, rgba(90, 169, 255, .28), rgba(90, 169, 255, .08));
}
/* Window cross */
.blind-viz__pane {
  position: absolute; inset: 0;
  background:
    linear-gradient(var(--muted), var(--muted)) center / 1.5px 100% no-repeat,
    linear-gradient(var(--muted), var(--muted)) center / 100% 1.5px no-repeat;
  opacity: .6;
}
.blind-viz__shade {
  position: absolute; left: 0; right: 0; top: 0;
  background: repeating-linear-gradient(#c9d2de 0 2px, #7d8898 2px 3.5px);
  border-bottom: 2px solid #eef2f7;
  transition: height .6s ease;
}
.blind-viz--moving { border-color: var(--accent); }

.group-control {
  background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--radius); padding: 14px 18px;
  display: grid; grid-template-columns: minmax(180px, auto) minmax(220px, 320px) minmax(220px, 1fr); align-items: center; gap: 18px;
}
@media (max-width: 800px) { .group-control { grid-template-columns: 1fr; gap: 12px; } }
.group-control__select { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.group-control__select .select-all { margin-left: 0; color: var(--text); font-weight: 600; }
.group-control__count { font-weight: 600; }
.group-control .control__buttons .btn { background: var(--accent); color: var(--on-accent); font-weight: 600; }
.group-control--idle .control__buttons .btn { background: var(--surface-2); color: var(--text); }
.group-control--idle .group-control__count { font-weight: 400; color: var(--muted); }
.group-control--idle .control__value { color: var(--muted); }

.battery { display: inline-flex; align-items: center; gap: 5px; font-size: .8rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.battery svg { width: 20px; height: 10px; }
.battery--low { color: var(--live); }

/* ---------- Pull to refresh ---------- */
.pull {
  position: fixed; top: env(safe-area-inset-top); left: 50%; z-index: 40; width: 44px; height: 44px; border-radius: 50%;
  background: var(--surface-solid); border: 1px solid var(--hairline); color: var(--muted); box-shadow: var(--shadow);
  display: flex; align-items: center; justify-content: center; pointer-events: none; transition: opacity .15s;
}
.pull--ready, .pull--refreshing { color: var(--accent); }

/* ---------- Settings ---------- */
.settings__msg { color: var(--muted); font-size: .88rem; white-space: nowrap; }
.hint { color: var(--muted); margin: 0; font-size: .88rem; }

.tabs {
  display: flex; gap: 4px; padding: 4px; align-self: flex-start; max-width: 100%; overflow-x: auto;
  background: var(--surface); border: 1px solid var(--hairline); border-radius: 14px;
}
.tabs__tab {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border: 0; border-radius: 10px;
  background: transparent; color: var(--muted); font-weight: 550; cursor: pointer; white-space: nowrap;
}
.tabs__tab:hover { color: var(--text); }
.tabs__tab--active { background: var(--surface-3); color: var(--text); }
.tabs__count { font-size: .75rem; color: var(--faint); background: var(--surface-2); border-radius: 999px; padding: 1px 7px; }
.tabs__tab--active .tabs__count { color: var(--text); }

.rows { display: flex; flex-direction: column; gap: 8px; max-width: 760px; width: 100%; }
.rows__title, .schedules__title { margin: 8px 0 0; font-size: .78rem; font-weight: 650; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; }

/* Blind schedules */
.schedules { display: flex; flex-direction: column; gap: 12px; max-width: 760px; width: 100%; }
.schedules__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.schedules__head .hint { margin-top: 4px; }
.schedules__paused { margin: 0; padding: 10px 12px; border-radius: var(--radius-sm); background: rgba(255, 178, 36, .12); color: var(--motion); font-size: .9rem; }
.schedule--off { opacity: .6; }
.schedule__top { display: flex; align-items: center; gap: 12px; }
.schedule__name {
  flex: 1; min-width: 0; font: inherit; font-weight: 600; font-size: 1.05rem; color: var(--text);
  background: transparent; border: 1px solid transparent; border-radius: 10px; padding: 6px 8px; margin-left: -8px;
}
.schedule__name:hover { border-color: var(--hairline); }
.schedule__name:focus { outline: none; border-color: var(--accent); background: var(--input-bg); }
.schedule__enabled { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: .9rem; cursor: pointer; }
.schedule__blinds { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  border: 1px solid var(--hairline); background: transparent; color: var(--muted); border-radius: 999px;
  padding: 6px 12px; font-size: .88rem; cursor: pointer;
}
.chip--on { background: var(--accent-soft); border-color: transparent; color: var(--accent); font-weight: 600; }
.week { display: grid; gap: 6px; }
.week__row { display: grid; grid-template-columns: minmax(90px, 140px) minmax(0, 150px) minmax(0, 150px); align-items: center; gap: 10px; }
.week__row--head span { color: var(--faint); font-size: .75rem; font-weight: 650; text-transform: uppercase; letter-spacing: .08em; }
.week__day { color: var(--text); font-size: .95rem; }
.week__time {
  width: 100%; min-width: 0; background: var(--input-bg); color: var(--text); border: 1px solid var(--hairline);
  border-radius: 10px; padding: 7px 9px; font: inherit; font-variant-numeric: tabular-nums; color-scheme: light dark;
}
.week__time:focus { outline: none; border-color: var(--accent); }
.schedule__shortcuts { display: flex; flex-wrap: wrap; gap: 8px; }
.system__when { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.system__when select, .system__when input { max-width: 180px; }
.system__actions { display: flex; gap: 8px; }
.system__kind { margin-left: 8px; vertical-align: middle; }
.row__head--static { cursor: default; }
.row__head--static:hover { background: transparent; }
.row__meta a { color: var(--accent); text-decoration: none; }
.system__run .card__title { font-weight: 600; }
.system__result { font-size: .9rem; color: var(--text); }
.system__result--failed { color: var(--live); }
.schedule__shortcuts .btn { padding: 7px 12px; font-size: .88rem; }
.schedule { grid-template-columns: minmax(0, 1fr); }
.week__day--short { display: none; }
@media (max-width: 640px) {
  .week__row { grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
  .week__time { padding: 7px 6px; font-size: .9rem; }
  .week__day--long { display: none; }
  .week__day--short { display: inline; }
  .schedule__top { flex-wrap: wrap; }
  .schedule__name { flex-basis: 100%; }
}
.row { background: var(--surface); border: 1px solid var(--hairline); border-radius: 14px; overflow: hidden; }
.row--open { border-color: rgba(90, 169, 255, .35); }
.row--missing { opacity: .55; }
.row__head {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px;
  border: 0; background: transparent; text-align: left; cursor: pointer;
}
.row__head:hover { background: var(--surface-2); }
.row__text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.row__name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row__meta { color: var(--muted); font-size: .85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row__chevron { width: 9px; height: 9px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(45deg); transition: transform .2s; margin-right: 4px; }
.row--open .row__chevron { transform: rotate(-135deg); }
.row__body { display: grid; gap: 12px; padding: 4px 16px 16px; border-top: 1px solid var(--hairline); padding-top: 14px; }
.row__id { justify-self: start; }

.field { display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 12px; }
.field--stack { grid-template-columns: 1fr; gap: 6px; }
.field__label { color: var(--muted); font-size: .92rem; }
@media (max-width: 640px) {
  .field { grid-template-columns: 1fr; gap: 6px; }
  .field--bool { grid-template-columns: 1fr auto; }
  .tabs { align-self: stretch; }
  .tabs__tab { flex: 1; justify-content: center; padding: 8px 10px; }
}
.field input:not([type=checkbox]), .field select {
  width: 100%; max-width: 360px; background: var(--input-bg); color: var(--text); border: 1px solid var(--hairline);
  border-radius: 10px; padding: 9px 11px; font: inherit;
}
.field input:focus, .field select:focus { outline: none; border-color: var(--accent); }

/* Toggle switch (styled checkbox) */
.switch {
  appearance: none; -webkit-appearance: none; justify-self: start; position: relative; margin: 0; cursor: pointer;
  width: 44px; height: 26px; border-radius: 999px; background: var(--surface-3); transition: background .2s;
}
.switch::after {
  content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
  background: #fff; transition: transform .2s; box-shadow: 0 1px 3px rgba(0, 0, 0, .3);
}
.switch:checked { background: var(--accent); }
.switch:checked::after { transform: translateX(18px); }
.switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.card { background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--radius); padding: 16px 18px; display: grid; gap: 14px; }
.card__title { display: flex; align-items: center; gap: 8px; font-weight: 600; justify-content: space-between; flex-wrap: wrap; }
.checklist-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.checklist { border: 1px solid var(--hairline); border-radius: var(--radius-sm); display: grid; align-content: start; gap: 8px; padding: 10px 14px 12px; margin: 0; }
.checklist legend { color: var(--faint); font-size: .75rem; font-weight: 650; text-transform: uppercase; letter-spacing: .08em; padding: 0 6px; }
.checklist label { display: flex; align-items: center; gap: 10px; color: var(--text); cursor: pointer; }
.checklist input { width: 18px; height: 18px; accent-color: var(--accent); }
`;
