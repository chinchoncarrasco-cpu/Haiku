// ========================================
// HAIKU · SUPABASE · GUARDAS V2
// Evita que datos comerciales se editen sólo en localStorage.
// ========================================

(() => {
    "use strict";

    function fechaActual() {
        try { return String(fechaSeleccionada || "").slice(0,10); }
        catch { return ""; }
    }

    function reservaLocal(numeroCabana) {
        try {
            const fecha = fechaActual();
            if (!fecha || typeof obtenerDatosDia !== "function") return null;
            return obtenerDatosDia(fecha)?.cabanas?.[String(numeroCabana)] || null;
        } catch {
            return null;
        }
    }

    async function abrirEditorReal(numeroCabana) {
        const fecha = fechaActual();
        if (!fecha || !numeroCabana) return;

        if (typeof window.haikuAbrirFichaSupabaseV2 === "function") {
            await window.haikuAbrirFichaSupabaseV2(String(numeroCabana), fecha);
            setTimeout(() => {
                document.getElementById("ficha-reserva-editar")?.click();
            }, 20);
        }
    }

    document.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-editar-titular], [data-editar-noches]");
        if (!boton || !window.haikuSesion) return;

        const numero = boton.dataset.editarTitular || boton.dataset.editarNoches || "";
        const reserva = reservaLocal(numero);
        if (!reserva?.reservaId) return;

        evento.preventDefault();
        evento.stopPropagation();
        evento.stopImmediatePropagation();
        abrirEditorReal(numero);
    }, true);

    function protegerFilas() {
        if (!window.haikuSesion) return;
        const fecha = fechaActual();
        if (!fecha) return;

        document.querySelectorAll(".tabla-contenedor tbody tr[data-cabana]").forEach(fila => {
            const numero = fila.dataset.cabana;
            const reserva = reservaLocal(numero);
            const tieneReserva = Boolean(reserva?.reservaId);

            ["adultos","ninos","mascotas"].forEach(campo => {
                const input = fila.querySelector(`[data-campo="${campo}"]`);
                if (!input) return;
                input.readOnly = tieneReserva;
                input.title = tieneReserva
                    ? "Editar desde la ficha de reserva"
                    : "";
            });

            const estado = fila.querySelector('[data-campo="estado"]');
            if (estado && tieneReserva) {
                estado.disabled = true;
                estado.title = "Estado calculado desde Supabase";
            }
        });
    }

    window.haikuProtegerFilasSupabase = protegerFilas;

    window.addEventListener("haiku:auth-ready", () => {
        setTimeout(protegerFilas, 250);
    });

    document.addEventListener("click", () => setTimeout(protegerFilas, 250));
    document.addEventListener("change", () => setTimeout(protegerFilas, 250));

    setTimeout(protegerFilas, 350);

    console.info("HAIKU · Guardas Supabase V2 preparadas.");
})();
