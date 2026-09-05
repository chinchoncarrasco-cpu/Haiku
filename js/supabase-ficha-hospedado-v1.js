// ========================================
// HAIKU · FICHA · ESTADOS MANUALES SUPABASE V2
// Hospedado / Confirmada / Checked Out usan
// la autoridad real de Supabase para la estadía abierta.
// Sin observers, intervalos ni parches globales.
// ========================================

(() => {
    "use strict";

    if (window.HAIKU_FICHA_ESTADOS_MANUALES_V2) return;

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

    function pintarEstado(estado) {
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

        if (estado === "hospedado") {
            campo.textContent = "● Hospedado";
            campo.classList.add("ficha-estado-hospedado");
            return;
        }

        if (estado === "checked-out") {
            campo.textContent = "● Checked Out";
            campo.classList.add("ficha-estado-checkout");
            return;
        }

        if (estado === "confirmada") {
            campo.textContent = "● Confirmada";
            campo.classList.add("ficha-estado-confirmada");
        }
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
            throw new Error("La reserva no tiene una estadía activa disponible.");
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

        throw new Error("No fue posible determinar con seguridad qué estadía debe modificarse.");
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

    async function ejecutarCambio(opcion, estadoElegido) {
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
            const estadoDB = String(estadia?.estado_estadia || "").toLowerCase();
            const tieneCheckin = Boolean(estadia?.checkin_realizado_en);
            const tieneCheckout = Boolean(estadia?.checkout_realizado_en) || estadoDB === "checked_out";

            if (estadoElegido === "hospedado") {
                if (tieneCheckout) {
                    throw new Error("Esta estadía ya tiene Checked Out. No se puede volver a Hospedado desde este control.");
                }

                if (!tieneCheckin && estadoDB !== "hospedada") {
                    const { error } = await cliente.rpc("haiku_registrar_checkin", {
                        p_estadia_id: estadia.id
                    });
                    if (error) throw error;
                }

                await refrescarInterfaz();
                pintarEstado("hospedado");
                console.info("HAIKU · Estado manual guardado: Hospedado", reservaId, estadia.id);
                return;
            }

            if (estadoElegido === "checked-out") {
                if (tieneCheckout) {
                    await refrescarInterfaz();
                    pintarEstado("checked-out");
                    return;
                }

                if (!tieneCheckin && estadoDB !== "hospedada") {
                    throw new Error("Primero debes marcar esta estadía como Hospedado antes de registrar Checked Out.");
                }

                const { error } = await cliente.rpc("haiku_registrar_checkout", {
                    p_estadia_id: estadia.id
                });
                if (error) throw error;

                await refrescarInterfaz();
                pintarEstado("checked-out");
                console.info("HAIKU · Estado manual guardado: Checked Out", reservaId, estadia.id);
                return;
            }

            if (estadoElegido === "confirmada") {
                if (tieneCheckout) {
                    throw new Error("Esta estadía ya tiene Checked Out. No se puede volver directamente a Confirmada.");
                }

                if (!tieneCheckin && estadoDB === "confirmada") {
                    await refrescarInterfaz();
                    pintarEstado("confirmada");
                    return;
                }

                if (tieneCheckin || estadoDB === "hospedada") {
                    const confirmar = window.confirm(
                        "¿Volver esta estadía a Confirmada?\n\n" +
                        "Se anulará el check-in registrado para esta estadía."
                    );
                    if (!confirmar) return;
                }

                const { error } = await cliente.rpc("haiku_revertir_checkin", {
                    p_estadia_id: estadia.id
                });
                if (error) throw error;

                await refrescarInterfaz();
                pintarEstado("confirmada");
                console.info("HAIKU · Check-in revertido; estado Confirmada", reservaId, estadia.id);
            }
        } catch (error) {
            console.error("HAIKU · No fue posible cambiar el estado manual:", error);
            alert(error?.message || "No fue posible cambiar el estado. La reserva no fue modificada.");

            // Supabase es la autoridad. Si hubo error recuperamos el estado real.
            try { await refrescarInterfaz(); } catch (_) {}
        } finally {
            guardando = false;
            opcion.disabled = false;
            opcion.textContent = textoOriginal;
        }
    }

    document.addEventListener("click", evento => {
        const opcion = evento.target?.closest?.("[data-ficha-estado-opcion]");
        if (!opcion) return;

        const estadoElegido = String(opcion.dataset.fichaEstadoOpcion || "");
        if (!["hospedado", "confirmada", "checked-out"].includes(estadoElegido)) {
            return;
        }

        // Interceptamos sólo los estados que ahora tienen persistencia real,
        // antes del handler legacy que antes sólo los pintaba/cerraba el menú.
        evento.preventDefault();
        evento.stopPropagation();
        evento.stopImmediatePropagation();

        ejecutarCambio(opcion, estadoElegido);
    }, true);

    const api = Object.freeze({
        cambiar: ejecutarCambio
    });

    window.HAIKU_FICHA_ESTADOS_MANUALES_V2 = api;
    // Alias histórico para no romper ninguna referencia previa.
    window.HAIKU_FICHA_HOSPEDADO_V1 = api;

    console.info("HAIKU · Estados manuales de ficha conectados a Supabase V2.");
})();
