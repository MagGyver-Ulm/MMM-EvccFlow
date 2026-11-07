(async () => {
  const mod = window.demoModule;
  const translations = await fetch("../translations/en.json").then(response => response.json());
  mod.config = { ...mod.defaults, evccUrl: "http://example.invalid:7070" };
  mod.translate = key => translations[key];
  mod.identifier = "synthetic-demo";
  mod.sendSocketNotification = () => {};
  mod.start();
  mod.evccState = {
    pv: 6500, grid: -500, home: 1200, battery: -1800, batterySoc: 65,
    loadpoints: [{ power: 3000, vehicleTitle: "Vehicle A", vehicleSoc: 48, mode: "pv" }]
  };
  document.getElementById("preview").appendChild(mod.getDom());
  window.demoReady = true;
})();
