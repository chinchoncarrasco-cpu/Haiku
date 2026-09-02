// ========================================
// HAIKU · BLOQUEOS CALENDARIO SUPABASE V1
// Migra y sincroniza bloqueos legacy sin reescribir calendario.js.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let sincronizando = false;
    let canal = null;
    let temporizador = null;

    function fechaActual() {
        try {
            return String(fechaSeleccionada || "").slice(0, 10);
        } catch (_) {
            return "";
        }
    }

    function leerDatosLegacy() {
        try {
            return JSON.parse(localStorage.getItem("haikuDatos") || "{}") || {};
        } catch (_) {
            return {};
        }
    }

    function escribirDatosLegacy(datos) {
        try {
            localStorage.setItem("haikuDatos", JSON.stringify(datos));
        } catch (_) {}

        try {
            if (typeof datosPorFecha !== "undefined") {
                datosPorFecha = datos;
            }
        } catch (_) {}
    }

    function sumarDia(fecha) {
        const [a, m, d] = String(fecha).split("-").map(Number);
        const base = new Date(a, m - 1, d, 12, 0, 0);
        base.setDate(base.getDate() + 1);
        return [
            base.getFullYear(),
            String(base.getMonth() + 1).padStart(2, "0"),
            String(base.getDate()).padStart(2, "0")
        ].join("-");
    }

    function extraerBloqueosLegacy(datos) {
        const mapa = new Map();

        Object.entries(datos || {}).forEach(([fecha, dia]) => {
            if (!dia?.cabanas) return;

            Object.entries(dia.cabanas).forEach(([numero, cabana]) => {
                if (
                    String(cabana?.estado || "").toLowerCase() !== "bloqueada"
                ) {
                    return;
                }

                const desde = String(
                    cabana.bloqueoFechaInicio || fecha
                ).slice(0, 10);

                const hasta = String(
                    cabana.bloqueoFechaFin || sumarDia(fecha)
                ).slice(0, 10);

                const idLegacy = String(
                    cabana.bloqueoId || `BLQ-LEGACY-${numero}-${desde}-${hasta}`
                );

                const clave = `${idLegacy}::${numero}`;

                if (!mapa.has(clave)) {
                    mapa.set(clave, {
                        clave,
                        idLegacy,
                        numero: Number(numero),
                        desde,
                        hasta,
                        motivo: String(cabana.bloqueoMotivo || "").trim(),
                        fechas: []
                    });
                }

                mapa.get(clave).fechas.push(fecha);
            });
        });

        return [...mapa.values()].filter(item =>
            item.numero > 0 &&
            item.desde &&
            item.hasta &&
            item.hasta > item.desde
        );
    }

    function marcarSincronizado(datos, bloqueo, resultado) {
        const idSupabase = String(resultado?.bloqueo_id || "");

        (bloqueo.fechas || []).forEach(fecha => {
            const cabana = datos?.[fecha]?.cabanas?.[String(bloqueo.numero)];
            if (!cabana) return;

            cabana.bloqueoSincronizadoSupabase = true;
            cabana.bloqueoSupabaseId = idSupabase;
        });
    }

    function aplicarBloqueoVisual(numero, motivo = "") {
        const fila = document.querySelector(
            `#seccion-resumen [data-cabana="${String(numero)}"]`
        );

        if (!fila) return;

        const selector = fila.querySelector('[data-campo="estado"]');
        if (selector) selector.value = "bloqueada";

        const titular = fila.querySelector(
            `[data-titular-cabana="${String(numero)}"]`
        );
        if (titular) titular.textContent = "BLOQUEADA";

        fila.classList.remove(
            "cabana-checkout",
            "cabana-checkin",
            "cabana-libre",
            "cabana-ingresa"
        );
        fila.classList.add("cabana-bloqueada");

        if (motivo) fila.title = `Bloqueada · ${motivo}`;
    }

    function aplicarBloqueosLegacyFechaActual() {
        const fecha = fechaActual();
        if (!fecha) return;

        const datos = leerDatosLegacy();
        const cabanas = datos?.[fecha]?.cabanas || {};

        Object.entries(cabanas).forEach(([numero, cabana]) => {
            if (
                String(cabana?.estado || "").toLowerCase() === "bloqueada"
            ) {
                aplicarBloqueoVisual(numero, cabana.bloqueoMotivo || "");
            }
        });
    }

    async function refrescarBloqueosDesdeSupabase() {
        const fecha = fechaActual();
        if (!fecha || !window.haikuSesion) return;

        try {
            const { data, error } = await cliente.rpc(
                "haiku_operacion_dia",
                { p_fecha: fecha }
            );

            if (error) throw error;

            const bloqueadas = (data || []).filter(
                fila => fila.estado_operativo === "bloqueada"
            );

            if (bloqueadas.length === 0) return;

            const datos = leerDatosLegacy();
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

            bloqueadas.forEach(fila => {
                const numero = String(fila.numero);
                const anterior = datos[fecha].cabanas[numero] || {};

                datos[fecha].cabanas[numero] = {
                    ...anterior,
                    estado: "bloqueada",
                    bloqueoSincronizadoSupabase: true,
                    bloqueoSupabaseId: fila.bloqueo_id || anterior.bloqueoSupabaseId || "",
                    bloqueoMotivo: fila.bloqueo_motivo || anterior.bloqueoMotivo || ""
                };

                aplicarBloqueoVisual(numero, fila.bloqueo_motivo || "");
            });

            escribirDatosLegacy(datos);
        } catch (error) {
            console.warn(
                "HAIKU · No fue posible refrescar bloqueos desde Supabase:",
                error
            );
        }
    }

    async function sincronizarBloqueosLegacy() {
        if (sincronizando || !window.haikuSesion) return;
        sincronizando = true;

        try {
            const datos = leerDatosLegacy();
            const bloqueos = extraerBloqueosLegacy(datos);

            for (const bloqueo of bloqueos) {
                const primeraFecha = bloqueo.fechas?.[0];
                const cabanaPrimera =
                    datos?.[primeraFecha]?.cabanas?.[String(bloqueo.numero)];

                if (cabanaPrimera?.bloqueoSincronizadoSupabase === true) {
                    continue;
                }

                const { data, error } = await cliente.rpc(
                    "haiku_registrar_bloqueo_calendario",
                    {
                        p_cabana_numero: bloqueo.numero,
                        p_desde: bloqueo.desde,
                        p_hasta: bloqueo.hasta,
                        p_motivo: bloqueo.motivo || null
                    }
                );

                if (error) {
                    console.warn(
                        `HAIKU · No fue posible sincronizar bloqueo CAB ${bloqueo.numero}:`,
                        error
                    );
                    continue;
                }

                marcarSincronizado(datos, bloqueo, data || {});
            }

            escribirDatosLegacy(datos);
            aplicarBloqueosLegacyFechaActual();
            await refrescarBloqueosDesdeSupabase();

            console.info(
                "HAIKU · Bloqueos de Calendario sincronizados con Supabase."
            );
        } catch (error) {
            console.error(
                "HAIKU · Error sincronizando bloqueos de Calendario:",
                error
            );
        } finally {
            sincronizando = false;
        }
    }

    function programar(retraso = 80) {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => {
            sincronizarBloqueosLegacy();
        }, retraso);
    }

    function instalarRealtime() {
        if (canal || !window.haikuSesion) return;

        canal = cliente
            .channel("haiku-bloqueos-calendario-v1")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "bloqueos_cabana"
                },
                () => setTimeout(refrescarBloqueosDesdeSupabase, 100)
            );

        canal.subscribe(estado => {
            if (estado === "SUBSCRIBED") {
                console.info(
                    "HAIKU · Bloqueos Calendario Realtime conectado."
                );
            }
        });
    }

    function iniciar() {
        if (!window.haikuSesion) return;

        instalarRealtime();
        aplicarBloqueosLegacyFechaActual();
        programar(30);
    }

    document.addEventListener(
        "click",
        evento => {
            if (
                evento.target?.closest?.("#confirmar-bloqueo-calendario")
            ) {
                programar(30);
                return;
            }

            if (
                evento.target?.closest?.('[data-seccion="resumen"]') ||
                evento.target?.closest?.('[data-seccion="calendario"]')
            ) {
                setTimeout(() => {
                    aplicarBloqueosLegacyFechaActual();
                    refrescarBloqueosDesdeSupabase();
                }, 50);
            }
        },
        true
    );

    window.addEventListener("haiku:auth-ready", () => setTimeout(iniciar, 60));
    window.addEventListener("pageshow", () => setTimeout(iniciar, 40));
    window.addEventListener("focus", () => setTimeout(refrescarBloqueosDesdeSupabase, 80));

    setTimeout(iniciar, 150);

    window.HAIKU_BLOQUEOS_CALENDARIO_SUPABASE_V1 = Object.freeze({
        sincronizar: sincronizarBloqueosLegacy,
        refrescar: refrescarBloqueosDesdeSupabase
    });
})();
