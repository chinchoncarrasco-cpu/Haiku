// HAIKU · Revisión -> Resumen Sync V2
(() => {
    "use strict";

    let timer = null;
    let sincronizando = false;

    function fechaActual() {
        try {
            return typeof fechaSeleccionada !== "undefined"
                ? String(fechaSeleccionada || "")
                : "";
        } catch (_) {
            return "";
        }
    }

    function numeroAbierto() {
        return localStorage.getItem("haikuRevisionCabana") || "";
    }

    function estadoFinal(valorRevision) {
        if (valorRevision === "lista") return "LISTA";
        if (valorRevision === "con-detalles") return "CON DETALLES";
        return "";
    }

    function aplicarLocal(numero, valorRevision) {
        const fecha = fechaActual();
        if (!fecha || typeof obtenerDatosDia !== "function") return;

        const datos = obtenerDatosDia(fecha);
        datos.cabanas[numero] ||= {};
        datos.cabanas[numero].estadoRevision = valorRevision;
        datos.cabanas[numero].estadoFinal = estadoFinal(valorRevision);

        if (typeof guardarDatos === "function") guardarDatos();
    }

    function aplicarResumen(numero, valorRevision) {
        const fila = document.querySelector(
            `#seccion-resumen tr[data-cabana="${String(numero)}"]`
        );
        const selector = fila?.querySelector('[data-campo="estadoFinal"]');
        if (selector) selector.value = estadoFinal(valorRevision);
    }

    function refrescarDesdeLocal() {
        const fecha = fechaActual();
        if (!fecha || typeof obtenerDatosDia !== "function") return;

        const datos = obtenerDatosDia(fecha);
        Object.entries(datos.cabanas || {}).forEach(([numero, cabana]) => {
            const valor = cabana?.estadoRevision || "pendiente";
            aplicarResumen(numero, valor);
        });

        if (typeof actualizarTarjetasRevision === "function") {
            actualizarTarjetasRevision(fecha);
        }
    }

    async function resincronizar() {
        if (sincronizando) return;
        const puente = window.HAIKU_REVISION_SUPABASE_V1;
        if (!puente) return;

        sincronizando = true;
        try {
            puente.limpiarCache?.();
            await puente.sincronizarResumenFecha?.();
            refrescarDesdeLocal();
        } finally {
            sincronizando = false;
        }
    }

    function instalarSelectorRevision() {
        const selector = document.getElementById("revision-estado");
        if (!selector || selector.dataset.haikuResumenSyncV2 === "1") return;

        selector.dataset.haikuResumenSyncV2 = "1";
        selector.addEventListener("change", () => {
            const numero = numeroAbierto();
            if (!numero) return;

            const valor = selector.value || "pendiente";
            aplicarLocal(numero, valor);
            aplicarResumen(numero, valor);

            const fecha = fechaActual();
            if (fecha && typeof actualizarTarjetasRevision === "function") {
                actualizarTarjetasRevision(fecha);
            }

            clearTimeout(timer);
            timer = setTimeout(resincronizar, 700);
        });
    }

    function instalarAutoRefresh() {
        ["seccion-resumen", "seccion-cabanas"].forEach(id => {
            const seccion = document.getElementById(id);
            if (!seccion) return;

            let activaAntes = seccion.classList.contains("activa");
            const observer = new MutationObserver(() => {
                const activa = seccion.classList.contains("activa");
                if (activa && !activaAntes) resincronizar();
                activaAntes = activa;
            });

            observer.observe(seccion, {
                attributes: true,
                attributeFilter: ["class"]
            });
        });
    }

    function iniciar() {
        instalarSelectorRevision();
        instalarAutoRefresh();
        resincronizar();

        window.HAIKU_REVISION_RESUMEN_SYNC_V2 = Object.freeze({
            resincronizar,
            refrescarDesdeLocal
        });

        console.log("HAIKU · Revisión -> Resumen Sync V2 activo.");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
})();
