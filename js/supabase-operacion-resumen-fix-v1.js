// ========================================
// HAIKU · OPERACIÓN RESUMEN FIX V2
// Rehidrata estados del Resumen desde Supabase después de bloqueos/liberaciones
// y cada vez que cambia la fecha seleccionada.
// Evita que filas libres queden en "Seleccionar" por un refresco legacy vacío.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let sincronizando = false;
    let canal = null;
    let timer = null;
    let timerSegundaPasada = null;
    let ultimaFechaVista = "";
    let fechaPendiente = "";

    function fechaActual() {
        try {
            return String(fechaSeleccionada || "").slice(0, 10);
        } catch (_) {
            return "";
        }
    }

    function titularPrincipal(fila) {
        switch (fila?.estado_operativo) {
            case "sale-ingresa":
            case "libre-ingresa":
                return fila.ingreso_titular || "Sin titular";
            case "sale-libre":
                return fila.salida_titular || "Sin titular";
            case "continua":
                return fila.continua_titular || "Sin titular";
            case "fullday":
                return fila.fullday_titular || "Sin titular";
            case "bloqueada":
                return "BLOQUEADA";
            default:
                return "Sin titular";
        }
    }

    function leerCache() {
        try {
            return JSON.parse(localStorage.getItem("haikuDatos") || "{}") || {};
        } catch (_) {
            return {};
        }
    }

    function asegurarDia(datos, fecha) {
        if (!datos[fecha]) {
            datos[fecha] = {
                encargado: "",
                notas: "",
                notasOperativas: [],
                cabanas: {},
                servicios: [],
                pagos: [],
                mantencion: [],
                lavanderia: []
            };
        }
        if (!datos[fecha].cabanas) datos[fecha].cabanas = {};
        return datos[fecha];
    }

    function guardarCache(datos) {
        try {
            localStorage.setItem("haikuDatos", JSON.stringify(datos));
        } catch (_) {}

        try {
            if (typeof datosPorFecha !== "undefined") {
                datosPorFecha = datos;
            }
        } catch (_) {}
    }

    function aplicarFilaVisual(fila) {
        const numero = String(fila?.numero || "");
        if (!numero) return;

        const tr = document.querySelector(
            `#seccion-resumen [data-cabana="${numero}"]`
        );
        if (!tr) return;

        const estadoReal = fila.estado_operativo || "libre-libre";
        const selector = tr.querySelector('[data-campo="estado"]');
        if (selector) {
            const existe = Array.from(selector.options || []).some(
                opcion => opcion.value === estadoReal
            );
            if (existe) selector.value = estadoReal;
        }

        const titular = tr.querySelector(`[data-titular-cabana="${numero}"]`);
        if (titular) titular.textContent = titularPrincipal(fila);

        tr.classList.remove(
            "cabana-checkout",
            "cabana-checkin",
            "cabana-libre",
            "cabana-ingresa",
            "cabana-bloqueada"
        );

        if (estadoReal === "bloqueada") {
            tr.classList.add("cabana-bloqueada");
        } else if (["libre-ingresa", "sale-ingresa"].includes(estadoReal)) {
            tr.classList.add("cabana-ingresa");
        } else {
            tr.classList.add("cabana-libre");
        }
    }

    async function refrescar(fechaForzada = "") {
        const fecha = String(fechaForzada || fechaActual()).slice(0, 10);
        if (!fecha || !window.haikuSesion) return;

        if (sincronizando) {
            fechaPendiente = fecha;
            return;
        }

        sincronizando = true;
        try {
            const { data, error } = await cliente.rpc(
                "haiku_operacion_dia",
                { p_fecha: fecha }
            );
            if (error) throw error;

            const filas = Array.isArray(data) ? data : [];
            const cache = leerCache();
            const dia = asegurarDia(cache, fecha);

            filas.forEach(fila => {
                const numero = String(fila.numero || "");
                if (!numero) return;

                const anterior = dia.cabanas[numero] || {};
                const estadoReal = fila.estado_operativo || "libre-libre";
                const titular = titularPrincipal(fila);

                dia.cabanas[numero] = {
                    ...anterior,
                    estado: estadoReal,
                    titular: titular === "Sin titular" || titular === "BLOQUEADA"
                        ? ""
                        : titular
                };

                // Solo pintamos la pantalla si el usuario sigue mirando
                // la misma fecha que acabamos de consultar.
                if (fechaActual() === fecha) {
                    aplicarFilaVisual(fila);
                }
            });

            guardarCache(cache);
            ultimaFechaVista = fecha;

            console.info(
                "HAIKU · Estados del Resumen rehidratados desde Supabase:",
                fecha,
                filas.length,
                "cabañas"
            );
        } catch (error) {
            console.warn(
                "HAIKU · No fue posible rehidratar estados del Resumen:",
                error
            );
        } finally {
            sincronizando = false;

            const pendiente = fechaPendiente;
            fechaPendiente = "";

            if (pendiente && pendiente !== fecha) {
                setTimeout(() => refrescar(pendiente), 30);
            }
        }
    }

    function programar(ms = 120, fechaForzada = "") {
        clearTimeout(timer);
        timer = setTimeout(() => refrescar(fechaForzada), ms);
    }

    function programarCambioFecha(fecha) {
        if (!fecha) return;

        // Primera pasada: apenas termina la navegación legacy.
        programar(80, fecha);

        // Segunda pasada: corrige cualquier repaint legacy tardío.
        clearTimeout(timerSegundaPasada);
        timerSegundaPasada = setTimeout(() => {
            if (fechaActual() === fecha) {
                refrescar(fecha);
            }
        }, 420);
    }

    function revisarCambioFecha() {
        const fecha = fechaActual();
        if (!fecha || fecha === ultimaFechaVista) return;

        ultimaFechaVista = fecha;
        programarCambioFecha(fecha);
    }

    function instalarRealtime() {
        if (canal || !window.haikuSesion) return;

        canal = cliente
            .channel("haiku-operacion-resumen-fix-v2")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "bloqueos_cabana"
                },
                () => programarCambioFecha(fechaActual())
            );

        canal.subscribe();
    }

    document.addEventListener(
        "click",
        evento => {
            if (evento.target?.closest?.(".dia-calendario")) {
                // El handler legacy cambia fechaSeleccionada durante este mismo click.
                setTimeout(revisarCambioFecha, 20);
                setTimeout(revisarCambioFecha, 120);
                return;
            }

            if (
                evento.target?.closest?.('[data-seccion="resumen"]') ||
                evento.target?.closest?.(".haiku-bloqueo-liberar-confirmar")
            ) {
                programarCambioFecha(fechaActual());
            }
        },
        true
    );

    window.addEventListener("haiku:auth-ready", () => {
        setTimeout(() => {
            instalarRealtime();
            ultimaFechaVista = "";
            revisarCambioFecha();
        }, 100);
    });

    window.addEventListener("pageshow", () => {
        setTimeout(() => {
            ultimaFechaVista = "";
            revisarCambioFecha();
        }, 120);
    });

    window.addEventListener("focus", () => {
        setTimeout(() => programarCambioFecha(fechaActual()), 120);
    });

    // Protección adicional: detecta cambios de fecha hechos por cualquier
    // otro módulo, incluso si no provienen de un click del calendario.
    setInterval(revisarCambioFecha, 250);

    setTimeout(() => {
        if (window.haikuSesion) {
            instalarRealtime();
            ultimaFechaVista = "";
            revisarCambioFecha();
        }
    }, 220);

    window.HAIKU_OPERACION_RESUMEN_FIX_V1 = Object.freeze({
        refrescar,
        revisarCambioFecha
    });
})();
