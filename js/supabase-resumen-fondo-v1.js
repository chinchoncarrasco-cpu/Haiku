(() => {
  "use strict";

  function aplicar() {
    const resumen = document.getElementById("seccion-resumen");
    if (!resumen) return;

    const escritorio = window.matchMedia("(min-width: 901px)").matches;

    if (!escritorio) {
      resumen.style.removeProperty("background-image");
      resumen.style.removeProperty("background-size");
      resumen.style.removeProperty("background-position");
      resumen.style.removeProperty("background-repeat");
      resumen.style.removeProperty("background-attachment");
      resumen.style.removeProperty("background-color");
      return;
    }

    resumen.style.setProperty(
      "background-image",
      'linear-gradient(rgba(246,248,246,.60), rgba(246,248,246,.60)), url("https://raw.githubusercontent.com/chinchoncarrasco-cpu/Haiku/main/assets/img/resumen-fondo.jpg")',
      "important"
    );
    resumen.style.setProperty("background-size", "cover", "important");
    resumen.style.setProperty("background-position", "center center", "important");
    resumen.style.setProperty("background-repeat", "no-repeat", "important");
    resumen.style.setProperty("background-attachment", "fixed", "important");
    resumen.style.setProperty("background-color", "transparent", "important");
  }

  aplicar();
  window.addEventListener("resize", aplicar, { passive: true });
  window.addEventListener("haiku:auth-ready", aplicar);
  setTimeout(aplicar, 150);
  setTimeout(aplicar, 600);

  window.HAIKU_RESUMEN_FONDO_V1 = Object.freeze({ aplicar });
})();
