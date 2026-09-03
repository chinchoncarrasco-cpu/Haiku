// =====================================================
// HAIKU · FOTOGRAFÍAS CABAÑAS / REVISIÓN · V1
// Capa visual: identifica la cabaña abierta en las
// revisiones de Cabañas y Aseo. El CSS vive en archivos
// separados; este módulo sólo agrega la marca data-*.
// No modifica datos, reservas, checklist ni Supabase.
// =====================================================

(() => {
    "use strict";

    const CABANAS_CON_FOTO = new Set([
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"
    ]);

    function obtenerRevision() {
        return document.getElementById("revision-individual");
    }

    function obtenerRevisionAseo() {
        return document.getElementById("aseo-express-individual");
    }

    function aplicar(numeroCabana) {
        const revision = obtenerRevision();

        if (!revision) {
            return false;
        }

        const numero = String(numeroCabana || "");

        if (CABANAS_CON_FOTO.has(numero)) {
            revision.dataset.fotoCabana = numero;
        } else {
            revision.removeAttribute("data-foto-cabana");
        }

        return true;
    }

    function limpiar() {
        const revision = obtenerRevision();

        if (!revision) {
            return false;
        }

        revision.removeAttribute("data-foto-cabana");
        return true;
    }

    function aplicarAseo(numeroCabana) {
        const revision = obtenerRevisionAseo();

        if (!revision) {
            return false;
        }

        const numero = String(numeroCabana || "");

        if (CABANAS_CON_FOTO.has(numero)) {
            revision.dataset.fotoCabana = numero;
        } else {
            revision.removeAttribute("data-foto-cabana");
        }

        return true;
    }

    function limpiarAseo() {
        const revision = obtenerRevisionAseo();

        if (!revision) {
            return false;
        }

        revision.removeAttribute("data-foto-cabana");
        return true;
    }

    document.addEventListener(
        "click",
        (evento) => {
            const tarjeta = evento.target.closest(
                ".cabana-revision[data-revision-cabana]"
            );

            if (tarjeta) {
                aplicar(tarjeta.dataset.revisionCabana);
                return;
            }

            const tarjetaAseo = evento.target.closest(
                ".aseo-resumen-cabana[data-aseo-express-cabana]"
            );

            if (tarjetaAseo) {
                aplicarAseo(tarjetaAseo.dataset.aseoExpressCabana);
                return;
            }

            if (evento.target.closest("#volver-aseo")) {
                limpiarAseo();
                return;
            }

            if (
                evento.target.closest("#volver-cabanas") ||
                evento.target.closest(".menu-item")
            ) {
                limpiar();
                limpiarAseo();
            }
        },
        true
    );

    const revisionInicial = obtenerRevision();
    const numeroInicial = localStorage.getItem("haikuRevisionCabana");

    if (
        revisionInicial?.classList.contains("activa") &&
        numeroInicial
    ) {
        aplicar(numeroInicial);
    }

    const revisionAseoInicial = obtenerRevisionAseo();
    const numeroAseoInicial = localStorage.getItem(
        "haikuAseoExpressCabana"
    );

    if (
        revisionAseoInicial?.classList.contains("activa") &&
        numeroAseoInicial
    ) {
        aplicarAseo(numeroAseoInicial);
    }

    window.HAIKU_CABANAS_FOTOS_V1 = {
        aplicar,
        limpiar,
        aplicarAseo,
        limpiarAseo,
        cabanas: [...CABANAS_CON_FOTO]
    };
})();
