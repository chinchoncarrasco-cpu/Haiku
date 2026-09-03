// ========================================
// HAIKU · SERVICIOS · MINUTERO V1
// El color indica el estado temporal; el texto informa tiempo real.
// ========================================
(() => {
    "use strict";

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

    function relojChile() {
        const partes = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Santiago",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }).formatToParts(new Date());
        const p = Object.fromEntries(partes.map(x => [x.type, x.value]));
        return {
            fecha: `${p.year}-${p.month}-${p.day}`,
            minutos: Number(p.hour || 0) * 60 + Number(p.minute || 0)
        };
    }

    function minutosHora(valor) {
        const [h, m] = String(valor || "").slice(0, 5).split(":").map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return h * 60 + m;
    }

    function duracion(servicio) {
        const inicio = minutosHora(servicio?.hora);
        const fin = minutosHora(servicio?.horaFin);
        if (inicio !== null && fin !== null && fin > inicio) return fin - inicio;

        const directa = Number(servicio?.duracionMinutos || 0);
        if (directa > 0) return directa;

        if (String(servicio?.categoria || "") === "tinaja") {
            return Math.max(1, Number(servicio?.cantidad || 1)) * 60;
        }
        return 60;
    }

    function estadoOperativo(servicio) {
        return String(servicio?.estadoServicioDb || servicio?.estadoServicio || "");
    }

    function textoTiempo(servicio) {
        const estado = estadoOperativo(servicio);
        if (["cancelado", "cancelada", "no_show"].includes(estado)) return "Cancelada";
        if (["realizado", "completada"].includes(estado)) return "Completada";

        const reloj = relojChile();
        const fecha = String(servicio?.fechaServicio || servicio?.fecha || "").slice(0, 10);
        const inicio = minutosHora(servicio?.hora);
        if (!fecha || inicio === null || fecha !== reloj.fecha) return "";

        const fin = inicio + duracion(servicio);
        const hastaInicio = inicio - reloj.minutos;

        if (hastaInicio > 0) {
            return hastaInicio <= 60 ? `En ${hastaInicio} min` : "";
        }

        if (reloj.minutos < fin) {
            const transcurridos = Math.max(0, reloj.minutos - inicio);
            if (transcurridos === 0) return "Comenzó ahora";
            return `${transcurridos} min desde que comenzó`;
        }

        const desdeFin = Math.max(0, reloj.minutos - fin);
        if (desdeFin === 0) return "Finaliza ahora";
        return `Terminó hace ${desdeFin} min`;
    }

    function servicioPorId(id) {
        return listaServicios().find(s => String(s?.id || "") === String(id || ""));
    }

    function fijarTexto(elemento, texto) {
        const oculto = !texto;
        if (elemento.textContent !== texto) elemento.textContent = texto;
        if (elemento.hidden !== oculto) elemento.hidden = oculto;
    }

    function aplicarNotificaciones() {
        document.querySelectorAll("#notificaciones-contenido .notificacion-reserva[data-servicio-id]")
            .forEach(item => {
                const servicio = servicioPorId(item.dataset.servicioId);
                if (!servicio) return;

                let etiqueta = item.querySelector(".haiku-notif-servicio-etiqueta");
                if (!etiqueta) {
                    etiqueta = document.createElement("span");
                    etiqueta.className = "haiku-notif-servicio-etiqueta";
                    item.appendChild(etiqueta);
                }

                fijarTexto(etiqueta, textoTiempo(servicio));
            });
    }

    function aplicarAgenda() {
        document.querySelectorAll("#servicios-agenda [data-haiku-servicio-id]")
            .forEach(item => {
                const servicio = servicioPorId(item.dataset.haikuServicioId);
                if (!servicio) return;

                const badge = item.querySelector(".haiku-servicio-estado-badge");
                if (!badge) return;

                const estado = estadoOperativo(servicio);
                const esCierre = ["cancelado", "cancelada", "no_show", "realizado", "completada"].includes(estado);
                const texto = esCierre
                    ? (["cancelado", "cancelada", "no_show"].includes(estado) ? "Cancelada" : "Completada")
                    : textoTiempo(servicio);

                fijarTexto(badge, texto);
            });
    }

    function aplicar() {
        aplicarNotificaciones();
        aplicarAgenda();
    }

    const style = document.createElement("style");
    style.id = "haiku-servicios-tiempo-v1-css";
    style.textContent = `
        .haiku-notif-servicio-etiqueta,
        .haiku-servicio-estado-badge {
            letter-spacing: 0 !important;
            text-transform: none !important;
        }
        .haiku-notif-servicio-etiqueta[hidden],
        .haiku-servicio-estado-badge[hidden] {
            display: none !important;
        }
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    document.addEventListener("haiku:servicios-hidratados", () => setTimeout(aplicar, 30));
    document.addEventListener("haiku:servicio-supabase-cambiado", () => setTimeout(aplicar, 80));
    document.addEventListener("click", evento => {
        if (evento.target.closest?.("#boton-notificaciones, [data-seccion='servicios']")) {
            setTimeout(aplicar, 50);
        }
    });

    const observer = new MutationObserver(() => setTimeout(aplicar, 0));
    const notif = document.getElementById("notificaciones-contenido");
    const agenda = document.getElementById("servicios-agenda");
    if (notif) observer.observe(notif, { childList: true, subtree: true });
    if (agenda) observer.observe(agenda, { childList: true, subtree: true });

    setInterval(aplicar, 30000);
    window.haikuTextoTiempoServicio = textoTiempo;
    setTimeout(aplicar, 900);

    console.info("HAIKU · Minutero de Servicios V1 preparado.");
})();