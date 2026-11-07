"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { flows, batteryLevel } = require("../colors");

const state = (overrides = {}) => ({ pv: 0, grid: 0, battery: 0, batterySoc: 35,
  loadpoints: [{ power: 0 }], ...overrides });

for (const [name, input, connection, colorKey, direction] of [
  ["Solar liefert gelb", { pv: 1000 }, "solar", "solar", "toHome"],
  ["Netzbezug rot", { grid: 1000 }, "grid", "import", "toHome"],
  ["Einspeisung grün", { grid: -1000 }, "grid", "export", "fromHome"],
  ["Batterie entlädt grün", { battery: 1000, grid: 500 }, "battery", "battery", "toHome"],
  ["Batterie lädt bei Netzbezug rot", { battery: -1000, grid: 500 }, "battery", "import", "fromHome"],
  ["Batterie lädt ohne Netzbezug gelb", { battery: -1000, grid: 50 }, "battery", "solar", "fromHome"],
  ["Auto lädt bei Netzbezug rot vor Batterie", { loadpoints: [{ power: 1000 }], grid: 500, battery: 500 }, "car", "import", "fromHome"],
  ["Auto lädt aus Batterie grün", { loadpoints: [{ power: 1000 }], grid: 50, battery: 500 }, "car", "battery", "fromHome"],
  ["Auto lädt aus Solar gelb", { loadpoints: [{ power: 1000 }], battery: 50 }, "car", "solar", "fromHome"],
  ["Auto speist zurück grün", { loadpoints: [{ power: -1000 }] }, "car", "export", "toHome"]
]) {
  test(name, () => {
    const result = flows(state(input));
    assert.deepEqual(connection === "car" ? result.loadpoints[0] : result[connection], { active: true, direction, colorKey });
  });
}

test("Bis einschließlich Schwelle und fehlende Werte inaktiv, darüber aktiv", () => {
  for (const power of [0, 49, 50, -49, -50, null, undefined, NaN]) {
    const result = flows(state({ pv: power, grid: power, battery: power, loadpoints: [{ power }] }));
    for (const flow of [result.solar, result.grid, result.battery, ...result.loadpoints]) {
      assert.deepEqual(flow, { active: false, direction: "none", colorKey: "idle" });
    }
  }
  assert.equal(flows(state({ grid: 101 }), 100).grid.active, true);
  assert.equal(flows(state({ grid: 100 }), 100).grid.active, false);
});

test("Balkenfarbe: 10/35/80 Prozent und exakte Grenzen", () => {
  for (const [soc, key] of [[10, "import"], [19.9, "import"], [20, "solar"], [35, "solar"],
    [50, "solar"], [50.1, "export"], [80, "export"], [null, "idle"], [-1, "idle"]]) {
    assert.equal(batteryLevel(soc), key);
  }
});

test("Mehrere Ladepunkte unabhängig auswerten; Eingabe unverändert", () => {
  const input = state({ grid: 500, loadpoints: [{ power: 2000 }, { power: 0 }, { power: -1000 }] });
  const before = structuredClone(input);
  const result = flows(input);
  assert.deepEqual(result.loadpoints.map(p => p.colorKey), ["import", "idle", "export"]);
  assert.deepEqual(input, before);
});
