// ========================================
// HAIKU · SUPABASE · PAGOS GUARD V3
// Mantiene estable el formulario financiero mientras se edita.
// Supabase sigue siendo la verdad; este mapa es sólo borrador UI.
// ========================================

(() => {
    "use strict";

    const borradoresCheckin = new Map();
    let restaurando = false;

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

    function tarjetaCheckinDesde(target) {
        return target instanceof Element
            ? target.closest(".pago-checkin-item[data-reserva-id]")
            : null;
    }

    function leerBorrador(tarjeta) {
        if (!tarjeta?.dataset?.reservaId) return null;

        const medio = tarjeta.querySelector("[data-pago-checkin-medio]");
        const folio = tarjeta.querySelector("[data-pago-checkin-folio]");
        const codAut = tarjeta.querySelector("[data-pago-checkin-codaut]");
        const bove = tarjeta.querySelector("[data-pago-checkin-bove]");
        const manager = tarjeta.querySelector("[data-pago-checkin-manager]");

        // Si ya quedó pagado, no existe borrador que conservar.
        const estado = tarjeta.querySelector(".pago-checkin-estado")?.textContent || "";
        const completo = tarjeta.classList.contains("pago-checkin-completo") || /pagado/i.test(estado);
        if (completo) return null;

        return {
            medio: medio?.value || "",
            folio: folio?.value || "",
            codAut: codAut?.value || "",
            bove: bove?.value || "",
            manager: manager?.checked === true
        };
    }

    function guardarBorradorDesde(target) {
        const tarjeta = tarjetaCheckinDesde(target);
        if (!tarjeta) return;
        const borrador = leerBorrador(tarjeta);
        if (!borrador) {
            borradoresCheckin.delete(tarjeta.dataset.reservaId);
            return;
        }
        borradoresCheckin.set(tarjeta.dataset.reservaId, borrador);
    }

    function aplicarBorrador(tarjeta, borrador) {
        if (!tarjeta || !borrador) return;

        const medio = tarjeta.querySelector("[data-pago-checkin-medio]");
        const folio = tarjeta.querySelector("[data-pago-checkin-folio]");
        const codAut = tarjeta.querySelector("[data-pago-checkin-codaut]");
        const bove = tarjeta.querySelector("[data-pago-checkin-bove]");
        const manager = tarjeta.querySelector("[data-pago-checkin-manager]");

        if (medio && borrador.medio) medio.value = borrador.medio;
        if (folio && borrador.folio) folio.value = borrador.folio;
        if (codAut && borrador.codAut) codAut.value = borrador.codAut;
        if (bove && borrador.bove) bove.value = borrador.bove;
        if (manager) manager.checked = borrador.manager === true;
    }

    function restaurarBorradores() {
        if (restaurando) return;
        restaurando = true;
        try {
            document.querySelectorAll(".pago-checkin-item[data-reserva-id]").forEach(tarjeta => {
                const reservaId = tarjeta.dataset.reservaId;
                const estado = tarjeta.querySelector(".pago-checkin-estado")?.textContent || "";
                const completo = tarjeta.classList.contains("pago-checkin-completo") || /pagado/i.test(estado);

                if (completo) {
                    borradoresCheckin.delete(reservaId);
                    return;
                }

                const borrador = borradoresCheckin.get(reservaId);
                if (borrador) aplicarBorrador(tarjeta, borrador);
            });
        } finally {
            restaurando = false;
        }
    }

    // Capturamos el valor NUEVO antes de que listeners legacy puedan intervenir.
    // El navegador ya actualizó target.value/checked cuando se dispara change/input.
    document.addEventListener("change", evento => {
        if (!window.haikuSesion || !esCampoProtegido(evento.target)) return;
        guardarBorradorDesde(evento.target);
        evento.stopPropagation();
        evento.stopImmediatePropagation();
    }, true);

    document.addEventListener("input", evento => {
        if (!window.haikuSesion || !esCampoProtegido(evento.target)) return;
        guardarBorradorDesde(evento.target);
        evento.stopPropagation();
        evento.stopImmediatePropagation();
    }, true);

    // Si cualquier módulo reconstruye la tarjeta, recuperamos el borrador.
    const observar = () => {
        const lista = document.getElementById("pagos-lista-checkin");
        if (!lista || lista.dataset.haikuDraftObserver === "1") return false;

        lista.dataset.haikuDraftObserver = "1";
        const observer = new MutationObserver(() => {
            queueMicrotask(restaurarBorradores);
        });
        observer.observe(lista, { childList: true, subtree: true });
        restaurarBorradores();
        return true;
    };

    const iniciarObservador = () => {
        if (observar()) return;
        const observer = new MutationObserver(() => {
            if (observar()) observer.disconnect();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    window.haikuRestaurarBorradoresPago = restaurarBorradores;
    window.haikuBorradoresCheckin = borradoresCheckin;

    iniciarObservador();

    console.info("HAIKU · Guarda de formularios Pagos V3 preparada con borrador persistente en memoria.");
})();
