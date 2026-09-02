// ========================================
// HAIKU · BLOQUEOS UI FIX V1
// Interacción fiable de barras + titular BLOQUEADA en Resumen.
// No modifica la lógica financiera, reservas ni el rango del bloqueo.
// ========================================

(() => {
    "use strict";

    let raf = 0;
    let observer = null;

    function fechaActual() {
        try {
            return String(fechaSeleccionada || "").slice(0, 10);
        } catch (_) {
            return "";
        }
    }

    function datosLegacy() {
        try {
            return JSON.parse(localStorage.getItem("haikuDatos") || "{}") || {};
        } catch (_) {
            return {};
        }
    }

    function idDesdeBarra(barra) {
        if (!barra) return "";

        const reservaId = String(barra.dataset?.reservaId || "");
        const match = reservaId.match(/BLQ-SB-([0-9a-f-]{36})/i);
        if (match?.[1]) return match[1];

        const numero = String(barra.dataset?.cabana || "");
        if (!numero) return "";

        const datos = datosLegacy();
        for (const dia of Object.values(datos)) {
            const cabana = dia?.cabanas?.[numero];
            if (
                String(cabana?.estado || "").toLowerCase() === "bloqueada" &&
                cabana?.bloqueoSupabaseId
            ) {
                return String(cabana.bloqueoSupabaseId);
            }
        }

        return "";
    }

    function activarBarrasBloqueo() {
        document
            .querySelectorAll(".calendario-bloqueo-barra")
            .forEach(barra => {
                barra.style.setProperty("pointer-events", "auto", "important");
                barra.style.setProperty("cursor", "pointer", "important");
                barra.style.setProperty("z-index", "25", "important");
                barra.setAttribute("aria-label", "Abrir opciones del bloqueo");
            });
    }

    function aplicarBloqueadasResumen() {
        const fecha = fechaActual();
        if (!fecha) return;

        const cabanas = datosLegacy()?.[fecha]?.cabanas || {};

        Object.entries(cabanas).forEach(([numero, cabana]) => {
            if (String(cabana?.estado || "").toLowerCase() !== "bloqueada") {
                return;
            }

            const fila = document.querySelector(
                `#seccion-resumen [data-cabana="${CSS.escape(String(numero))}"]`
            );
            if (!fila) return;

            const titular = fila.querySelector(
                `[data-titular-cabana="${CSS.escape(String(numero))}"]`
            );
            if (titular && titular.textContent !== "BLOQUEADA") {
                titular.textContent = "BLOQUEADA";
            }

            const estado = fila.querySelector('[data-campo="estado"]');
            if (estado && estado.value !== "bloqueada") {
                estado.value = "bloqueada";
            }

            fila.classList.remove(
                "cabana-checkout",
                "cabana-checkin",
                "cabana-libre",
                "cabana-ingresa"
            );
            fila.classList.add("cabana-bloqueada");

            const motivo = String(cabana?.bloqueoMotivo || "").trim();
            if (motivo) fila.title = `Bloqueada · ${motivo}`;
        });
    }

    function actualizarUI() {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            activarBarrasBloqueo();
            aplicarBloqueadasResumen();
        });
    }

    function interceptarClickBloqueo(evento) {
        const barra = evento.target?.closest?.(".calendario-bloqueo-barra");
        if (!barra) return;

        const id = idDesdeBarra(barra);
        if (!id) return;

        const api = window.HAIKU_BLOQUEOS_CALENDARIO_SUPABASE_V1;
        if (!api?.liberar) return;

        evento.preventDefault();
        evento.stopPropagation();
        evento.stopImmediatePropagation();

        api.liberar(id);
    }

    function instalar() {
        if (document.documentElement.dataset.haikuBloqueosUiFixV1 === "1") {
            actualizarUI();
            return;
        }

        document.documentElement.dataset.haikuBloqueosUiFixV1 = "1";

        const style = document.createElement("style");
        style.textContent = `
            #seccion-calendario .calendario-bloqueo-barra {
                pointer-events: auto !important;
                cursor: pointer !important;
                z-index: 25 !important;
                touch-action: manipulation;
            }
        `;
        document.head.appendChild(style);

        // Captura antes que los handlers legacy del calendario.
        document.addEventListener("click", interceptarClickBloqueo, true);

        observer = new MutationObserver(actualizarUI);
        observer.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true
        });

        document.addEventListener("change", evento => {
            if (evento.target?.matches?.('#seccion-resumen [data-campo="estado"]')) {
                setTimeout(actualizarUI, 0);
            }
        }, true);

        document.addEventListener("click", evento => {
            if (
                evento.target?.closest?.(".dia-calendario") ||
                evento.target?.closest?.('[data-seccion="resumen"]') ||
                evento.target?.closest?.('[data-seccion="calendario"]')
            ) {
                setTimeout(actualizarUI, 0);
                setTimeout(actualizarUI, 160);
            }
        }, true);

        window.addEventListener("haiku:auth-ready", () => {
            setTimeout(actualizarUI, 80);
            setTimeout(actualizarUI, 260);
        });

        window.addEventListener("pageshow", () => setTimeout(actualizarUI, 80));

        actualizarUI();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", instalar, { once: true });
    } else {
        instalar();
    }
})();
