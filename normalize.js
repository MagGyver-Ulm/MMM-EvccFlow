"use strict";

const number = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const list = (value) => Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
const soc = (value) => number(value) !== null && value >= 0 && value <= 100 ? value : null;
function power(value) {
  const values = list(value).map((item) => number(item && item.power)).filter((v) => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
}
function batterySoc(value) {
  const batteries = list(value).filter((item) => item && soc(item.soc) !== null);
  if (!batteries.length) return null;
  const weighted = batteries.every((item) => number(item.capacity) !== null && item.capacity > 0);
  const total = batteries.reduce((sum, item) => sum + (weighted ? item.capacity : 1), 0);
  return batteries.reduce((sum, item) => sum + item.soc * (weighted ? item.capacity : 1), 0) / total;
}

module.exports = function normalize(payload) {
  const state = payload && (payload.result ?? payload);
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("Ungültiger evcc-Zustand");
  const result = {
    pv: number(state.pvPower) ?? power(state.pv),
    grid: number(state.gridPower) ?? power(state.grid),
    battery: number(state.batteryPower) ?? power(state.battery),
    batterySoc: soc(state.batterySoc) ?? batterySoc(state.battery),
    home: number(state.homePower) ?? power(state.home),
    loadpoints: list(state.loadpoints).map((point) => ({
      power: number(point.chargePower),
      charging: point.charging === true,
      vehicleTitle: typeof point.vehicleTitle === "string" ? point.vehicleTitle : "",
      vehicleSoc: soc(point.vehicleSoc),
      mode: typeof point.mode === "string" ? point.mode : ""
    }))
  };
  if ([result.pv, result.grid, result.battery, result.home].every((v) => v === null)) {
    throw new Error("Keine Leistungswerte im evcc-Zustand");
  }
  return result;
};
