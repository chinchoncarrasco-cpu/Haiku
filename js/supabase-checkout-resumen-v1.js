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
        const reservaId = String(estadia?.reserva_id || "");
        if (!numero || !reservaId) return false;

        let datosDia = null;
        try {
            datosDia = typeof obtenerDatosDia === "function"
                ? obtenerDatosDia(fecha)
                : null;
        } catch (_) {}

        const cabana = datosDia?.cabanas?.[numero];
        if (!cabana) return false;

        // No pintar una salida anterior sobre una nueva reserva que entró en
        // la misma CAB el mismo día (SALE / INGRESA).
        if (String(cabana.reservaId || "") !== reservaId) return false;

        const hora = horaChile(estadia.checkout_realizado_en);

        // En la fecha de salida, el checkout real domina visualmente al
        // check-in anterior de la misma estadía.
        cabana.checkinRealizado = false;
        cabana.checkoutRealizado = true;
        if (!cabana.checkout && hora) cabana.checkout = hora;

        const fila = document.querySelector(`tr[data-cabana="${numero}"]`);
        if (!fila) return false;

        fila.classList.remove(
            "cabana-checkin",
            "cabana-libre",
            "cabana-ingresa"
        );
        fila.classList.add("cabana-checkout");
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
