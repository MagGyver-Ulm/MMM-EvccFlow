"use strict";

const NodeHelper = require("node_helper");
const Log = require("logger");
const normalize = require("./normalize");

module.exports = NodeHelper.create({
  start() {
    this.clients = new Map();
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "EVCC_RENDERED" && payload && typeof payload.identifier === "string") {
      const client = this.clients.get(payload.identifier);
      if (client && !client.renderReported) {
        client.renderReported = true;
        Log.info("[MMM-EvccFlow] Live-Daten im Browser dargestellt.");
      }
      return;
    }
    if (notification !== "EVCC_CONFIG" || !payload || typeof payload.identifier !== "string") return;
    const { identifier } = payload;
    const config = payload.config || {};
    const previous = this.clients.get(identifier);
    if (previous) {
      clearTimeout(previous.timer);
      previous.controller?.abort();
    }
    const client = { identifier, failed: false, last: null };
    this.clients.set(identifier, client);
    try {
      const url = new URL(config.evccUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error("Ungültige URL");
      }
      url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/state`;
      client.url = url.toString();
      client.timeout = Number.isFinite(config.requestTimeout) ? Math.max(1, config.requestTimeout) : 5000;
      client.interval = Number.isFinite(config.updateInterval) ? Math.max(1000, config.updateInterval) : 5000;
      this.poll(client);
    } catch {
      Log.error("[MMM-EvccFlow] evccUrl prüfen: HTTP(S)-Basisadresse ohne Zugangsdaten erforderlich.");
      this.sendSocketNotification("EVCC_STATE", { identifier, data: null, unavailable: true, configError: true });
    }
  },

  async poll(client) {
    const started = Date.now();
    client.controller = new AbortController();
    const timeout = setTimeout(() => client.controller.abort(), client.timeout);
    try {
      const response = await fetch(client.url, { signal: client.controller.signal, redirect: "error" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = normalize(await response.json());
      if (this.clients.get(client.identifier) !== client) return;
      client.last = data;
      if (client.failed) Log.info("[MMM-EvccFlow] evcc wieder erreichbar.");
      client.failed = false;
      this.sendSocketNotification("EVCC_STATE", { identifier: client.identifier, data, unavailable: false });
    } catch {
      if (this.clients.get(client.identifier) !== client) return;
      if (!client.failed) {
        Log.error("[MMM-EvccFlow] evcc nicht erreichbar oder ungültige Antwort; letzter Stand bleibt sichtbar.");
        client.failed = true;
        this.sendSocketNotification("EVCC_STATE", { identifier: client.identifier, data: client.last, unavailable: true });
      }
    } finally {
      clearTimeout(timeout);
      if (this.clients.get(client.identifier) === client) {
        client.timer = setTimeout(() => this.poll(client), Math.max(0, client.interval - (Date.now() - started)));
      }
    }
  },

  stop() {
    for (const client of this.clients.values()) {
      clearTimeout(client.timer);
      client.controller?.abort();
    }
    this.clients.clear();
  }
});
