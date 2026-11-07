/* global globalThis */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EvccFlowColors = factory();
})(globalThis, function () {
  "use strict";

  function active(power, threshold = 50) {
    const limit = Number.isFinite(threshold) ? Math.max(0, threshold) : 50;
    return Number.isFinite(power) && Math.abs(power) > limit;
  }

  function batteryLevel(soc, thresholds = {}) {
    if (!Number.isFinite(soc) || soc < 0 || soc > 100) return "idle";
    const low = Number.isFinite(thresholds.low) ? Math.max(0, Math.min(100, thresholds.low)) : 20;
    const high = Number.isFinite(thresholds.high) ? Math.max(low, Math.min(100, thresholds.high)) : Math.max(low, 50);
    return soc < low ? "import" : soc <= high ? "solar" : "export";
  }

  function flows(state, threshold = 50, thresholds = {}) {
    const importing = active(state.grid, threshold) && state.grid > 0;
    const discharging = active(state.battery, threshold) && state.battery > 0;
    const flow = (power, colorKey, positiveToHome = true) => ({
      active: active(power, threshold),
      direction: !active(power, threshold) ? "none" : (power > 0) === positiveToHome ? "toHome" : "fromHome",
      colorKey: active(power, threshold) ? colorKey : "idle"
    });
    return {
      solar: flow(state.pv, "solar"),
      grid: flow(state.grid, state.grid > 0 ? "import" : "export"),
      battery: flow(state.battery, state.battery > 0 ? "battery" : importing ? "import" : "solar"),
      loadpoints: state.loadpoints.map((point) => flow(point.power,
        point.power < 0 ? "export" : importing ? "import" : discharging ? "battery" : "solar", false)),
      batteryLevel: batteryLevel(state.batterySoc, thresholds)
    };
  }

  return { active, batteryLevel, flows };
});
