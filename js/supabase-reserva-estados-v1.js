// ========================================
// HAIKU · ESTADOS DE RESERVA SUPABASE V1
// Cancelación real en Supabase desde la ficha.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let cancelando = false;

    function cerrarMenuEstado() {
        try {
            if (typeof cerrarMenuEstadoFicha === "function") {
                cerrarMenuEstadoFicha();
            }
        } catch (_) {}
    }

    function cerrarFicha() {
        try {
            document.getElementById("ficha-reserva-cerrar")?.click();
        } catch (_) {}
    }

    async function refrescarDespuesDeCancelar() {
        try {
            await window.haikuSincronizarReservasSupabase?.();
        } catch (error) {
            console.warn("HAIKU · Sync visual tras cancelar:", error);
        }

        try {
            await window.HAIKU_OPERACION_RESUMEN_FIX_V1?.refrescar?.();
        } catch (_) {}

        try {
            if (typeof generarCalendario === "function") generarCalendario();
        } catch (_) {}

        try {
            if (typeof actualizarResumenDia === "function") {
                actualizarResumenDia(fechaSeleccionada);
            }
        } catch (_) {}

        try {
            if (typeof generarResumenOperativo === "function") {
                generarResumenOperativo(fechaSeleccionada);
            }
        } catch (_) {}

        try {
            await window.haikuCargarPagosPendientesSupabase?.();
        } catch (_) {}
    }

    async function cancelarReservaSupabase(reservaId) {
        if (!reservaId || cancelando) return;

        const confirmar = window.confirm(
            "¿Seguro que deseas cancelar esta reserva?\n\n" +
            "La reserva desaparecerá del Resumen y del Calendario."
        );

        if (!confirmar) return;

        cancelando = true;
        cerrarMenuEstado();

        try {
            const { data, error } = await cliente.rpc(
                "haiku_cancelar_reserva",
                { p_reserva_id: reservaId }
            );

            if (error) throw error;

            console.info("HAIKU · Reserva cancelada en Supabase:", data || reservaId);

            cerrarFicha();
            await refrescarDespuesDeCancelar();
        } catch (error) {
            console.error("HAIKU · No fue posible cancelar la reserva:", error);
            alert(error?.message || "No fue posible cancelar la reserva.");
        } finally {
            cancelando = false;
        }
    }

    document.addEventListener(
        "click",
        evento => {
            const opcion = evento.target?.closest?.(
                '[data-ficha-estado-opcion="cancelada"]'
            );

            if (!opcion) return;

            const modal = document.getElementById("ficha-reserva-modal");
            const reservaId = String(modal?.dataset?.reservaId || "");
            if (!reservaId) return;

            // Evita que la ruta legacy de localStorage se ejecute después.
            evento.preventDefault();
            evento.stopPropagation();
            evento.stopImmediatePropagation();

            cancelarReservaSupabase(reservaId);
        },
        true
    );

    window.HAIKU_RESERVA_ESTADOS_SUPABASE_V1 = Object.freeze({
        cancelar: cancelarReservaSupabase
    });

    console.info("HAIKU · Estados de reserva Supabase V1 preparados.");
})();
