// ========================================
// HAIKU · ASISTENTE FLOTANTE V1
// Interfaz global persistente entre secciones SPA.
// En esta fase no envía imágenes ni datos a servicios externos.
// ========================================
(() => {
    "use strict";

    if (document.querySelector(".haiku-asistente-root")) return;

    const cliente = window.haikuSupabase;
    const adjuntos = [];

    const root = document.createElement("div");
    root.className = "haiku-asistente-root";
    root.hidden = true;
    root.innerHTML = `
        <section class="haiku-asistente-panel" id="haiku-asistente-panel" hidden aria-label="Asistente operativo">
            <header class="haiku-asistente-cabecera">
                <div class="haiku-asistente-titulo">
                    <strong>Asistente operativo</strong>
                    <span>Capturas, reservas y tareas</span>
                </div>
                <button type="button" class="haiku-asistente-cerrar" id="haiku-asistente-cerrar" aria-label="Cerrar asistente">×</button>
            </header>

            <div class="haiku-asistente-mensajes" id="haiku-asistente-mensajes" aria-live="polite">
                <div class="haiku-asistente-mensaje haiku-asistente-mensaje--asistente">
                    Envíame capturas y dime qué necesitas hacer. Antes de ejecutar cambios, te mostraré una vista previa para confirmar los datos.
                </div>
            </div>

            <div class="haiku-asistente-adjuntos" id="haiku-asistente-adjuntos"></div>

            <div class="haiku-asistente-compositor">
                <textarea
                    class="haiku-asistente-texto"
                    id="haiku-asistente-texto"
                    placeholder="Ej: Agrega esta reserva a la fecha correspondiente. Ojo que es Full Day."
                    aria-label="Mensaje para el asistente"
                ></textarea>

                <div class="haiku-asistente-acciones">
                    <button type="button" class="haiku-asistente-adjuntar" id="haiku-asistente-adjuntar">📎 Adjuntar</button>
                    <button type="button" class="haiku-asistente-enviar" id="haiku-asistente-enviar">Enviar</button>
                </div>

                <div class="haiku-asistente-aviso">
                    Fase inicial: las imágenes quedan sólo en este navegador. La conexión con IA se habilitará en el siguiente paso.
                </div>

                <input id="haiku-asistente-archivos" type="file" accept="image/*" multiple hidden>
            </div>
        </section>

        <button type="button" class="haiku-asistente-boton" id="haiku-asistente-boton" aria-label="Abrir asistente" aria-expanded="false">
            <span class="haiku-asistente-avatar" aria-hidden="true">
                <span class="haiku-asistente-audifonos"></span>
                <span class="haiku-asistente-sonrisa"></span>
            </span>
        </button>
    `;
    document.body.appendChild(root);

    const panel = root.querySelector("#haiku-asistente-panel");
    const boton = root.querySelector("#haiku-asistente-boton");
    const cerrar = root.querySelector("#haiku-asistente-cerrar");
    const mensajes = root.querySelector("#haiku-asistente-mensajes");
    const campo = root.querySelector("#haiku-asistente-texto");
    const adjuntar = root.querySelector("#haiku-asistente-adjuntar");
    const archivosInput = root.querySelector("#haiku-asistente-archivos");
    const adjuntosWrap = root.querySelector("#haiku-asistente-adjuntos");
    const enviar = root.querySelector("#haiku-asistente-enviar");

    function estaAutenticado() {
        return Boolean(window.haikuSesion?.auth || window.haikuSesion?.usuario);
    }

    function mostrarSiCorresponde() {
        root.hidden = !estaAutenticado();
        if (root.hidden) cerrarPanel();
    }

    function abrirPanel() {
        if (root.hidden) return;
        panel.hidden = false;
        boton.setAttribute("aria-expanded", "true");
        boton.setAttribute("aria-label", "Cerrar asistente");
        requestAnimationFrame(() => campo.focus());
    }

    function cerrarPanel() {
        panel.hidden = true;
        boton.setAttribute("aria-expanded", "false");
        boton.setAttribute("aria-label", "Abrir asistente");
    }

    function alternarPanel() {
        panel.hidden ? abrirPanel() : cerrarPanel();
    }

    function scrollFinal() {
        requestAnimationFrame(() => {
            mensajes.scrollTop = mensajes.scrollHeight;
        });
    }

    function agregarMensaje(tipo, texto) {
        const div = document.createElement("div");
        div.className = `haiku-asistente-mensaje haiku-asistente-mensaje--${tipo}`;
        div.textContent = texto;
        mensajes.appendChild(div);
        scrollFinal();
        return div;
    }

    function liberarAdjunto(adjunto) {
        try { URL.revokeObjectURL(adjunto.url); } catch {}
    }

    function renderizarAdjuntos() {
        adjuntosWrap.innerHTML = "";

        adjuntos.forEach((adjunto, indice) => {
            const item = document.createElement("div");
            item.className = "haiku-asistente-adjunto";

            const img = document.createElement("img");
            img.src = adjunto.url;
            img.alt = adjunto.file.name || `Imagen ${indice + 1}`;

            const quitar = document.createElement("button");
            quitar.type = "button";
            quitar.className = "haiku-asistente-quitar";
            quitar.textContent = "×";
            quitar.setAttribute("aria-label", `Quitar ${img.alt}`);
            quitar.addEventListener("click", () => {
                const [eliminado] = adjuntos.splice(indice, 1);
                if (eliminado) liberarAdjunto(eliminado);
                renderizarAdjuntos();
                actualizarEnviar();
            });

            item.append(img, quitar);
            adjuntosWrap.appendChild(item);
        });
    }

    function limpiarAdjuntos() {
        adjuntos.forEach(liberarAdjunto);
        adjuntos.length = 0;
        archivosInput.value = "";
        renderizarAdjuntos();
    }

    function actualizarEnviar() {
        enviar.disabled = !campo.value.trim() && adjuntos.length === 0;
    }

    function incorporarArchivos(files) {
        [...files].forEach(file => {
            if (!file.type.startsWith("image/")) return;
            if (adjuntos.length >= 6) return;

            adjuntos.push({
                file,
                url: URL.createObjectURL(file)
            });
        });

        renderizarAdjuntos();
        actualizarEnviar();
    }

    function enviarMensaje() {
        const texto = campo.value.trim();
        if (!texto && adjuntos.length === 0) return;

        const cantidad = adjuntos.length;
        const partes = [];
        if (texto) partes.push(texto);
        if (cantidad) partes.push(`${cantidad} ${cantidad === 1 ? "imagen adjunta" : "imágenes adjuntas"}`);

        agregarMensaje("usuario", partes.join("\n\n"));
        campo.value = "";
        limpiarAdjuntos();
        actualizarEnviar();

        window.setTimeout(() => {
            agregarMensaje(
                "asistente",
                "Recibido. La interfaz del asistente ya está lista. Todavía no ejecutaré cambios: el siguiente paso es conectar esta conversación con la IA y la vista previa segura de reservas."
            );
        }, 180);
    }

    boton.addEventListener("click", alternarPanel);
    cerrar.addEventListener("click", cerrarPanel);
    adjuntar.addEventListener("click", () => archivosInput.click());
    archivosInput.addEventListener("change", () => incorporarArchivos(archivosInput.files || []));
    campo.addEventListener("input", actualizarEnviar);
    campo.addEventListener("keydown", evento => {
        if ((evento.ctrlKey || evento.metaKey) && evento.key === "Enter") {
            evento.preventDefault();
            enviarMensaje();
        }
    });
    enviar.addEventListener("click", enviarMensaje);

    window.addEventListener("haiku:auth-ready", () => {
        mostrarSiCorresponde();
    });

    if (cliente?.auth?.onAuthStateChange) {
        cliente.auth.onAuthStateChange(evento => {
            if (evento === "SIGNED_OUT") {
                root.hidden = true;
                cerrarPanel();
            } else if (evento === "SIGNED_IN") {
                window.setTimeout(mostrarSiCorresponde, 0);
            }
        });
    }

    window.addEventListener("beforeunload", limpiarAdjuntos);

    window.HAIKU_ASISTENTE = {
        abrir: abrirPanel,
        cerrar: cerrarPanel,
        visible: () => !root.hidden,
        adjuntos: () => adjuntos.map(item => ({
            nombre: item.file.name,
            tipo: item.file.type,
            bytes: item.file.size
        }))
    };

    actualizarEnviar();
    mostrarSiCorresponde();

    console.info("HAIKU · Asistente flotante V1 preparado.");
})();
