// ========================================
// HAIKU · ASEO REALTIME MULTIDISPOSITIVO V1
// Refresca Aseo + revisión cuando Supabase cambia desde otro dispositivo.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let canal = null;
    let timer = null;
    let refrescando = false;
    let refrescoPendiente = false;

    function fechaActual() {
        try {
            return typeof fechaSeleccionada !== "undefined"
                ? String(fechaSeleccionada || "").slice(0, 10)
                : "";
        } catch (_) {
            return "";
        }
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

            // Aseo puede estar terminando una hidratación anterior. La segunda
            // pasada garantiza que leamos el cambio que disparó Realtime.
            if (apiAseo?.hidratar) {
                await apiAseo.hidratar(fecha, { pintar: false });
                await apiAseo.hidratar(fecha, { pintar: true });
            }

            // La sincronización de revisiones ya tiene su propia cola de
            // escrituras. Repetimos tras una pausa corta para cubrir el caso
            // en que otra lectura antigua estaba terminando al mismo tiempo.
            if (apiRevision?.resincronizar) {
                await apiRevision.resincronizar();
                await esperar(120);
                await apiRevision.resincronizar();
            }

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
        const tabla = payload?.table || payload?.schema || "operacion";
        console.info("HAIKU · Cambio Realtime recibido:", tabla);
        programarRefresco(90);
    }

    async function desconectar() {
        if (!canal) return;
        try {
            await cliente.removeChannel(canal);
        } catch (_) {}
        canal = null;
    }

    async function conectar() {
        if (!window.haikuSesion) return;
        if (canal) return;

        canal = cliente
            .channel("haiku-aseo-operacion-v1")
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
                if (status === "SUBSCRIBED") {
                    console.info("HAIKU · Aseo Realtime conectado.");
                    programarRefresco(0);
                }
            });
    }

    window.addEventListener("haiku:auth-ready", () => {
        conectar();
        programarRefresco(120);
    });

    window.addEventListener("focus", () => {
        if (window.haikuSesion) programarRefresco(70);
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && window.haikuSesion) {
            programarRefresco(70);
        }
    });

    cliente.auth.onAuthStateChange(evento => {
        if (evento === "SIGNED_OUT") {
            desconectar();
        }
    });

    window.HAIKU_ASEO_REALTIME_V1 = Object.freeze({
        refrescar: refrescarDesdeSupabase,
        reconectar: async () => {
            await desconectar();
            await conectar();
        }
    });

    if (window.haikuSesion) {
        conectar();
        programarRefresco(100);
    }

    console.info("HAIKU · Aseo Realtime V1 preparado.");
})();
