"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("Polling: Timeout, einmaliger Fehler, letzte Werte, Wiederkehr und Stop", async () => {
  const timers = new Map();
  const messages = [];
  const logs = [];
  let nextTimer = 0;
  let response = "success";
  let aborted = false;
  const sandbox = {
    module: { exports: {} }, URL, AbortController, Date,
    setTimeout: (fn, delay) => { timers.set(++nextTimer, { fn, delay }); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
    fetch: async (_url, { signal }) => {
      if (response === "timeout") return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => { aborted = true; reject(new Error("timeout")); });
      });
      if (response === "fail") throw new Error("offline");
      return { ok: true, json: async () => ({ pvPower: 1234 }) };
    },
    require: (name) => name === "node_helper" ? { create: (x) => x } :
      name === "logger" ? { info: (x) => logs.push(x), error: (x) => logs.push(x) } : require("../normalize")
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../node_helper"), "utf8"), sandbox);
  const helper = sandbox.module.exports;
  helper.sendSocketNotification = (type, value) => messages.push({ type, ...value });
  helper.start();
  helper.socketNotificationReceived("EVCC_CONFIG", { identifier: "test", config: { evccUrl: "http://localhost:7070", updateInterval: 5000, requestTimeout: 1200 } });
  await new Promise(setImmediate);
  assert.equal(messages[0].data.pv, 1234);
  async function tick() {
    assert.equal(timers.size, 1, "genau eine geplante Folgeabfrage");
    const [id, timer] = [...timers][0];
    timers.delete(id);
    timer.fn();
    await new Promise(setImmediate);
  }
  response = "timeout";
  await tick();
  assert.equal(timers.size, 1, "während einer Anfrage nur Timeout, kein paralleler Poll");
  const [timeoutId, timeout] = [...timers][0];
  assert.equal(timeout.delay, 1200);
  timers.delete(timeoutId);
  timeout.fn();
  await new Promise(setImmediate);
  assert.equal(aborted, true);
  assert.equal(messages[1].unavailable, true);
  assert.equal(messages[1].data.pv, 1234);
  response = "fail";
  await tick();
  assert.equal(messages.length, 2);
  assert.equal(logs.length, 1);
  response = "success";
  await tick();
  assert.equal(messages[2].unavailable, false);
  assert.equal(logs.length, 2);
  helper.stop();
  assert.equal(timers.size, 0);
  assert.equal(helper.clients.size, 0);
});

test("Invalid URLs never fetch; translated configuration error is signaled", () => {
  let definition;
  const messages = [];
  vm.runInNewContext(fs.readFileSync(require.resolve("../node_helper"), "utf8"), {
    module: { exports: {} }, URL, clearTimeout() {},
    fetch() { assert.fail("Invalid URL must not be fetched"); },
    require: name => name === "node_helper" ? { create(value) { definition = value; return value; } } : name === "logger" ? { error() {} } : require("../normalize")
  });
  definition.start();
  definition.sendSocketNotification = (_type, payload) => messages.push(payload);
  for (const evccUrl of ["", "file:///example", "http://example.invalid/?query=1", "http://example.invalid/#fragment", "http://demo:example@example.invalid/"]) {
    definition.socketNotificationReceived("EVCC_CONFIG", { identifier: "invalid", config: { evccUrl } });
    assert.equal(messages.at(-1).configError, true);
  }
  definition.stop();
});
