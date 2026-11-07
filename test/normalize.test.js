"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const normalize = require("../normalize");

test("Legacy-Wrapper erhält Vorzeichen, Nullwerte und unbekannten Fahrzeug-SoC", () => {
  assert.deepEqual(normalize({ result: { pvPower: 0, gridPower: 900, batteryPower: -200,
    batterySoc: 0, homePower: 700, loadpoints: [{ chargePower: 0, vehicleSoc: -1, mode: "off" }] } }), {
    pv: 0, grid: 900, battery: -200, batterySoc: 0, home: 700,
    loadpoints: [{ power: 0, charging: false, vehicleTitle: "", vehicleSoc: null, mode: "off" }]
  });
});
test("evcc 0.318.2: Gesamtbatterie nicht mit devices doppelt zählen", () => {
  const result = normalize({ pvPower: 1500, pv: [{ power: 1500 }], grid: { power: 0 },
    battery: { power: -500, soc: 40, capacity: 10, devices: [{ power: -500, soc: 40 }] },
    homePower: 1000, loadpoints: [{ chargePower: 0, charging: false, vehicleTitle: "", vehicleSoc: 0, mode: "off" }] });
  assert.equal(result.battery, -500);
  assert.equal(result.batterySoc, 40);
  assert.ok(Math.abs(result.pv + result.grid + result.battery - result.home) < 1);
});
test("Arrays summieren, SoC gewichten und mehrere Ladepunkte erhalten", () => {
  const result = normalize({ pv: [{ power: 1000 }, { power: 2000 }], grid: { power: -200 },
    battery: [{ power: -100, soc: 20, capacity: 5 }, { power: -300, soc: 80, capacity: 15 }],
    home: { power: 2400 }, loadpoints: [{ chargePower: 0, vehicleSoc: null },
      { chargePower: 11000, charging: true, vehicleTitle: "Vehicle B", vehicleSoc: 64, mode: "pv" }] });
  assert.equal(result.pv, 3000);
  assert.equal(result.battery, -400);
  assert.equal(result.batterySoc, 65);
  assert.equal(result.grid, -200);
  assert.equal(result.loadpoints.length, 2);
  assert.equal(result.loadpoints[0].vehicleSoc, null);
  assert.equal(result.loadpoints[1].charging, true);
});
test("Fehlende und ungültige Werte bleiben unbekannt", () => {
  const result = normalize({ pvPower: null, pv: [{ power: 50 }], gridPower: "0", batterySoc: 101,
    loadpoints: [{ vehicleSoc: "", chargePower: null }] });
  assert.equal(result.pv, 50);
  assert.equal(result.grid, null);
  assert.equal(result.batterySoc, null);
  assert.equal(result.loadpoints[0].vehicleSoc, null);
  for (const value of [null, {}, { result: {} }, [], { error: "nicht bereit" }]) {
    assert.throws(() => normalize(value));
  }
});
