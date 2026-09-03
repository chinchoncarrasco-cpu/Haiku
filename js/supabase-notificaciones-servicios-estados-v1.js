// ========================================
// HAIKU · NOTIFICACIONES · SERVICIOS DEL DÍA V1
// Hace visible en la campana la dinámica completa:
// Actual / Próxima / Pendiente / Completada / Cancelada.
// ========================================
(() => {
    "use strict";

    let timer = null;

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

    function fechaVista() {
        try { return String(fechaSeleccionada || "").slice(0, 10); }
        catch { return ""; }
    }

    function esc(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function estado(servicio, listaDia) {
        try {
            if (typeof window.haikuEstadoTemporalServicio === "function") {
                return window.haikuEstadoTemporalServicio(servicio, listaDia);
            }
        } catch {}

        const bruto = String(servicio?.estadoServicioDb || servicio?.estadoServicio || "");
        if (["cancelado", "cancelada", "no_show"].includes(bruto)) {
            return { clave: "cancelada", etiqueta: "Cancelada" };
        }
        if (["realizado", "completada"].includes(bruto)) {
            return { clave: "completada", etiqueta: "Completada" };
        }
        return { clave: "pendiente", etiqueta: "Pendiente" };
    }

    function abrirFichaServicio(item) {
        const numeroCabana = item?.dataset?.cabana || "";
        const fechaServicio = item?.dataset?.fecha || "";
        if (!numeroCabana) return;

        let fechaAnterior = "";
        try { fechaAnterior = fechaSeleccionada; } catch {}

        try {
            if (fechaServicio) fechaSeleccionada = fechaServicio;
            const botonCabana = document.querySelector(
                `[data-ficha-cabana="${CSS.escape(String(numeroCabana))}"]`
            );
            if (botonCabana) {
                try { cerrarPanelNotificaciones?.(); } catch {}
                botonCabana.click();
            }
        } finally {
            try { fechaSeleccionada = fechaAnterior; } catch {}
        }
    }

    function crearSeccion(contenedor) {
        contenedor.querySelector(".notificaciones-vacias")?.remove();

        let seccion = contenedor.querySelector(".notificaciones-seccion");
        if (seccion) return seccion;

        seccion = document.createElement("div");
        seccion.className = "notificaciones-seccion";

        const titulo = document.createElement("div");
        titulo.className = "notificaciones-seccion-titulo";
        titulo.textContent = "Ahora";
        seccion.appendChild(titulo);
        contenedor.appendChild(seccion);
        return seccion;
    }

    function buscarBloqueServicio(seccion) {
        const propio = seccion.querySelector('[data-haiku-servicios-dia="1"]');
        if (propio) {
            const resumen = propio.matches(".notificacion-item")
                ? propio
                : seccion.querySelector('.notificacion-item[data-haiku-servicios-dia="1"]');
            const detalle = seccion.querySelector('.notificacion-detalle[data-haiku-servicios-dia="1"]');
            if (resumen && detalle) return { resumen, detalle, creado: true };
        }

        const resumen = [...seccion.querySelectorAll(".notificacion-item")].find(item => {
            const texto = String(item.textContent || "").toLowerCase();
            return texto.includes("servicio próximo") || texto.includes("servicios próximos");
        });

        if (!resumen) return null;
        const detalle = resumen.nextElementSibling;
        if (!detalle?.classList?.contains("notificacion-detalle")) return null;
        return { resumen, detalle, creado: false };
    }

    function crearBloque(seccion) {
        const resumen = document.createElement("button");
        resumen.type = "button";
        resumen.className = "notificacion-item";
        resumen.dataset.haikuServiciosDia = "1";

        const detalle = document.createElement("div");
        detalle.className = "notificacion-detalle";
        detalle.dataset.haikuServiciosDia = "1";
        detalle.hidden = true;

        resumen.addEventListener("click", () => {
            detalle.hidden = !detalle.hidden;
            const flecha = resumen.querySelector(".notificacion-flecha");
            if (flecha) flecha.textContent = detalle.hidden ? "›" : "⌄";
        });

        detalle.addEventListener("click", evento => {
            const item = evento.target.closest(".notificacion-reserva");
            if (item) abrirFichaServicio(item);
        });

        const titulo = seccion.querySelector(".notificaciones-seccion-titulo");
        if (titulo?.nextSibling) {
            seccion.insertBefore(detalle, titulo.nextSibling);
            seccion.insertBefore(resumen, detalle);
        } else {
            seccion.append(resumen, detalle);
        }

        return { resumen, detalle, creado: true };
    }

    function renderizar() {
        const contenedor = document.getElementById("notificaciones-contenido");
        if (!contenedor) return;

        const fecha = fechaVista();
        if (!fecha) return;

        const listaDia = listaServicios()
            .filter(s => String(s?.fechaServicio || s?.fecha || "").slice(0, 10) === fecha)
            .sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99"));

        if (!listaDia.length) {
            contenedor.querySelectorAll('[data-haiku-servicios-dia="1"]').forEach(el => el.remove());
            delete contenedor.dataset.haikuFirmaServiciosDia;
            return;
        }

        const estados = listaDia.map(s => estado(s, listaDia));
        const firma = `${fecha}|${listaDia.map((s, i) => `${s.id}:${estados[i].clave}`).join("|")}`;

        let seccion = crearSeccion(contenedor);
        let bloque = buscarBloqueServicio(seccion);

        const bloqueCompleto =
            bloque?.resumen?.isConnected &&
            bloque?.detalle?.isConnected &&
            bloque.resumen.dataset.haikuServiciosDia === "1" &&
            bloque.detalle.dataset.haikuServiciosDia === "1";

        if (
            contenedor.dataset.haikuFirmaServiciosDia === firma &&
            bloqueCompleto
        ) {
            return;
        }

        if (!bloque) bloque = crearBloque(seccion);

        bloque.resumen.dataset.haikuServiciosDia = "1";
        bloque.detalle.dataset.haikuServiciosDia = "1";

        bloque.resumen.innerHTML = `
            <span class="notificacion-icono">⏰</span>
            <span class="notificacion-contenido">
                <strong>${listaDia.length} ${listaDia.length === 1 ? "servicio del día" : "servicios del día"}</strong>
                <small>Ver estados</small>
            </span>
            <span class="notificacion-flecha">${bloque.detalle.hidden ? "›" : "⌄"}</span>
        `;

        bloque.detalle.innerHTML = "";

        listaDia.forEach((servicio, indice) => {
            const est = estados[indice];
            const item = document.createElement("button");
            item.type = "button";
            item.className = `notificacion-reserva haiku-notif-servicio-estado haiku-notif-servicio-${est.clave}`;
            item.dataset.cabana = servicio.numeroCabana || "";
            item.dataset.fecha = servicio.fechaServicio || servicio.fecha || "";
            item.dataset.servicioId = servicio.id || "";
            item.innerHTML = `
                <strong>${esc(servicio.hora || "--:--")} · ${esc(servicio.nombre || "Servicio")}</strong>
                <span>CAB ${esc(servicio.numeroCabana || "—")}${servicio.titular ? ` · ${esc(servicio.titular)}` : ""}</span>
                <span class="haiku-notif-servicio-etiqueta">${esc(est.etiqueta)}</span>
            `;
            bloque.detalle.appendChild(item);
        });

        // Si reutilizamos el bloque legacy, conserva sus listeners originales.
        // Si fue creado aquí, sus listeners ya fueron instalados en crearBloque().
        contenedor.dataset.haikuFirmaServiciosDia = firma;
    }

    function programar(delay = 20) {
        clearTimeout(timer);
        timer = setTimeout(renderizar, delay);
    }

    const contenedor = document.getElementById("notificaciones-contenido");
    if (contenedor) {
        new MutationObserver(() => programar(0)).observe(contenedor, {
            childList: true,
            subtree: true
        });
    }

    document.addEventListener("haiku:servicios-hidratados", () => programar(20));
    document.addEventListener("haiku:servicio-supabase-cambiado", () => programar(80));
    document.addEventListener("click", evento => {
        if (evento.target.closest?.("#boton-notificaciones")) programar(30);
    });

    setInterval(() => {
        const panel = document.getElementById("panel-notificaciones");
        if (panel && !panel.hidden) programar(0);
    }, 30000);

    window.haikuRenderNotificacionesServiciosDia = renderizar;

    setTimeout(() => programar(0), 800);

    console.info("HAIKU · Notificaciones de Servicios del día V1 preparadas.");
})();