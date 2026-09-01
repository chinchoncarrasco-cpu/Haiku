// ========================================
// HAIKU · SUPABASE · PAGOS GUARD V3
// Evita que eventos de edición de formularios Supabase
// lleguen a listeners legacy que vuelven a renderizar Pagos.
// ========================================

(() => {
    "use strict";

    const CAMPOS_EDITABLES = [
        ".pago-abono-monto",
        ".pago-abono-medio",
        "[data-pago-checkin-medio]",
        "[data-pago-checkin-folio]",
        "[data-pago-checkin-codaut]",
        "[data-pago-checkin-bove]",
        "[data-pago-checkin-manager]"
    ].join(",");

    function esCampoProtegido(target) {
        return target instanceof Element && Boolean(target.closest(CAMPOS_EDITABLES));
    }

    // Los valores ya fueron cambiados por el navegador antes de estos eventos.
    // Detenemos sólo la propagación hacia los listeners legacy de document.
    document.addEventListener("change", evento => {
        if (!window.haikuSesion || !esCampoProtegido(evento.target)) return;
        evento.stopPropagation();
        evento.stopImmediatePropagation();
    }, true);

    document.addEventListener("input", evento => {
        if (!window.haikuSesion || !esCampoProtegido(evento.target)) return;
        evento.stopPropagation();
        evento.stopImmediatePropagation();
    }, true);

    console.info("HAIKU · Guarda de formularios Pagos V3 preparada.");
})();
