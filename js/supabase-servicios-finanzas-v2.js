// ========================================
// HAIKU · SERVICIOS · FINANZAS SUPABASE V2
// Sincroniza el estado de pago visual con cargos/pagos reales.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    const MAPA_KEY = "haikuSupabaseServicioMapV1";
    let sincronizando = false;
    let temporizador = null;

    function listaLegacy() {
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

    function leerMapa() {
        try {
            return JSON.parse(localStorage.getItem(MAPA_KEY) || "{}");
        } catch {
            return {};
        }
    }

    function guardarLegacy(lista) {
        try {
            localStorage.setItem("haikuServicios", JSON.stringify(lista));
        } catch {}
    }

    function ocultarAccionesPagoManual() {
        if (document.getElementById("haiku-servicios-finanzas-v2-css")) return;

        const style = document.createElement("style");
        style.id = "haiku-servicios-finanzas-v2-css";
        style.textContent = `
            #seccion-servicios button[onclick^="marcarServicioPagado"],
            #seccion-servicios button[onclick^="deshacerServicioPagado"] {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    async function asegurarIdsSupabase(lista) {
        const mapa = leerMapa();

        for (const servicio of lista) {
            const legacyId = String(servicio?.id || "");
            if (!legacyId || mapa[legacyId]) continue;

            try {
                if (typeof window.haikuMigrarServicioLegacySupabase === "function") {
                    const id = await window.haikuMigrarServicioLegacySupabase(servicio);
                    if (id) mapa[legacyId] = id;
                }
            } catch (error) {
                console.warn("HAIKU · Servicios V2: no se pudo resolver servicio", legacyId, error);
            }
        }

        return mapa;
    }

    async function sincronizarFinanzasServicios() {
        if (sincronizando) return;
        sincronizando = true;

        try {
            const lista = listaLegacy();
            if (!lista.length) return;

            const mapa = await asegurarIdsSupabase(lista);
            const ids = [...new Set(
                lista
                    .map(s => mapa[String(s?.id || "")])
                    .filter(Boolean)
            )];

            if (!ids.length) return;

            const { data: serviciosDb, error: errorServicios } = await cliente
                .from("servicios")
                .select("id,estado_servicio,total,tipo_cobro")
                .in("id", ids);

            if (errorServicios) throw errorServicios;

            const { data: cargos, error: errorCargos } = await cliente
                .from("cargos")
                .select("id,servicio_id,monto,estado")
                .in("servicio_id", ids)
                .eq("estado", "activo");

            if (errorCargos) throw errorCargos;

            const cargoIds = (cargos || []).map(c => c.id);
            let aplicaciones = [];
            let pagos = [];

            if (cargoIds.length) {
                const { data: apps, error: errorApps } = await cliente
                    .from("pago_aplicaciones")
                    .select("cargo_id,pago_id,monto_aplicado")
                    .in("cargo_id", cargoIds);

                if (errorApps) throw errorApps;
                aplicaciones = apps || [];

                const pagoIds = [...new Set(aplicaciones.map(a => a.pago_id).filter(Boolean))];
                if (pagoIds.length) {
                    const { data: pagosDb, error: errorPagos } = await cliente
                        .from("pagos")
                        .select("id,estado")
                        .in("id", pagoIds);

                    if (errorPagos) throw errorPagos;
                    pagos = pagosDb || [];
                }
            }

            const servicioDbPorId = new Map((serviciosDb || []).map(s => [s.id, s]));
            const cargosPorServicio = new Map();
            (cargos || []).forEach(c => {
                if (!cargosPorServicio.has(c.servicio_id)) cargosPorServicio.set(c.servicio_id, []);
                cargosPorServicio.get(c.servicio_id).push(c);
            });

            const estadoPagoPorId = new Map((pagos || []).map(p => [p.id, p.estado]));
            const appsPorCargo = new Map();
            aplicaciones.forEach(a => {
                if (!appsPorCargo.has(a.cargo_id)) appsPorCargo.set(a.cargo_id, []);
                appsPorCargo.get(a.cargo_id).push(a);
            });

            let huboCambios = false;

            lista.forEach(servicio => {
                const idDb = mapa[String(servicio?.id || "")];
                if (!idDb) return;

                const filaDb = servicioDbPorId.get(idDb);
                if (!filaDb) return;

                const estadoOperativo = filaDb.estado_servicio || "programado";
                const estadoLegacyOperativo = estadoOperativo === "realizado"
                    ? "realizado"
                    : "pendiente";

                if (servicio.estadoServicio !== estadoLegacyOperativo && estadoOperativo !== "cancelado") {
                    servicio.estadoServicio = estadoLegacyOperativo;
                    huboCambios = true;
                }

                const esCortesia = filaDb.tipo_cobro === "cortesia" || Number(filaDb.total || 0) === 0;
                let nuevoEstadoPago = esCortesia ? "no-corresponde" : "pendiente";

                if (!esCortesia) {
                    const cargosServicio = cargosPorServicio.get(idDb) || [];
                    const totalCargo = cargosServicio.reduce((sum, c) => sum + Number(c.monto || 0), 0);
                    let totalPagado = 0;

                    cargosServicio.forEach(cargo => {
                        const apps = appsPorCargo.get(cargo.id) || [];
                        apps.forEach(app => {
                            if (estadoPagoPorId.get(app.pago_id) === "confirmado") {
                                totalPagado += Number(app.monto_aplicado || 0);
                            }
                        });
                    });

                    if (totalCargo > 0 && totalPagado >= totalCargo) {
                        nuevoEstadoPago = "pagado";
                    }
                }

                if (servicio.estadoPago !== nuevoEstadoPago) {
                    servicio.estadoPago = nuevoEstadoPago;
                    huboCambios = true;
                }
            });

            if (huboCambios) {
                guardarLegacy(lista);

                if (typeof window.renderizarAgendaServicios === "function") {
                    window.renderizarAgendaServicios();
                } else if (typeof renderizarAgendaServicios === "function") {
                    renderizarAgendaServicios();
                }
            }

            ocultarAccionesPagoManual();

            console.info("HAIKU · Servicios V2: estados financieros sincronizados desde Supabase.");
        } catch (error) {
            console.error("HAIKU · Servicios V2: no fue posible sincronizar finanzas", error);
        } finally {
            sincronizando = false;
        }
    }

    function programar(delay = 120) {
        clearTimeout(temporizador);
        temporizador = setTimeout(sincronizarFinanzasServicios, delay);
    }

    document.addEventListener("click", event => {
        if (event.target.closest('[data-seccion="servicios"], [data-ir-seccion="servicios"]')) {
            programar(180);
        }
    });

    document.addEventListener("haiku:servicio-supabase-cambiado", () => programar(100));
    window.addEventListener("focus", () => {
        const seccion = document.getElementById("seccion-servicios");
        if (seccion && !seccion.classList.contains("oculto") && seccion.style.display !== "none") {
            programar(80);
        }
    });

    window.haikuSincronizarFinanzasServicios = sincronizarFinanzasServicios;

    ocultarAccionesPagoManual();
    setTimeout(() => programar(0), 500);

    console.info("HAIKU · Servicios Finanzas Supabase V2 preparado.");
})();
