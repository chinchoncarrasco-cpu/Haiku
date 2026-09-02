// =====================================================
// HAIKU · FOTOGRAFÍAS CABAÑAS / REVISIÓN · V1
// Sólo identifica qué cabaña está abierta.
// No modifica datos, reservas, checklist ni Supabase.
// =====================================================

(() => {
    "use strict";

    const CABANAS_CON_FOTO = new Set([
        "1", "2", "3", "4", "6"
    ]);

    function obtenerRevision() {
        return document.getElementById("revision-individual");
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

    // Captura el clic antes de abrir la revisión para que la foto
    // esté identificada desde el primer render visual.
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

            if (evento.target.closest("#volver-cabanas")) {
                limpiar();
            }
        },
        true
    );

    // Si por alguna razón la revisión ya estaba abierta al cargar,
    // recupera únicamente el número recordado por la UI existente.
    const revisionInicial = obtenerRevision();
    const numeroInicial = localStorage.getItem("haikuRevisionCabana");

    if (
        revisionInicial?.classList.contains("activa") &&
        numeroInicial
    ) {
        aplicar(numeroInicial);
    }

    window.HAIKU_CABANAS_FOTOS_V1 = {
        aplicar,
        limpiar,
        cabanas: [...CABANAS_CON_FOTO]
    };
})();
