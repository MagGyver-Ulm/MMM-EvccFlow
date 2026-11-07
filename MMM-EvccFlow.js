/* global Module, EvccFlowColors */
Module.register("MMM-EvccFlow", {
  defaults: {
    evccUrl: "", // Required HTTP(S) base URL
    requestTimeout: 5000, // Milliseconds
    updateInterval: 5000, // Millisekunden, mindestens 1000
    flowThreshold: 50, // Watt: bis einschließlich Schwelle kein aktiver Pfeil
    showBattery: "auto",
    maxLoadpoints: 0, // Zero means unlimited
    showVehicleSoc: true,
    showChargeMode: true,
    batterySocThresholds: { low: 20, high: 50 },
    labels: {},
    showLoadpoints: true, // Ein Auto je Ladepunkt
    animate: false, // Optionales langsames Pulsieren der Pfeilspitzen
    decimal: "auto", // auto, comma, period; legacy integers 0–3 remain supported
    colors: { solar: "#f2c230", import: "#e5534b", export: "#4cc06a", battery: "#4cc06a", idle: "#666666" }
  },

  getTranslations() { return { en: "translations/en.json", de: "translations/de.json" }; },
  label(key) { return this.config.labels?.[key] || this.translate(key.toUpperCase()); },
  batteryVisible() { return this.config.showBattery === true || (this.config.showBattery !== false && (Number.isFinite(this.evccState?.battery) || Number.isFinite(this.evccState?.batterySoc))); },
  visibleLoadpoints() {
    const points = this.config.showLoadpoints ? this.evccState.loadpoints : [];
    const limit = this.config.maxLoadpoints;
    return Number.isInteger(limit) && limit > 0 ? points.slice(0, limit) : points;
  },

  getScripts() { return ["colors.js"]; },
  getStyles() { return ["MMM-EvccFlow.css"]; },

  start() {
    this.evccState = null;
    this.unavailable = false;
    this.renderReported = false;
    this.previousView = "";
    const digits = Number.isInteger(this.config.decimal) ? Math.max(0, Math.min(3, this.config.decimal)) : 1;
    const language = typeof config !== "undefined" ? config.language : "en";
    const locale = this.config.decimal === "comma" || Number.isInteger(this.config.decimal) ? "de-DE" : this.config.decimal === "period" ? "en-US" : language || "en";
    this.format = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (!this.config.evccUrl?.trim()) return;
    this.sendSocketNotification("EVCC_CONFIG", { identifier: this.identifier, config: {
      evccUrl: this.config.evccUrl, updateInterval: this.config.updateInterval, requestTimeout: this.config.requestTimeout
    } });
  },

  socketNotificationReceived(notification, payload) {
    if (notification !== "EVCC_STATE" || payload.identifier !== this.identifier) return;
    this.evccState = payload.data;
    this.unavailable = payload.unavailable;
    this.configError = payload.configError;
    // Keine DOM-Arbeit, wenn sich auch die sichtbaren Werte nicht geändert haben.
    const view = this.viewKey();
    if (view !== this.previousView) {
      this.previousView = view;
      this.updateDom(0);
    }
  },

  active(power) {
    return EvccFlowColors.active(power, this.config.flowThreshold);
  },
  kw(power) { return Number.isFinite(power) ? `${this.format.format(Math.abs(power) / 1000)} kW` : "– kW"; },
  percent(value) { return Number.isFinite(value) ? `${Math.round(value)} %` : ""; },
  direction(kind, value) {
    if (!Number.isFinite(value)) return this.translate("NO_DATA");
    if (!this.active(value)) return this.translate("IDLE");
    return this.translate(kind === "grid" ? (value > 0 ? "IMPORT" : "EXPORT") : (value > 0 ? "DISCHARGING" : "CHARGING"));
  },
  viewKey() {
    if (!this.evccState) return JSON.stringify([this.unavailable, this.configError]);
    const d = this.evccState;
    return JSON.stringify([this.unavailable, ...[d.pv, d.grid, d.battery, d.home].map((p) => [this.kw(p), this.active(p), Math.sign(p)]),
      this.percent(d.batterySoc), EvccFlowColors.flows(d, this.config.flowThreshold, this.config.batterySocThresholds), this.config.showLoadpoints ? this.visibleLoadpoints().map((p) => [this.kw(p.power), this.active(p.power), Math.sign(p.power), p.vehicleTitle, this.percent(p.vehicleSoc), p.mode, p.charging]) : []]);
  },

  getDom() {
    const root = document.createElement("div");
    root.className = "evcc-flow";
    if (!this.config.evccUrl?.trim() || !this.evccState) {
      root.classList.add("small", "dimmed");
      root.textContent = this.translate(!this.config.evccUrl?.trim() ? "MISSING_URL" : this.configError ? "INVALID_URL" : this.unavailable ? "UNAVAILABLE" : "WAITING");
      return root;
    }
    const d = this.evccState;
    const flows = EvccFlowColors.flows(d, this.config.flowThreshold, this.config.batterySocThresholds);
    const palette = { ...this.defaults.colors, ...this.config.colors };
    if (this.config.colors?.battery === undefined) palette.battery = palette.export;
    const cars = this.visibleLoadpoints();
    const height = 235 + Math.ceil(cars.length / 3) * 120;
    const diagram = document.createElement("div");
    diagram.className = `evcc-diagram${this.unavailable ? " evcc-stale" : ""}${this.config.animate && !this.unavailable ? " evcc-animate" : ""}`;
    diagram.style.height = `${height}px`;
    root.appendChild(diagram);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 500 ${height}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    diagram.appendChild(svg);
    const line = (x1, y1, x2, y2, flow) => {
      const active = flow.active;
      if (flow.direction === "fromHome") [x1, y1, x2, y2] = [x2, y2, x1, y1];
      const group = document.createElementNS(ns, "g");
      group.setAttribute("class", active ? "evcc-line evcc-active" : "evcc-line");
      group.style.stroke = palette[flow.colorKey];
      // Bei Fluss nur eine Pfeilspitze, sonst eine ruhende Verbindungslinie.
      if (active) {
        const arrow = document.createElementNS(ns, "path");
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        arrow.setAttribute("d", "M -6.5 -9 L 6.5 0 L -6.5 9");
        arrow.setAttribute("transform", `translate(${(x1 + x2) / 2} ${(y1 + y2) / 2}) rotate(${angle})`);
        arrow.setAttribute("class", "evcc-arrow");
        group.appendChild(arrow);
      } else {
        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
        group.appendChild(path);
      }
      svg.appendChild(group);
    };
    const node = (title, icon, power, x, y, detail = "", battery = false, flow = null) => {
      const el = document.createElement("div");
      el.className = `evcc-node${this.active(power) ? " evcc-active" : ""}`;
      el.style.left = `${x / 5}%`;
      el.style.top = `${y}px`;
      const symbol = document.createElement("i");
      symbol.className = `fas fa-${icon} evcc-icon`;
      symbol.setAttribute("aria-hidden", "true");
      el.appendChild(symbol);
      for (const [className, text] of [["evcc-title", title], ["evcc-power", this.kw(power)], ["evcc-detail", detail]]) {
        const child = document.createElement("div");
        child.className = className;
        child.textContent = text;
        if (className === "evcc-power" && flow) {
          child.style.color = palette[flow.colorKey];
          if (!flow.active) child.className += " evcc-idle";
        }
        el.appendChild(child);
      }
      if (battery && Number.isFinite(d.batterySoc)) {
        const bar = document.createElement("div");
        bar.className = "evcc-soc";
        bar.setAttribute("role", "meter");
        bar.setAttribute("aria-label", this.translate("BATTERY_SOC"));
        bar.setAttribute("aria-valuemin", "0");
        bar.setAttribute("aria-valuemax", "100");
        bar.setAttribute("aria-valuenow", String(Math.round(d.batterySoc)));
        const fill = document.createElement("span");
        fill.style.width = `${Math.round(d.batterySoc)}%`;
        fill.style.backgroundColor = palette[flows.batteryLevel];
        bar.appendChild(fill);
        el.appendChild(bar);
      }
      diagram.appendChild(el);
    };
    line(250, 90, 250, 106, flows.solar);
    line(142, 164, 183, 164, flows.grid);
    if (this.batteryVisible()) line(358, 164, 317, 164, flows.battery);
    node(this.label("solar"), "sun", d.pv, 250, 0, "", false, flows.solar);
    node(this.label("grid"), "plug", d.grid, 70, 120, this.direction("grid", d.grid), false, flows.grid);
    node(this.label("home"), "house", d.home, 250, 120);
    if (this.batteryVisible()) node(this.label("battery"), "battery-half", d.battery, 430, 120,
      [this.percent(d.batterySoc), this.direction("battery", d.battery)].filter(Boolean).join(" · "), true, flows.battery);
    const modes = Object.fromEntries(["off", "now", "minpv", "pv"].map(key => [key, this.translate(`MODE_${key.toUpperCase()}`)]));
    cars.forEach((point, index) => {
      const row = Math.floor(index / 3);
      const count = Math.min(3, cars.length - row * 3);
      const x = 500 * ((index % 3) + 0.5) / count;
      const y = 265 + row * 120;
      line(x, y - 8, 250, 215, flows.loadpoints[index]);
      node(this.config.labels?.loadpoints?.[index] || point.vehicleTitle || (cars.length === 1 ? this.label("vehicle") : `${this.label("vehicle")} ${index + 1}`), "car", point.power, x, y,
        [this.config.showVehicleSoc ? this.percent(point.vehicleSoc) : "", this.config.showChargeMode && point.mode ? `${this.translate("MODE")}: ${modes[point.mode] || point.mode}` : ""].filter(Boolean).join(" · "), false, flows.loadpoints[index]);
    });
    if (this.unavailable) {
      const warning = document.createElement("div");
      warning.className = "evcc-warning";
      warning.textContent = this.translate("UNAVAILABLE");
      root.appendChild(warning);
    }
    if (!this.renderReported && !this.unavailable) {
      this.renderReported = true;
      this.sendSocketNotification("EVCC_RENDERED", { identifier: this.identifier });
    }
    return root;
  }
});
