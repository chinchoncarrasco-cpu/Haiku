// ========================================
// HAIKU · RESUMEN RÁPIDO · TOUCH V1
// Una vez abierto por pulsación sostenida, permite mover el dedo
// sin cerrar el panel. Se sigue cerrando al levantar/cancelar.
// ========================================
(() => {
    "use strict";

    let pointerActivo = null;

    function hayResumenAbierto() {
        return Boolean(
            document.querySelector(
                ".tarjeta-resumen-rapido.tarjeta-resumen-rapido-activa"
            )
        );
    }

    document.addEventListener(
        "pointerdown",
        evento => {
            const tarjeta = evento.target.closest?.(
                ".tarjeta-resumen-rapido"
            );

            if (!tarjeta) return;
            pointerActivo = evento.pointerId;
        },
        true
    );

    // El código legacy cierra el resumen al mover más de 14 px.
    // Cuando el panel YA está abierto, bloqueamos únicamente ese
    // pointermove para permitir apartar el dedo sin perder la vista.
    document.addEventListener(
        "pointermove",
        evento => {
            if (
                pointerActivo === null ||
                evento.pointerId !== pointerActivo ||
                !hayResumenAbierto()
            ) {
                return;
            }

            if (evento.cancelable) {
                evento.preventDefault();
            }

            evento.stopImmediatePropagation();
        },
        { capture: true, passive: false }
    );

    // En móvil, después de una pulsación sostenida evitamos que el
    // navegador convierta el desplazamiento posterior en scroll y
    // dispare pointercancel. Antes de que abra, el scroll sigue normal.
    document.addEventListener(
        "touchmove",
        evento => {
            if (!hayResumenAbierto()) return;

            if (evento.cancelable) {
                evento.preventDefault();
            }
        },
        { capture: true, passive: false }
    );

    document.addEventListener(
        "pointerup",
        evento => {
            if (evento.pointerId === pointerActivo) {
                pointerActivo = null;
            }
        },
        true
    );

    document.addEventListener(
        "pointercancel",
        evento => {
            if (evento.pointerId === pointerActivo) {
                pointerActivo = null;
            }
        },
        true
    );

    window.addEventListener("blur", () => {
        pointerActivo = null;
    });

    console.info(
        "HAIKU · Resumen rápido Touch V1 preparado."
    );
})();
