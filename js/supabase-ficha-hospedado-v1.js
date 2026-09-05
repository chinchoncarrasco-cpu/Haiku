// ========================================
// HAIKU · FICHA · HOSPEDADO SUPABASE V1
// El cambio manual a Hospedado usa la misma
// autoridad real de check-in de Supabase.
// Sin observers, intervalos ni parches globales.
// ========================================

(() => {
    "use strict";

    if (window.HAIKU_FICHA_HOSPEDADO_V1) return;

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let guardando = false;

    function cerrarMenuEstado() {
        try {
            if (typeof cerrarMenuEstadoFicha === "function") {
                cerrarMenuEstadoFicha();
                return;
            }
        } catch (_) {}

        const menu = document.getElementById("ficha-reserva-estado-menu");
        if (menu) menu.hidden = true;
    }

    function pintarHospedado() {
        const campo = document.getElementById("ficha-reserva-estado");
        if (!campo) return;

        campo.classList.remove(
            "ficha-estado-hospedado",
            "ficha-estado-checkout",
            "ficha-estado-pendiente",
            "ficha-estado-confirmada",
            "ficha-estado-confirmacion-pendiente",
            "ficha-estado-cancelada",
            "ficha-estado-no-show"
        );

        campo.textContent = "● Hospedado";
        campo.classList.add("ficha-estado-hospedado");
    }

    function fechaDentroDeEstadia(estadia, fecha) {
        const f = String(fecha || "").slice(0, 10);
        const ingreso = String(estadia?.fecha_ingreso || "").slice(0, 10);
        const salida = String(estadia?.fecha_salida || "").slice(0, 10);
        if (!f || !ingreso || !salida) return false;
        return f >= ingreso && f < salida;
    }

    async function resolverEstadia(reservaId, numeroCabana) {
        const { data, error } = await cliente.rpc("haiku_ficha_reserva_core", {
            p_reserva_id: reservaId
        });

        if (error) throw error;

        const estadias = Array.isArray(data?.estadias) ? data.estadias : [];
        if (!estadias.length) {
            throw new Error("La reserva no tiene una estadía activa para registrar el check-in.");
        }

        const cabana = String(numeroCabana || "");
        const fecha = (() => {
            try { return String(fechaSeleccionada || "").slice(0, 10); }
            catch (_) { return ""; }
        })();

        const mismaCabanaYFecha = estadias.find(estadia =>
            String(estadia?.cabana_numero || "") === cabana &&
            fechaDentroDeEstadia(estadia, fecha)
        );
        if (mismaCabanaYFecha) return mismaCabanaYFecha;

        const mismaCabana = estadias.find(estadia =>
            String(estadia?.cabana_numero || "") === cabana
        );
        if (mismaCabana) return mismaCabana;

        const mismaFecha = estadias.find(estadia =>
            fechaDentroDeEstadia(estadia, fecha)
        );
        if (mismaFecha) return mismaFecha;

        if (estadias.length === 1) return estadias[0];

        throw new Error("No fue posible determinar con seguridad qué estadía debe pasar a Hospedado.");
    }

    async function refrescarInterfaz() {
        try { await window.haikuSincronizarReservasSupabase?.(); } catch (_) {}
        try { await window.HAIKU_OPERACION_RESUMEN_FIX_V1?.refrescar?.(); } catch (_) {}
        try {
            if (typeof cargarCabanasDia === "function") {
                cargarCabanasDia(fechaSeleccionada);
            }
        } catch (_) {}
        try {
            if (typeof generarCalendario === "function") {
                generarCalendario();
            }
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
    }

    async function registrarHospedado(opcion) {
        if (guardando) return;

        const modal = document.getElementById("ficha-reserva-modal");
        const reservaId = String(modal?.dataset?.reservaId || "");
        const numeroCabana = String(modal?.dataset?.numeroCabana || "");

        if (!reservaId) {
            alert("No fue posible identificar la reserva abierta.");
            return;
        }

        guardando = true;
        const textoOriginal = opcion.textContent;
        opcion.disabled = true;
        opcion.textContent = "Guardando…";
        cerrarMenuEstado();

        try {
            const estadia = await resolverEstadia(reservaId, numeroCabana);

            if (
                String(estadia?.estado_estadia || "").toLowerCase() === "hospedada" ||
                estadia?.checkin_realizado_en
            ) {
                pintarHospedado();
                await refrescarInterfaz();
                return;
            }

            const { error } = await cliente.rpc("haiku_registrar_checkin", {
                p_estadia_id: estadia.id
            });

            if (error) throw error;

            pintarHospedado();
            await refrescarInterfaz();
            pintarHospedado();

            console.info(
                "HAIKU · Check-in manual guardado en Supabase:",
                reservaId,
                estadia.id
            );
        } catch (error) {
            console.error("HAIKU · No fue posible registrar Hospedado:", error);
            alert(error?.message || "No fue posible registrar el check-in. La reserva no fue modificada.");

            // La base es la autoridad. Si hubo error, recuperamos el estado real.
            try { await refrescarInterfaz(); } catch (_) {}
        } finally {
            guardando = false;
            opcion.disabled = false;
            opcion.textContent = textoOriginal;
        }
    }

    document.addEventListener("click", evento => {
        const opcion = evento.target?.closest?.(
            '[data-ficha-estado-opcion="hospedado"]'
        );
        if (!opcion) return;

        // Interceptamos únicamente Hospedado antes del handler legacy,
        // evitando que se pinte localmente sin persistencia real.
        evento.preventDefault();
        evento.stopPropagation();
        evento.stopImmediatePropagation();

        registrarHospedado(opcion);
    }, true);

    window.HAIKU_FICHA_HOSPEDADO_V1 = Object.freeze({
        registrar: registrarHospedado
    });

    console.info("HAIKU · Hospedado manual conectado a Supabase.");
})();
