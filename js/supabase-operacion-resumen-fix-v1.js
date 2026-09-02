// ========================================
// HAIKU · OPERACIÓN RESUMEN FIX V1
// Rehidrata estados del Resumen desde Supabase después de bloqueos/liberaciones.
// Evita que filas libres queden en "Seleccionar" por un refresco legacy vacío.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let sincronizando = false;
    let canal = null;
    let timer = null;

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
        if (!fecha || !window.haikuSesion || sincronizando) return;

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

                aplicarFilaVisual(fila);
            });

            guardarCache(cache);

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
        }
    }

    function programar(ms = 120) {
        clearTimeout(timer);
        timer = setTimeout(() => refrescar(), ms);
    }

    function instalarRealtime() {
        if (canal || !window.haikuSesion) return;

        canal = cliente
            .channel("haiku-operacion-resumen-fix-v1")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "bloqueos_cabana"
                },
                () => programar(180)
            );

        canal.subscribe();
    }

    document.addEventListener(
        "click",
        evento => {
            if (
                evento.target?.closest?.('[data-seccion="resumen"]') ||
                evento.target?.closest?.(".haiku-bloqueo-liberar-confirmar")
            ) {
                programar(220);
            }
        },
        true
    );

    window.addEventListener("haiku:auth-ready", () => {
        setTimeout(() => {
            instalarRealtime();
            refrescar();
        }, 100);
    });

    window.addEventListener("pageshow", () => setTimeout(refrescar, 120));
    window.addEventListener("focus", () => setTimeout(refrescar, 120));

    setTimeout(() => {
        if (window.haikuSesion) {
            instalarRealtime();
            refrescar();
        }
    }, 220);

    window.HAIKU_OPERACION_RESUMEN_FIX_V1 = Object.freeze({ refrescar });
})();
