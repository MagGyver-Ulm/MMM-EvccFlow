/* Demo harness only: never loads in MagicMirror². */
window.config = { language: "en" };
window.Module = { register(_name, definition) { window.demoModule = definition; } };
