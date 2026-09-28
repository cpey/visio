import { describe, expect, it } from "vitest";
import type { HassEntity } from "../types";
import { batteryLevel, findBatteryEntity } from "./battery";

const e = (id: string, state = "", attributes: Record<string, unknown> = {}): HassEntity => ({
  entity_id: id,
  state,
  attributes,
  last_changed: "",
  last_updated: "",
});

const states = {
  "camera.front": e("camera.front"),
  "sensor.front_battery": e("sensor.front_battery", "87.4", { device_class: "battery" }),
  "sensor.front_signal": e("sensor.front_signal", "-60", { device_class: "signal_strength" }),
  "sensor.other_battery": e("sensor.other_battery", "12", { device_class: "battery" }),
  "cover.blind": e("cover.blind"),
  "cover.shade": e("cover.shade"),
  "sensor.shade_battery": e("sensor.shade_battery", "45", { device_class: "battery" }),
};
const deviceOf = new Map([
  ["camera.front", "dev1"],
  ["sensor.front_battery", "dev1"],
  ["sensor.front_signal", "dev1"],
  ["sensor.other_battery", "dev2"],
  ["cover.blind", "dev3"],
]);

describe("findBatteryEntity", () => {
  it("finds the battery sensor on the same device", () => {
    expect(findBatteryEntity("camera.front", states, deviceOf)).toBe("sensor.front_battery");
  });
  it("falls back to sensor.<object_id>_battery for device-less sensors", () => {
    expect(findBatteryEntity("cover.shade", states, deviceOf)).toBe("sensor.shade_battery");
  });
  it("returns undefined when the device has none", () => {
    expect(findBatteryEntity("cover.blind", states, deviceOf)).toBeUndefined();
    expect(findBatteryEntity("camera.unknown", states, deviceOf)).toBeUndefined();
  });
});

describe("batteryLevel", () => {
  it("rounds numeric states and rejects others", () => {
    expect(batteryLevel(states["sensor.front_battery"])).toBe(87);
    expect(batteryLevel(e("sensor.x", "unavailable"))).toBeNull();
    expect(batteryLevel(undefined)).toBeNull();
  });
});
