import { APP_VERSION } from "./version.js";

document.querySelectorAll("[data-app-version]").forEach(element => {
  element.textContent = `Version ${APP_VERSION} · Aug 2026`;
});
