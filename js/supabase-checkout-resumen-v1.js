// ========================================
// HAIKU · CHECKED OUT · RESUMEN V1
// Refleja en el Resumen el checkout real de Supabase.
// Sin observers, intervalos, polling ni parches globales.
// ========================================
(() => {
    "use strict";

    if (window.HAIKU_CHECKOUT_RESUMEN_V1) return;

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let refrescando = false;

    function fechaActualResumen() {
        try {
            return String(fechaSeleccionada || "").slice(0, 10);
        } catch (_) {
            return "";
        }
    }

    function horaChile(iso) {
        if (!iso) return "";
        try {
            const partes = new Intl.DateTimeFormat("en-GB", {
                timeZone: "America/Santiago",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).formatToParts(new Date(iso));
            const mapa = Object.fromEntries(partes.map(p => [p.type, p.value]));
            return `${mapa.hour}:${mapa.minute}`;
        } catch (_) {
            return "";
        }
    }

    async function obtenerCheckouts(fecha) {
        const { data, error } = await cliente
            .from("reserva_estadias")
            .select("id,reserva_id,fecha_salida,checkout_realizado_en,cabanas(numero)")
            .eq("fecha_salida", fecha)
            .not("checkout_realizado_en", "is", null);

        if (error) throw error;
        return Array.isArray(data) ? data : [];
    }

    function aplicarFila(estadia, fecha) {
        const numero = String(estadia?.cabanas?.numero || "");
        const reservaIdSalida = String(estadia?.reserva_id || "");
        if (!numero || !reservaIdSalida) return false;

        let datosDia = null;
        try {
            datosDia = typeof obtenerDatosDia === "function"
                ? obtenerDatosDia(fecha)
                : null;
        } catch (_) {}

        const cabana = datosDia?.cabanas?.[numero];
        if (!cabana) return false;

        const reservaIdVisible = String(cabana.reservaId || "");
        const mismaReserva = reservaIdVisible === reservaIdSalida;
        const saleIngresa = cabana.estado === "sale-ingresa";

        // Si la fila ya representa otra reserva, sólo podemos proyectar la
        // salida anterior cuando el propio estado operativo confirma que ese
        // día es SALE / INGRESA. Así no pintamos salidas antiguas en una CAB
        // que ya pertenece a una reserva completamente distinta.
        if (!mismaReserva && !saleIngresa) return false;

        const hora = horaChile(estadia.checkout_realizado_en);
        cabana.checkoutRealizado = true;
        if (!cabana.checkout && hora) cabana.checkout = hora;

        // Si la fila todavía representa a la reserva que salió, su check-in
        // anterior ya no debe ganar el color. En SALE / INGRESA, en cambio,
        // checkinRealizado pertenece al huésped que entra y se conserva.
        if (mismaReserva) {
            cabana.checkinRealizado = false;
        }

        const fila = document.querySelector(`tr[data-cabana="${numero}"]`);
        if (!fila) return false;

        const nuevoHuespedYaIngreso =
            !mismaReserva &&
            saleIngresa &&
            cabana.checkinRealizado === true;

        fila.classList.remove(
            "cabana-checkout",
            "cabana-checkin",
            "cabana-libre",
            "cabana-ingresa"
        );

        // En SALE / INGRESA: checkout del huésped anterior = azul hasta que
        // el nuevo huésped haga check-in. Desde ese momento prima verde.
        if (nuevoHuespedYaIngreso) {
            fila.classList.add("cabana-checkin");
        } else {
            fila.classList.add("cabana-checkout");
        }

        fila.dataset.haikuCheckoutSupabase = "1";

        const inputCheckout = fila.querySelector('[data-campo="checkout"]');
        if (inputCheckout && !inputCheckout.value && hora) {
            inputCheckout.value = hora;
        }

        return true;
    }

    async function refrescar({ sincronizar = false } = {}) {
        if (refrescando) return;

        const fecha = fechaActualResumen();
        if (!fecha || !window.haikuSesion) return;

        refrescando = true;
        try {
            if (sincronizar) {
                try { await window.haikuSincronizarReservasSupabase?.(); } catch (_) {}
                try {
                    if (typeof cargarCabanasDia === "function") {
                        cargarCabanasDia(fecha);
                    }
                } catch (_) {}
            }

            const estadias = await obtenerCheckouts(fecha);
            let aplicadas = 0;
            estadias.forEach(estadia => {
                if (aplicarFila(estadia, fecha)) aplicadas += 1;
            });

            if (aplicadas > 0) {
                try { if (typeof guardarDatos === "function") guardarDatos(); } catch (_) {}
            }

            console.info(
                "HAIKU · Checked Out reflejados en Resumen:",
                aplicadas,
                "· fecha",
                fecha
            );
        } catch (error) {
            console.error("HAIKU · No fue posible reflejar Checked Out en Resumen:", error);
        } finally {
            refrescando = false;
        }
    }

    window.addEventListener("haiku:auth-ready", () => {
        refrescar({ sincronizar: true });
    });

    document.addEventListener("click", evento => {
        const resumen = evento.target?.closest?.('.menu-item[data-seccion="resumen"]');
        if (!resumen) return;
        requestAnimationFrame(() => refrescar({ sincronizar: true }));
    });

    const api = Object.freeze({ refrescar });
    window.HAIKU_CHECKOUT_RESUMEN_V1 = api;

    if (window.haikuSesion) {
        refrescar({ sincronizar: true });
    }

    console.info("HAIKU · Puente visual Checked Out → Resumen preparado.");
})();
