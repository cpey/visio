// Entry point: defines <visio-panel>, the web component Home Assistant mounts.
// HA sets the `hass` property on every state change; we re-render React with it.

import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import { styles } from "./styles";
import type { Hass } from "./types";

class VisioPanel extends HTMLElement {
  private root: Root | null = null;
  private mount: HTMLDivElement | null = null;
  private _hass: Hass | null = null;

  // Also set by HA; unused for now.
  narrow = false;
  route: unknown;
  panel: unknown;

  set hass(hass: Hass) {
    this._hass = hass;
    this.render();
  }

  get hass(): Hass | null {
    return this._hass;
  }

  connectedCallback() {
    if (!this.mount) {
      const shadow = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = styles;
      this.mount = document.createElement("div");
      this.mount.style.height = "100%";
      shadow.append(style, this.mount);
    }
    this.root ??= createRoot(this.mount);
    this.render();
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }

  private render() {
    if (this.root && this._hass) this.root.render(<App hass={this._hass} />);
  }
}

if (!customElements.get("visio-panel")) {
  customElements.define("visio-panel", VisioPanel);
}
