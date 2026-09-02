(() => {
  "use strict";

  const ID_CAPA_V1 = "haiku-resumen-fondo-layer";
  const ID_CAPA_V2 = "haiku-resumen-fondo-fixed";
  const ID_IMG_V2 = "haiku-resumen-fondo-fixed-img";
  const MEDIA_PC = "(min-width: 901px)";

  function extraerFoto() {
    const capaV1 = document.getElementById(ID_CAPA_V1);
    if (!capaV1) return null;

    const valor = capaV1.style.backgroundImage || getComputedStyle(capaV1).backgroundImage || "";
    const match = valor.match(/url\(["']?(data:image\/jpeg;base64,[^"')]+)["']?\)/i);
    return match ? match[1] : null;
  }

  function resumenActivo() {
    const resumen = document.getElementById("seccion-resumen");
    return !!(resumen && resumen.classList.contains("activa"));
  }

  function asegurarCapa() {
    let capa = document.getElementById(ID_CAPA_V2);
    if (capa) return capa;

    capa = document.createElement("div");
    capa.id = ID_CAPA_V2;
    capa.setAttribute("aria-hidden", "true");

    const img = document.createElement("img");
    img.id = ID_IMG_V2;
    img.alt = "";
    img.setAttribute("aria-hidden", "true");

    capa.appendChild(img);
    document.body.appendChild(capa);

    capa.style.setProperty("position", "fixed", "important");
    capa.style.setProperty("top", "0", "important");
    capa.style.setProperty("right", "0", "important");
    capa.style.setProperty("bottom", "0", "important");
    capa.style.setProperty("left", "240px", "important");
    capa.style.setProperty("z-index", "0", "important");
    capa.style.setProperty("pointer-events", "none", "important");
    capa.style.setProperty("overflow", "hidden", "important");
    capa.style.setProperty("background", "rgba(246,248,246,.54)", "important");

    img.style.setProperty("position", "absolute", "important");
    img.style.setProperty("inset", "0", "important");
    img.style.setProperty("width", "100%", "important");
    img.style.setProperty("height", "100%", "important");
    img.style.setProperty("object-fit", "cover", "important");
    img.style.setProperty("object-position", "center center", "important");
    img.style.setProperty("opacity", ".42", "important");
    img.style.setProperty("filter", "saturate(.9)", "important");

    return capa;
  }

  function prepararContenido() {
    const contenido = document.querySelector(".contenido");
    if (!contenido) return;

    contenido.style.setProperty("position", "relative", "important");
    contenido.style.setProperty("z-index", "1", "important");
    contenido.style.setProperty("background", "transparent", "important");
  }

  function aplicar() {
    const escritorio = window.matchMedia(MEDIA_PC).matches;
    const capa = asegurarCapa();
    const img = capa.querySelector(`#${ID_IMG_V2}`);

    const mostrar = escritorio && resumenActivo();
    capa.style.setProperty("display", mostrar ? "block" : "none", "important");

    if (!mostrar) return false;

    prepararContenido();

    if (!img.src || !img.src.startsWith("data:image/jpeg;base64,")) {
      window.HAIKU_RESUMEN_FONDO_V1?.aplicar?.();
      const foto = extraerFoto();
      if (foto) img.src = foto;
    }

    return !!img.src;
  }

  const observer = new MutationObserver(() => {
    requestAnimationFrame(aplicar);
  });

  function iniciar() {
    aplicar();

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"]
    });

    window.addEventListener("resize", aplicar, { passive: true });
    document.addEventListener("click", () => setTimeout(aplicar, 0));
    setTimeout(aplicar, 150);
    setTimeout(aplicar, 700);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }

  window.HAIKU_RESUMEN_FONDO_V2 = Object.freeze({ aplicar });
})();
