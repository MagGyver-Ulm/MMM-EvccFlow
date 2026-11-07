"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { batteryLevel } = require("../colors");
class Element {
  constructor() { this.children = []; this.style = {}; this.attributes = {}; this.classList = { add() {} }; }
  appendChild(child) { this.children.push(child); }
  setAttribute(key, value) { this.attributes[key] = value; }
}
const all = root => [root, ...root.children.flatMap(all)];
function instance(language = "en", overrides = {}) {
  let mod;
  vm.runInNewContext(fs.readFileSync(require.resolve("../MMM-EvccFlow"), "utf8"), {
    Module: { register: (_name, value) => { mod = value; } }, config: { language },
    Intl, EvccFlowColors: require("../colors"),
    document: { createElement: () => new Element(), createElementNS: () => new Element() }
  });
  mod.config = { ...mod.defaults, ...overrides };
  mod.translate = key => require(`../translations/${language === "de" ? "de" : "en"}.json`)[key];
  mod.messages = [];
  mod.sendSocketNotification = (...args) => mod.messages.push(args);
  mod.identifier = "config-test";
  mod.start();
  return mod;
}
const state = () => ({ pv: 6000, grid: -500, home: 1000, battery: -1500, batterySoc: 60,
  loadpoints: [{ power: 3000, vehicleTitle: "Vehicle A", vehicleSoc: 45, mode: "pv" },
    { power: 0, vehicleTitle: "Vehicle B", vehicleSoc: 0, mode: "off" }] });
test("Missing URL stays local and shows a translated setup message", () => {
  for (const language of ["en", "de"]) {
    const mod = instance(language);
    assert.equal(mod.messages.length, 0);
    assert.equal(mod.getDom().textContent, mod.translate("MISSING_URL"));
  }
});
test("Decimal modes respect the language and preserve legacy precision", () => {
  assert.equal(instance("en").kw(1234), "1.2 kW");
  assert.equal(instance("de").kw(1234), "1,2 kW");
  assert.equal(instance("en", { decimal: "comma" }).kw(1234), "1,2 kW");
  assert.equal(instance("de", { decimal: "period" }).kw(1234), "1.2 kW");
  assert.equal(instance("en", { decimal: 2 }).kw(1234), "1,23 kW");
});
test("Visibility, limits, labels, SoC and charge mode independently configurable", () => {
  const mod = instance("en", { evccUrl: "http://localhost:7070", requestTimeout: 1200,
    showBattery: false, maxLoadpoints: 1, showVehicleSoc: false, showChargeMode: false,
    labels: { home: "Building", loadpoints: ["Charger"] } });
  assert.equal(mod.messages[0][1].config.requestTimeout, 1200);
  mod.evccState = state();
  let nodes = all(mod.getDom());
  assert.equal(nodes.filter(n => n.className?.startsWith("evcc-node")).length, 4);
  assert.ok(nodes.some(n => n.textContent === "Building"));
  assert.ok(nodes.some(n => n.textContent === "Charger"));
  assert.ok(!nodes.some(n => String(n.textContent).includes("Mode:")));
  assert.ok(!nodes.some(n => n.textContent === "45 %"));
  mod.config.showBattery = "auto";
  assert.equal(mod.batteryVisible(), true);
  mod.evccState.battery = null; mod.evccState.batterySoc = null;
  assert.equal(mod.batteryVisible(), false);
  mod.config.showBattery = true;
  assert.equal(mod.batteryVisible(), true);
  mod.config.showLoadpoints = false;
  nodes = all(mod.getDom());
  assert.equal(nodes.filter(n => n.className?.startsWith("evcc-node")).length, 4);
});
test("Custom source colors and custom SoC thresholds apply", () => {
  const mod = instance("en", { evccUrl: "http://localhost:7070", colors: { battery: "#123456" }, batterySocThresholds: { low: 40, high: 70 } });
  mod.evccState = state(); mod.evccState.battery = 1000;
  assert.ok(all(mod.getDom()).some(n => n.style.color === "#123456"));
  assert.equal(batteryLevel(30, mod.config.batterySocThresholds), "import");
  assert.equal(batteryLevel(60, mod.config.batterySocThresholds), "solar");
  assert.equal(batteryLevel(80, mod.config.batterySocThresholds), "export");
});
test("Translation dictionaries contain identical keys", () => {
  assert.deepEqual(Object.keys(require("../translations/de.json")).sort(), Object.keys(require("../translations/en.json")).sort());
});
