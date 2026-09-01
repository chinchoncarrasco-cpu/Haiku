// =====================================================
// HAIKU · CIERRE DE TURNO · AUTOREFRESH V1
// Trae el estado fresco de Supabase cada vez que Cierre
// pasa a estar visible, sin exigir recarga manual.
// =====================================================

(() => {
    "use strict";

    let refrescando = false;
    let timer = null;
    let estabaActiva = false;

    function fechaActual() {
        try {
            return String(window.fechaSeleccionada || fechaSeleccionada || "").slice(0, 10);
        } catch {
            return "";
        }
    }

    function obtenerSeccion() {
        return document.getElementById("seccion-cierre");
    }

    function estaActiva() {
        const seccion = obtenerSeccion();
        if (!seccion) return false;

        return seccion.classList.contains("activa") && !seccion.hidden;
    }

    async function refrescarCierreCompleto(origen = "seccion-visible") {
        if (refrescando || !estaActiva()) return;

        const fecha = fechaActual();
        if (!fecha) return;

        const cargar = window.haikuCargarCierreSupabase;
        if (typeof cargar !== "function") return;

        refrescando = true;

        try {
            await cargar(fecha, { forzarRender: true });

            if (typeof window.haikuRefrescarEstadoCierre === "function") {
                await window.haikuRefrescarEstadoCierre();
            }

            console.info(
                "HAIKU · Cierre sincronizado al entrar:",
                fecha,
                origen
            );
        } catch (error) {
            console.error(
                "HAIKU · No fue posible sincronizar Cierre al entrar:",
                error
            );
        } finally {
            refrescando = false;
        }
    }

    function programarRefresco(origen, demora = 30) {
        clearTimeout(timer);
        timer = setTimeout(() => refrescarCierreCompleto(origen), demora);
    }

    function revisarVisibilidad(origen = "observer") {
        const activa = estaActiva();

        if (activa && !estabaActiva) {
            // Espera sólo a que termine el cambio de sección y luego trae Supabase.
            requestAnimationFrame(() => programarRefresco(origen, 20));
        }

        estabaActiva = activa;
    }

    function iniciarObservador() {
        const seccion = obtenerSeccion();
        if (!seccion) {
            setTimeout(iniciarObservador, 120);
            return;
        }

        estabaActiva = estaActiva();

        const observer = new MutationObserver(() => {
            revisarVisibilidad("mutation");
        });

        observer.observe(seccion, {
            attributes: true,
            attributeFilter: ["class", "hidden", "style"]
        });

        // Respaldo por si la navegación cambia clases en otras partes del DOM.
        const bodyObserver = new MutationObserver(() => {
            revisarVisibilidad("body-mutation");
        });

        bodyObserver.observe(document.body, {
            subtree: false,
            childList: true,
            attributes: true,
            attributeFilter: ["class"]
        });

        if (estabaActiva) {
            programarRefresco("inicio-activo", 60);
        }
    }

    document.addEventListener("click", event => {
        const enlace = event.target?.closest?.('[data-seccion="cierre"], [data-seccion="cierre-turno"]');
        if (!enlace) return;

        // Refresco inmediato tras navegación. La comprobación de visibilidad
        // evita peticiones si por alguna razón el cambio de sección no ocurrió.
        setTimeout(() => {
            revisarVisibilidad("click-menu");
            if (estaActiva()) programarRefresco("click-menu", 0);
        }, 0);
    }, true);

    window.addEventListener("focus", () => {
        if (estaActiva()) programarRefresco("window-focus", 40);
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && estaActiva()) {
            programarRefresco("visibility", 40);
        }
    });

    window.addEventListener("haiku:auth-ready", () => {
        if (estaActiva()) programarRefresco("auth-ready", 80);
    });

    window.haikuRefrescarCierreAlEntrar = () => {
        programarRefresco("manual-api", 0);
    };

    setTimeout(iniciarObservador, 250);

    console.info("HAIKU · Auto-refresh de Cierre preparado.");
})();
