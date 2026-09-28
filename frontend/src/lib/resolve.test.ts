import { describe, expect, it } from "vitest";
import type { HassEntity, VisioConfig } from "../types";
import { discoverEntities, missingFromLayout, pickLayout, resolveTiles, withDefaults } from "./resolve";

const entity = (id: string, name?: string): HassEntity => ({
  entity_id: id,
  state: "idle",
  attributes: name ? { friendly_name: name } : {},
  last_changed: "",
  last_updated: "",
});

const states = {
  "camera.b": entity("camera.b", "Bravo"),
  "camera.a": entity("camera.a", "Alpha"),
  "camera.c": entity("camera.c"),
  "light.x": entity("light.x", "Light"),
  "cover.blind": entity("cover.blind", "Aardvark blind"),
};

const config = (entities: VisioConfig["entities"] = {}): VisioConfig => ({
  entities,
  layouts: { default: { columns: 3 }, tv: { name: "TV", entities: ["camera.c", "camera.a", "camera.gone"] } },
});

describe("discoverEntities", () => {
  it("only returns supported domains", () => {
    expect(discoverEntities(states).sort()).toEqual(["camera.a", "camera.b", "camera.c", "cover.blind"]);
  });
});

describe("withDefaults", () => {
  it("applies camera defaults and lets the profile override", () => {
    expect(withDefaults("camera.a", { interval: 60 })).toEqual({ mode: "snapshot", interval: 60, fallback: "snapshot" });
  });
  it("defaults streaming-capable cameras to live", () => {
    const streaming = { ...entity("camera.s"), attributes: { supported_features: 2 } };
    expect(withDefaults("camera.s", undefined, streaming).mode).toBe("live");
    expect(withDefaults("camera.s", { mode: "snapshot" }, streaming).mode).toBe("snapshot");
    expect(withDefaults("camera.a", undefined, entity("camera.a")).mode).toBe("snapshot");
  });
  it("adds nothing for other domains", () => {
    expect(withDefaults("switch.a", undefined)).toEqual({});
  });
});

describe("pickLayout", () => {
  it("returns the requested layout or the first one", () => {
    expect(pickLayout(config(), "tv")[0]).toBe("tv");
    expect(pickLayout(config(), "nope")[0]).toBe("default");
    expect(pickLayout(config(), null)[0]).toBe("default");
  });
});

describe("resolveTiles", () => {
  it("auto-discovers new cameras, sorted by order then name", () => {
    const cfg = config({ "camera.c": { order: -1 } });
    const tiles = resolveTiles(states, cfg, cfg.layouts.default);
    // Cameras section first even though the blind sorts first by name.
    expect(tiles.map((t) => t.entityId)).toEqual(["camera.c", "camera.a", "camera.b", "cover.blind"]);
  });

  it("uses profile name, then friendly name, then entity id", () => {
    const cfg = config({ "camera.a": { name: "Front" } });
    const names = Object.fromEntries(resolveTiles(states, cfg, cfg.layouts.default).map((t) => [t.entityId, t.name]));
    expect(names).toEqual({
      "camera.a": "Front",
      "camera.b": "Bravo",
      "camera.c": "camera.c",
      "cover.blind": "Aardvark blind",
    });
  });

  it("hides hidden entities unless asked", () => {
    const cfg = config({ "camera.b": { hidden: true } });
    expect(resolveTiles(states, cfg, cfg.layouts.default).map((t) => t.entityId)).not.toContain("camera.b");
    expect(resolveTiles(states, cfg, cfg.layouts.default, true).map((t) => t.entityId)).toContain("camera.b");
  });

  it("explicit layout lists keep order and skip missing entities", () => {
    const cfg = config({ "camera.a": { hidden: true } });
    const tiles = resolveTiles(states, cfg, cfg.layouts.tv);
    expect(tiles.map((t) => t.entityId)).toEqual(["camera.c", "camera.a"]);
  });
});

describe("missingFromLayout", () => {
  it("lists cameras left out of an explicit layout", () => {
    expect(missingFromLayout(states, config().layouts.tv)).toEqual(["camera.b", "cover.blind"]);
  });
  it("is empty for automatic layouts", () => {
    expect(missingFromLayout(states, config().layouts.default)).toEqual([]);
  });
});
