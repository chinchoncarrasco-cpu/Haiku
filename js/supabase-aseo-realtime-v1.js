// ========================================
// HAIKU · ASEO REALTIME MULTIDISPOSITIVO V1
// Refresca Aseo + revisión cuando Supabase cambia desde otro dispositivo.
// Incluye recuperación especial para navegadores móviles que suspenden WebSocket.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let canal = null;
    let estadoCanal = "DESCONECTADO";
    let timer = null;
    let timerReconexion = null;
    let refrescando = false;
    let refrescoPendiente = false;
    let reconectando = false;
    let ultimoEvento = 0;
    let ultimoRefresco = 0;

    const esMovil = () =>
        window.matchMedia?.("(pointer: coarse)")?.matches ||
        window.innerWidth <= 768;

    function fechaActual() {
        try {
            return typeof fechaSeleccionada !== "undefined"
                ? String(fechaSeleccionada || "").slice(0, 10)
                : "";
        } catch (_) {
            return "";
        }
    }

    function aseoVisible() {
        const seccion = document.getElementById("seccion-aseo");
        return Boolean(
            !document.hidden &&
            seccion?.classList.contains("activa")
        );
    }

    function esperar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function refrescarDesdeSupabase() {
        if (!window.haikuSesion) return;

        if (refrescando) {
            refrescoPendiente = true;
            return;
        }

        refrescando = true;

        try {
            const fecha = fechaActual();
            if (!fecha) return;

            const apiAseo = window.HAIKU_ASEO_OPERACION_V1;
            const apiRevision = window.HAIKU_REVISION_RESUMEN_SYNC_V2;

            if (apiAseo?.hidratar) {
                await apiAseo.hidratar(fecha, { pintar: false });
                await apiAseo.hidratar(fecha, { pintar: true });
            }

            if (apiRevision?.resincronizar) {
                await apiRevision.resincronizar();
                await esperar(120);
                await apiRevision.resincronizar();
            }

            ultimoRefresco = Date.now();
            console.info("HAIKU · Aseo Realtime actualizado:", fecha);
        } catch (error) {
            console.error("HAIKU · No fue posible refrescar Aseo Realtime:", error);
        } finally {
            refrescando = false;

            if (refrescoPendiente) {
                refrescoPendiente = false;
                programarRefresco(80);
            }
        }
    }

    function programarRefresco(delay = 90) {
        clearTimeout(timer);
        timer = setTimeout(refrescarDesdeSupabase, delay);
    }

    function eventoRealtime(payload) {
        ultimoEvento = Date.now();
        const tabla = payload?.table || payload?.schema || "operacion";
        console.info("HAIKU · Cambio Realtime recibido:", tabla);
        programarRefresco(70);
    }

    async function desconectar() {
        clearTimeout(timerReconexion);

        const actual = canal;
        canal = null;
        estadoCanal = "DESCONECTADO";

        if (!actual) return;

        try {
            await cliente.removeChannel(actual);
        } catch (_) {}
    }

    function programarReconexion(delay = 350) {
        clearTimeout(timerReconexion);
        if (!window.haikuSesion) return;

        timerReconexion = setTimeout(async () => {
            if (!window.haikuSesion || reconectando) return;

            reconectando = true;
            try {
                await desconectar();
                await conectar();
            } finally {
                reconectando = false;
            }
        }, delay);
    }

    async function conectar() {
        if (!window.haikuSesion) return;
        if (canal && estadoCanal === "SUBSCRIBED") return;

        if (canal) {
            await desconectar();
        }

        estadoCanal = "CONECTANDO";

        canal = cliente
            .channel(`haiku-aseo-operacion-${Date.now()}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "aseos" },
                eventoRealtime
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "solicitudes" },
                eventoRealtime
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "revisiones_cabana" },
                eventoRealtime
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "revision_items" },
                eventoRealtime
            )
            .subscribe(status => {
                estadoCanal = status;

                if (status === "SUBSCRIBED") {
                    console.info("HAIKU · Aseo Realtime conectado.");
                    programarRefresco(0);
                    return;
                }

                if (
                    status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT" ||
                    status === "CLOSED"
                ) {
                    console.warn(
                        "HAIKU · Aseo Realtime perdió conexión:",
                        status
                    );
                    programarReconexion(300);
                }
            });
    }

    async function recuperarConexion() {
        if (!window.haikuSesion) return;

        // iOS/Android pueden conservar un canal que figura vivo aunque el
        // socket haya sido suspendido. Al volver a la app lo reconstruimos.
        if (esMovil()) {
            await desconectar();
            await conectar();
        } else if (estadoCanal !== "SUBSCRIBED") {
            await conectar();
        }

        programarRefresco(40);
    }

    window.addEventListener("haiku:auth-ready", () => {
        conectar();
        programarRefresco(100);
    });

    window.addEventListener("focus", () => {
        if (window.haikuSesion) recuperarConexion();
    });

    window.addEventListener("pageshow", () => {
        if (window.haikuSesion) recuperarConexion();
    });

    window.addEventListener("online", () => {
        if (window.haikuSesion) recuperarConexion();
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && window.haikuSesion) {
            recuperarConexion();
        }
    });

    cliente.auth.onAuthStateChange(evento => {
        if (evento === "SIGNED_OUT") {
            desconectar();
        }
    });

    // Respaldo móvil: mientras el usuario está mirando Aseo hacemos una
    // verificación liviana cada pocos segundos. Normalmente Realtime gana y
    // esta pasada no cambia nada; evita depender de F5 si el SO durmió el socket.
    setInterval(() => {
        if (!window.haikuSesion || !esMovil() || !aseoVisible()) return;

        const ahora = Date.now();
        if (ahora - ultimoRefresco > 3500 && ahora - ultimoEvento > 1200) {
            programarRefresco(0);
        }

        if (estadoCanal !== "SUBSCRIBED") {
            programarReconexion(0);
        }
    }, 2000);

    window.HAIKU_ASEO_REALTIME_V1 = Object.freeze({
        refrescar: refrescarDesdeSupabase,
        reconectar: recuperarConexion,
        estado() {
            return estadoCanal;
        }
    });

    if (window.haikuSesion) {
        conectar();
        programarRefresco(100);
    }

    console.info("HAIKU · Aseo Realtime V1 preparado.");
})();
