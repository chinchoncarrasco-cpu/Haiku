// ========================================
// HAIKU · PAGOS PENDIENTES SUPABASE V1
// Una sola verdad financiera para contador, resumen rápido y campana.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    const cachePorFecha = new Map();
    const cargasPorFecha = new Map();

    let canal = null;
    let fechaVisible = "";
    let temporizador = null;

    function fechaActual() {
        try {
            return String(fechaSeleccionada || "").slice(0, 10);
        } catch (_) {
            return "";
        }
    }

    function claveReserva(fila, tipo) {
        if (tipo === "ingreso") {
            if (fila.estado_operativo === "fullday") {
                return {
                    reservaId: fila.fullday_reserva_id,
                    titular: fila.fullday_titular
                };
            }

            return {
                reservaId: fila.ingreso_reserva_id,
                titular: fila.ingreso_titular
            };
        }

        if (fila.estado_operativo === "fullday") {
            return {
                reservaId: fila.fullday_reserva_id,
                titular: fila.fullday_titular
            };
        }

        return {
            reservaId: fila.salida_reserva_id,
            titular: fila.salida_titular
        };
    }

    function operacionesDelDia(filas) {
        const ingresos = [];
        const salidas = [];

        (filas || []).forEach(fila => {
            if (
                ["libre-ingresa", "sale-ingresa", "fullday"]
                    .includes(fila.estado_operativo)
            ) {
                const ingreso = claveReserva(fila, "ingreso");
                if (ingreso.reservaId) {
                    ingresos.push({
                        numeroCabana: String(fila.numero),
                        reservaId: ingreso.reservaId,
                        titular: ingreso.titular || "Sin titular"
                    });
                }
            }

            if (
                ["sale-libre", "sale-ingresa", "fullday"]
                    .includes(fila.estado_operativo)
            ) {
                const salida = claveReserva(fila, "salida");
                if (salida.reservaId) {
                    salidas.push({
                        numeroCabana: String(fila.numero),
                        reservaId: salida.reservaId,
                        titular: salida.titular || "Sin titular"
                    });
                }
            }
        });

        return { ingresos, salidas };
    }

    function sumarSaldos(cargos, tipoCargo) {
        const saldos = new Map();

        (cargos || [])
            .filter(cargo =>
                cargo.estado === "activo" &&
                cargo.tipo_cargo === tipoCargo
            )
            .forEach(cargo => {
                const actual = Number(
                    saldos.get(cargo.reserva_id) || 0
                );
                saldos.set(
                    cargo.reserva_id,
                    actual + Number(cargo.saldo_cargo || 0)
                );
            });

        return saldos;
    }

    function ordenarPendientes(pendientes) {
        return pendientes.sort((a, b) => {
            const cabana =
                Number(a.numeroCabana) - Number(b.numeroCabana);

            if (cabana !== 0) return cabana;
            return String(a.tipo).localeCompare(String(b.tipo));
        });
    }

    function obtener(fecha = fechaActual()) {
        return (cachePorFecha.get(String(fecha).slice(0, 10)) || [])
            .map(item => ({ ...item }));
    }

    function estaListo(fecha = fechaActual()) {
        return cachePorFecha.has(String(fecha).slice(0, 10));
    }

    function actualizarPantalla(fecha, pendientes) {
        if (fecha !== fechaActual()) return;

        const contador = document.getElementById("contador-pagos");
        if (contador) contador.textContent = String(pendientes.length);

        try {
            if (typeof generarResumenOperativo === "function") {
                generarResumenOperativo(fecha);
            }
        } catch (_) {}

        const panel = document.getElementById("panel-notificaciones");
        if (panel && !panel.hidden) {
            try {
                if (typeof actualizarNotificaciones === "function") {
                    actualizarNotificaciones();
                }
            } catch (_) {}
        }
    }

    async function cargar(fecha = fechaActual()) {
        const fechaISO = String(fecha || "").slice(0, 10);
        if (!fechaISO || !window.haikuSesion) return [];

        if (cargasPorFecha.has(fechaISO)) {
            return cargasPorFecha.get(fechaISO);
        }

        const carga = (async () => {
            const { data: filas, error: errorOperacion } =
                await cliente.rpc(
                    "haiku_operacion_dia",
                    { p_fecha: fechaISO }
                );

            if (errorOperacion) throw errorOperacion;

            const { ingresos, salidas } = operacionesDelDia(filas);
            const ids = [
                ...new Set(
                    [...ingresos, ...salidas]
                        .map(item => item.reservaId)
                        .filter(Boolean)
                )
            ];

            if (ids.length === 0) {
                cachePorFecha.set(fechaISO, []);
                fechaVisible = fechaISO;
                actualizarPantalla(fechaISO, []);
                return [];
            }

            const [cargosR, reservasR] = await Promise.all([
                cliente
                    .from("vista_estado_cargos")
                    .select(
                        "reserva_id,tipo_cargo,estado,saldo_cargo"
                    )
                    .in("reserva_id", ids),
                cliente
                    .from("reservas")
                    .select("id,bove_cierre")
                    .in("id", ids)
            ]);

            if (cargosR.error) throw cargosR.error;
            if (reservasR.error) throw reservasR.error;

            const cargos = cargosR.data || [];
            const saldoAlojamiento = sumarSaldos(
                cargos,
                "alojamiento"
            );
            const saldoServicios = sumarSaldos(cargos, "servicio");
            const reservas = new Map(
                (reservasR.data || []).map(item => [item.id, item])
            );
            const pendientes = [];

            ingresos.forEach(item => {
                if (!saldoAlojamiento.has(item.reservaId)) return;

                const saldo = Number(
                    saldoAlojamiento.get(item.reservaId) || 0
                );

                if (saldo > 0) {
                    pendientes.push({
                        tipo: "checkin",
                        numeroCabana: item.numeroCabana,
                        reservaId: item.reservaId,
                        titular: item.titular,
                        titulo: "Cobro check-in pendiente",
                        monto: saldo
                    });
                    return;
                }

                if (!reservas.get(item.reservaId)?.bove_cierre) {
                    pendientes.push({
                        tipo: "bove",
                        numeroCabana: item.numeroCabana,
                        reservaId: item.reservaId,
                        titular: item.titular,
                        titulo: "BOVE alojamiento pendiente",
                        monto: 0
                    });
                }
            });

            salidas.forEach(item => {
                const saldo = Number(
                    saldoServicios.get(item.reservaId) || 0
                );

                if (saldo <= 0) return;

                pendientes.push({
                    tipo: "servicio",
                    numeroCabana: item.numeroCabana,
                    reservaId: item.reservaId,
                    titular: item.titular,
                    titulo: "Servicios pendientes de pago",
                    monto: saldo
                });
            });

            const resultado = ordenarPendientes(pendientes);
            cachePorFecha.set(fechaISO, resultado);
            fechaVisible = fechaISO;
            actualizarPantalla(fechaISO, resultado);

            console.info(
                "HAIKU · Pagos pendientes sincronizados desde Supabase:",
                { fecha: fechaISO, pendientes: resultado }
            );

            return obtener(fechaISO);
        })();

        cargasPorFecha.set(fechaISO, carga);

        try {
            return await carga;
        } catch (error) {
            console.error(
                "HAIKU · No fue posible calcular pagos pendientes:",
                error
            );
            throw error;
        } finally {
            cargasPorFecha.delete(fechaISO);
        }
    }

    function programar(retraso = 100) {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => {
            cargar(fechaActual()).catch(() => {});
        }, retraso);
    }

    function instalarRealtime() {
        if (canal || !window.haikuSesion) return;

        canal = cliente.channel("haiku-pagos-pendientes-v1");

        [
            "pagos",
            "pago_aplicaciones",
            "cargos",
            "reservas",
            "reserva_estadias"
        ].forEach(tabla => {
            canal.on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: tabla
                },
                () => programar(120)
            );
        });

        canal.subscribe(estado => {
            if (estado === "SUBSCRIBED") {
                console.info(
                    "HAIKU · Pagos pendientes Realtime conectado."
                );
            }
        });
    }

    function iniciar() {
        if (!window.haikuSesion) return;
        instalarRealtime();
        cargar(fechaActual()).catch(() => {});
    }

    window.HAIKU_PAGOS_PENDIENTES_SUPABASE_V1 = Object.freeze({
        obtener,
        estaListo,
        refrescar: cargar
    });

    window.addEventListener("haiku:auth-ready", iniciar);
    window.addEventListener("online", () => programar(0));
    window.addEventListener("focus", () => programar(0));
    window.addEventListener("pageshow", () => programar(0));

    document.addEventListener("click", () => {
        setTimeout(() => {
            const fecha = fechaActual();
            if (fecha && fecha !== fechaVisible) {
                cargar(fecha).catch(() => {});
            }
        }, 0);
    }, true);

    if (window.haikuSesion) iniciar();
})();
