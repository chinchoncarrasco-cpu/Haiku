(() => {
  "use strict";

  const MEDIA_PC = "(hover: hover) and (pointer: fine)";
  const FONDO_LOCAL = new URL("./assets/img/resumen-fondo.jpg", window.location.href).href;
  let ultimoResumen = null;
  let rafPendiente = 0;

  function esEscritorio() {
    return window.matchMedia(MEDIA_PC).matches;
  }

  function limpiar(resumen) {
    if (!resumen) return;
    resumen.style.removeProperty("background-image");
    resumen.style.removeProperty("background-size");
    resumen.style.removeProperty("background-position");
    resumen.style.removeProperty("background-repeat");
    resumen.style.removeProperty("background-attachment");
    resumen.style.removeProperty("background-color");
    resumen.removeAttribute("data-haiku-resumen-fondo");
  }

  function aplicar() {
    const resumen = document.getElementById("seccion-resumen");
    if (!resumen) return false;

    if (ultimoResumen && ultimoResumen !== resumen) {
      limpiar(ultimoResumen);
    }
    ultimoResumen = resumen;

    if (!esEscritorio()) {
      limpiar(resumen);
      return false;
    }

    const fondo = `linear-gradient(rgba(246,248,246,.58), rgba(246,248,246,.58)), url("${FONDO_LOCAL}")`;

    resumen.style.setProperty("background-image", fondo, "important");
    resumen.style.setProperty("background-size", "cover", "important");
    resumen.style.setProperty("background-position", "center top", "important");
    resumen.style.setProperty("background-repeat", "no-repeat", "important");
    resumen.style.setProperty("background-attachment", "fixed", "important");
    resumen.style.setProperty("background-color", "transparent", "important");
    resumen.setAttribute("data-haiku-resumen-fondo", "activo");

    return true;
  }

  function programarAplicacion() {
    if (rafPendiente) return;
    rafPendiente = requestAnimationFrame(() => {
      rafPendiente = 0;
      aplicar();
    });
  }

  const observer = new MutationObserver((mutaciones) => {
    for (const mutacion of mutaciones) {
      if (mutacion.type !== "childList") continue;
      if (mutacion.addedNodes.length || mutacion.removedNodes.length) {
        programarAplicacion();
        break;
      }
    }
  });

  function iniciar() {
    aplicar();

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    window.addEventListener("resize", programarAplicacion, { passive: true });
    window.addEventListener("popstate", programarAplicacion, { passive: true });
    window.addEventListener("haiku:auth-ready", programarAplicacion);
    document.addEventListener("click", (evento) => {
      if (evento.target.closest('[data-seccion="resumen"]')) {
        setTimeout(programarAplicacion, 0);
      }
    });

    setTimeout(aplicar, 100);
    setTimeout(aplicar, 500);
    setTimeout(aplicar, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }

  window.HAIKU_RESUMEN_FONDO_V1 = Object.freeze({
    aplicar,
    fondo: FONDO_LOCAL,
    esEscritorio
  });
})();
