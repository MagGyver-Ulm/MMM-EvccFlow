"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.attributes = {}; this.classList = { add: () => {} }; }
  appendChild(child) { this.children.push(child); }
  setAttribute(key, value) { this.attributes[key] = value; }
}
function elements(root) { return [root, ...root.children.flatMap(elements)]; }
test("Darstellung: Komma, Richtung, SoC, mehrere Autos und Ausfall", () => {
  let module;
  vm.runInNewContext(fs.readFileSync(require.resolve("../MMM-EvccFlow"), "utf8"), {
    Module: { register: (_name, object) => { module = object; } }, Intl, config: { language: "de" }, EvccFlowColors: require("../colors"),
    document: { createElement: (tag) => new Element(tag), createElementNS: (_ns, tag) => new Element(tag) }
  });
  module.config = { ...module.defaults };
  module.config.evccUrl = "http://localhost:7070";
  module.translate = key => require("../translations/de.json")[key];
  module.sendSocketNotification = () => {};
  module.identifier = "test";
  const metadata = { position: "top_left", header: "Energiefluss" };
  module.data = metadata; // MagicMirror reserviert data für die Modulmetadaten.
  module.start();
  assert.equal(module.data, metadata);
  assert.equal(module.kw(0), "0,0 kW");
  assert.equal(module.kw(-1234), "1,2 kW");
  assert.equal(module.kw(null), "– kW");
  assert.equal(module.active(49), false);
  assert.equal(module.active(-50), false); // Paket 3: einschließlich Schwelle inaktiv.
  assert.equal(module.active(-51), true);
  assert.equal(module.direction("grid", -100), "Einspeisung");
  assert.equal(module.direction("battery", -100), "Laden");
  module.evccState = { pv: 1000, home: 700, grid: -100, battery: -200, batterySoc: 42,
    loadpoints: [{ power: 0, vehicleTitle: "Vehicle A", vehicleSoc: null, mode: "off" },
      { power: 0, vehicleTitle: "Vehicle B", vehicleSoc: 0, mode: "pv" }] };
  let all = elements(module.getDom());
  const nodes = all.filter(e => e.className?.startsWith("evcc-node"));
  assert.equal(nodes[0].children.find(e => e.className === "evcc-power").style.color, "#f2c230");
  assert.equal(nodes[1].children.find(e => e.className === "evcc-power").style.color, "#4cc06a");
  assert.equal(nodes[2].children.find(e => e.className === "evcc-power").style.color, undefined, "Haus bleibt weiß");
  assert.ok(nodes.every(e => !e.style.color), "Symbole und Titel erhalten keine Flussfarbe");
  assert.equal(all.find(e => e.attributes.role === "meter").children[0].style.backgroundColor, "#f2c230");
  module.config.colors = { solar: "#abcdef" };
  assert.equal(elements(module.getDom()).find(e => e.className === "evcc-power").style.color, "#abcdef");
  const beforeColorChange = module.viewKey();
  module.evccState.grid = 51; // kW-Rundung identisch, Flussfarbe der ladenden Batterie ändert sich.
  assert.notEqual(module.viewKey(), beforeColorChange);
  module.evccState.grid = -100;
  module.evccState.batterySoc = 50;
  const beforeSocChange = module.viewKey();
  module.evccState.batterySoc = 50.1; // Prozentanzeige unverändert, Balkenfarbe muss wechseln.
  assert.notEqual(module.viewKey(), beforeSocChange);
  assert.equal(all.filter(e => e.className?.startsWith("evcc-node")).length, 6);
  assert.ok(all.some(e => e.textContent === "0 % · Modus: PV"));
  assert.ok(all.some(e => e.attributes["aria-valuenow"] === "42"));
  assert.ok(!all.some(e => String(e.textContent).includes("null")));
  module.unavailable = true;
  all = elements(module.getDom());
  assert.ok(all.some(e => e.className?.includes("evcc-stale")));
  assert.ok(all.some(e => e.textContent === "evcc nicht erreichbar"));
  module.config.showLoadpoints = false;
  assert.equal(elements(module.getDom()).filter(e => e.className?.startsWith("evcc-node")).length, 4);
});
