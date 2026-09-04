// ========================================
// HAIKU · SERVICIOS · PAGO + BOVE V1
// Corrige el estado visual de Agenda usando la verdad financiera de Supabase.
// No registra ni modifica pagos. Sin observers, intervalos ni parches globales.
// ========================================
(() => {
    "use strict";

    if (window.HAIKU_SERVICIOS_PAGO_BOVE_V1) return;

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let refrescando = false;

    function listaServicios() {
        try {
            if (typeof serviciosRegistrados !== "undefined" && Array.isArray(serviciosRegistrados)) {
                return serviciosRegistrados;
            }
        } catch {}

        try {
            const lista = JSON.parse(localStorage.getItem("haikuServicios") || "[]");
            return Array.isArray(lista) ? lista : [];
        } catch {
            return [];
        }
    }

    function guardarCache(lista) {
        try {
            localStorage.setItem("haikuServicios", JSON.stringify(lista));
        } catch {}
    }

    function esCortesia(servicio) {
        return servicio?.cortesia === true ||
            String(servicio?.tipoCobro || "") === "cortesia" ||
            Number(servicio?.total || 0) === 0;
    }

    function estaCancelado(servicio) {
        return ["cancelado", "cancelada", "no_show"].includes(
            String(servicio?.estadoServicioDb || servicio?.estadoServicio || "")
        );
    }

    async function leerCargos(ids) {
        if (!ids.length) return [];

        const { data, error } = await cliente
            .from("vista_estado_cargos")
            .select("servicio_id,saldo_cargo,estado,tipo_cargo")
            .in("servicio_id", ids)
            .eq("tipo_cargo", "servicio")
            .eq("estado", "activo");

        if (error) throw error;
        return data || [];
    }

    async function leerBoves(reservaIds) {
        const ids = [...new Set(reservaIds.filter(Boolean))];
        if (!ids.length) return new Map();

        const { data, error } = await cliente
            .from("reservas")
            .select("id,bove_checkout")
            .in("id", ids);

        if (error) throw error;
        return new Map((data || []).map(item => [String(item.id), String(item.bove_checkout || "").trim()]));
    }

    function asegurarEtiquetaPago(cobro) {
        let etiqueta = cobro?.querySelector(".servicios-pago-ok, .servicios-pago-pendiente");
        if (!etiqueta && cobro) {
            etiqueta = document.createElement("span");
            cobro.appendChild(etiqueta);
        }
        return etiqueta;
    }

    function aplicarEstadoTarjeta(tarjeta, servicio, pagado, boveRegistrado) {
        if (!tarjeta || !servicio || esCortesia(servicio) || estaCancelado(servicio)) return;

        const cobro = tarjeta.querySelector(".servicio-agenda-cobro");
        if (!cobro) return;

        const etiqueta = asegurarEtiquetaPago(cobro);
        if (!etiqueta) return;

        const boveAnterior = cobro.querySelector(".haiku-servicio-bove-pendiente-v1");

        if (pagado) {
            etiqueta.className = "servicios-pago-ok";
            etiqueta.textContent = "✓ Pagado";

            if (!boveRegistrado) {
                const bove = boveAnterior || document.createElement("span");
                bove.className = "haiku-servicio-bove-pendiente-v1";
                bove.textContent = "BOVE pendiente";
                if (!boveAnterior) cobro.appendChild(bove);
            } else {
                boveAnterior?.remove();
            }
        } else {
            etiqueta.className = "servicios-pago-pendiente";
            etiqueta.textContent = "Pendiente de pago";
            boveAnterior?.remove();
        }
    }

    async function refrescar() {
        if (refrescando || !window.haikuSesion) return;

        const agenda = document.getElementById("servicios-agenda");
        if (!agenda) return;

        const tarjetas = [...agenda.querySelectorAll("[data-haiku-servicio-id]")];
        if (!tarjetas.length) return;

        refrescando = true;
        try {
            const lista = listaServicios();
            const porId = new Map(lista.map(servicio => [String(servicio?.id || ""), servicio]));
            const ids = tarjetas
                .map(t => String(t.dataset.haikuServicioId || ""))
                .filter(Boolean);

            const visibles = ids.map(id => porId.get(id)).filter(Boolean);
            const [cargos, boves] = await Promise.all([
                leerCargos(ids),
                leerBoves(visibles.map(s => String(s?.reservaId || "")))
            ]);

            const saldoPorServicio = new Map();
            cargos.forEach(cargo => {
                const id = String(cargo?.servicio_id || "");
                if (!id) return;
                saldoPorServicio.set(
                    id,
                    Number(saldoPorServicio.get(id) || 0) + Number(cargo?.saldo_cargo || 0)
                );
            });

            let pendientes = 0;

            tarjetas.forEach(tarjeta => {
                const id = String(tarjeta.dataset.haikuServicioId || "");
                const servicio = porId.get(id);
                if (!servicio || esCortesia(servicio) || estaCancelado(servicio)) return;
                if (!saldoPorServicio.has(id)) return;

                const pagado = Number(saldoPorServicio.get(id) || 0) <= 0;
                servicio.estadoPago = pagado ? "pagado" : "pendiente";
                if (!pagado) pendientes++;

                const boveRegistrado = Boolean(boves.get(String(servicio.reservaId || "")));
                aplicarEstadoTarjeta(tarjeta, servicio, pagado, boveRegistrado);
            });

            guardarCache(lista);

            const contador = document.getElementById("servicios-contador-pendientes");
            if (contador) contador.textContent = String(pendientes);
        } catch (error) {
            console.error("HAIKU · No fue posible actualizar Pago/BOVE en Servicios:", error);
        } finally {
            refrescando = false;
        }
    }

    function programar(delay = 60) {
        setTimeout(refrescar, delay);
    }

    const style = document.createElement("style");
    style.id = "haiku-servicios-pago-bove-v1-css";
    style.textContent = `
        #seccion-servicios .haiku-servicio-bove-pendiente-v1 {
            display: inline-flex;
            align-items: center;
            min-height: 22px;
            padding: 0 9px;
            border-radius: 999px;
            background: #fff0cf;
            color: #8a6217;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
        }
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    document.addEventListener("haiku:servicios-hidratados", () => programar(0));
    document.addEventListener("haiku:servicio-supabase-cambiado", () => programar(80));
    document.addEventListener("click", evento => {
        if (evento.target.closest?.('[data-seccion="servicios"], [data-ir-seccion="servicios"]')) {
            programar(80);
        }
    });
    window.addEventListener("focus", () => {
        const seccion = document.getElementById("seccion-servicios");
        if (seccion && !seccion.hidden && seccion.style.display !== "none") programar(80);
    });

    window.HAIKU_SERVICIOS_PAGO_BOVE_V1 = Object.freeze({ refrescar });

    setTimeout(() => {
        const seccion = document.getElementById("seccion-servicios");
        if (window.haikuSesion && seccion && !seccion.hidden && seccion.style.display !== "none") {
            refrescar();
        }
    }, 900);

    console.info("HAIKU · Estado Pago/BOVE de Servicios V1 preparado.");
})();