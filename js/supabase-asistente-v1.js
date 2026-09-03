// ========================================
// HAIKU · ASISTENTE FLOTANTE V2
// Texto + capturas -> Edge Function -> vista previa estructurada.
// Esta fase NO crea ni modifica reservas.
// ========================================
(() => {
    "use strict";

    if (document.querySelector(".haiku-asistente-root")) return;

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    const MAX_IMAGENES = 6;
    const MAX_ARCHIVO_BYTES = 5 * 1024 * 1024;
    const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

    const adjuntos = [];
    let procesando = false;
    let ultimaPreview = null;

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
                    Envíame capturas y dime qué necesitas hacer. Leeré los datos y te mostraré una vista previa antes de permitir cualquier cambio.
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
                    Vista previa segura: en esta etapa el asistente puede leer capturas, pero no puede crear ni modificar reservas.
                </div>

                <input id="haiku-asistente-archivos" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden>
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

    function agregarMensaje(tipo, texto, claseExtra = "") {
        const div = document.createElement("div");
        div.className = `haiku-asistente-mensaje haiku-asistente-mensaje--${tipo}${claseExtra ? ` ${claseExtra}` : ""}`;
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
                if (procesando) return;
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
        const vacio = !campo.value.trim() && adjuntos.length === 0;
        enviar.disabled = procesando || vacio;
        adjuntar.disabled = procesando;
        campo.disabled = procesando;
        enviar.textContent = procesando ? "Analizando…" : "Enviar";
    }

    function bytesAdjuntos() {
        return adjuntos.reduce((total, item) => total + Number(item.file?.size || 0), 0);
    }

    function incorporarArchivos(files) {
        if (procesando) return;
        let omitidos = 0;

        [...files].forEach(file => {
            if (adjuntos.length >= MAX_IMAGENES) {
                omitidos++;
                return;
            }

            if (!/^image\/(png|jpeg|webp)$/i.test(file.type || "")) {
                omitidos++;
                return;
            }

            if (file.size > MAX_ARCHIVO_BYTES || bytesAdjuntos() + file.size > MAX_TOTAL_BYTES) {
                omitidos++;
                return;
            }

            adjuntos.push({
                file,
                url: URL.createObjectURL(file)
            });
        });

        archivosInput.value = "";
        renderizarAdjuntos();
        actualizarEnviar();

        if (omitidos) {
            agregarMensaje(
                "asistente",
                `No adjunté ${omitidos} ${omitidos === 1 ? "imagen" : "imágenes"}. Se admiten hasta 6 capturas PNG/JPG/WEBP, máximo 5 MB por archivo y 12 MB en total.`
            );
        }
    }

    function archivoADataUrl(file) {
        return new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(String(lector.result || ""));
            lector.onerror = () => reject(new Error(`No pude leer ${file.name || "una imagen"}.`));
            lector.readAsDataURL(file);
        });
    }

    function textoValor(valor) {
        if (valor === null || valor === undefined || valor === "") return "—";
        return String(valor);
    }

    function fechaVisible(valor) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ""))) return textoValor(valor);
        const [y, m, d] = String(valor).split("-");
        return `${d}-${m}-${y}`;
    }

    function moneda(valor, monedaCodigo = "CLP") {
        if (!Number.isFinite(Number(valor))) return "—";
        if (monedaCodigo === "CLP") {
            return `$${Math.round(Number(valor)).toLocaleString("es-CL")}`;
        }
        return `${Number(valor).toLocaleString("es-CL")} ${monedaCodigo || ""}`.trim();
    }

    function etiquetaTipo(tipo) {
        if (tipo === "full_day") return "Full Day";
        if (tipo === "alojamiento") return "Alojamiento";
        return "Por confirmar";
    }

    function agregarDato(contenedor, etiqueta, valor) {
        const fila = document.createElement("div");
        fila.className = "haiku-asistente-preview-dato";
        const small = document.createElement("span");
        small.textContent = etiqueta;
        const strong = document.createElement("strong");
        strong.textContent = textoValor(valor);
        fila.append(small, strong);
        contenedor.appendChild(fila);
    }

    function agregarLista(contenedor, titulo, elementos, clase = "") {
        if (!Array.isArray(elementos) || elementos.length === 0) return;
        const bloque = document.createElement("div");
        bloque.className = `haiku-asistente-preview-lista${clase ? ` ${clase}` : ""}`;
        const encabezado = document.createElement("strong");
        encabezado.textContent = titulo;
        const ul = document.createElement("ul");
        elementos.forEach(texto => {
            const li = document.createElement("li");
            li.textContent = String(texto || "");
            ul.appendChild(li);
        });
        bloque.append(encabezado, ul);
        contenedor.appendChild(bloque);
    }

    function renderizarPreview(preview) {
        ultimaPreview = preview;

        const card = document.createElement("article");
        card.className = "haiku-asistente-preview";

        const cabecera = document.createElement("div");
        cabecera.className = "haiku-asistente-preview-cabecera";
        const titulo = document.createElement("div");
        const marca = document.createElement("span");
        marca.textContent = "VISTA PREVIA · NADA GUARDADO";
        const nombre = document.createElement("strong");
        nombre.textContent = preview?.reserva?.titular_nombre || "Reserva por revisar";
        titulo.append(marca, nombre);

        const confianza = document.createElement("span");
        confianza.className = `haiku-asistente-confianza haiku-asistente-confianza--${preview?.confianza || "baja"}`;
        confianza.textContent = `Confianza ${preview?.confianza || "baja"}`;
        cabecera.append(titulo, confianza);
        card.appendChild(cabecera);

        if (preview?.resumen) {
            const resumen = document.createElement("p");
            resumen.className = "haiku-asistente-preview-resumen";
            resumen.textContent = preview.resumen;
            card.appendChild(resumen);
        }

        const datos = document.createElement("div");
        datos.className = "haiku-asistente-preview-grid";
        const r = preview?.reserva || {};
        agregarDato(datos, "Tipo", etiquetaTipo(r.tipo_estadia));
        agregarDato(datos, "Llegada / fecha", fechaVisible(r.fecha_llegada));
        agregarDato(datos, "Salida", fechaVisible(r.fecha_salida));
        agregarDato(datos, "Cabaña", r.cabana ? `CAB ${r.cabana}` : null);
        agregarDato(datos, "Adultos", r.adultos);
        agregarDato(datos, "Niños", r.ninos);
        agregarDato(datos, "Mascotas", r.mascotas);
        agregarDato(datos, "Noches", r.noches);
        agregarDato(datos, "Documento", r.documento);
        agregarDato(datos, "Nacionalidad", r.nacionalidad);
        agregarDato(datos, "Correo", r.correo);
        agregarDato(datos, "Teléfono", r.telefono);
        agregarDato(datos, "Fuente", r.fuente);
        agregarDato(datos, "Tarifa", r.plan_tarifa);
        card.appendChild(datos);

        if (r.observaciones) {
            const obs = document.createElement("div");
            obs.className = "haiku-asistente-preview-observacion";
            const label = document.createElement("span");
            label.textContent = "Observaciones detectadas";
            const texto = document.createElement("p");
            texto.textContent = r.observaciones;
            obs.append(label, texto);
            card.appendChild(obs);
        }

        const p = preview?.pago || {};
        if (p.detectado) {
            const pago = document.createElement("div");
            pago.className = "haiku-asistente-preview-pago";
            const encabezado = document.createElement("strong");
            encabezado.textContent = "Pago detectado";
            const grid = document.createElement("div");
            grid.className = "haiku-asistente-preview-grid";
            agregarDato(grid, "Monto", moneda(p.monto, p.moneda));
            agregarDato(grid, "Medio", p.medio);
            agregarDato(grid, "Fecha", fechaVisible(p.fecha));
            agregarDato(grid, "Glosa", p.glosa);
            agregarDato(grid, "CodAut", p.codaut);
            agregarDato(grid, "Folio", p.folio);
            agregarDato(grid, "BOVTAR", p.bovtar);
            pago.append(encabezado, grid);
            card.appendChild(pago);
        }

        if (Array.isArray(preview?.acompanantes) && preview.acompanantes.length) {
            const nombres = preview.acompanantes.map(item => {
                const n = item?.nombre || "Acompañante sin nombre";
                return item?.documento ? `${n} · ${item.documento}` : n;
            });
            agregarLista(card, "Acompañantes detectados", nombres);
        }

        agregarLista(card, "Datos faltantes", preview?.faltantes, "haiku-asistente-preview-lista--faltantes");
        agregarLista(card, "Revisar antes de continuar", preview?.advertencias, "haiku-asistente-preview-lista--alerta");

        const pie = document.createElement("div");
        pie.className = "haiku-asistente-preview-pie";
        const estado = document.createElement("span");
        estado.textContent = "🔒 La IA sólo leyó los datos. Supabase no fue modificado.";
        const botonFuturo = document.createElement("button");
        botonFuturo.type = "button";
        botonFuturo.disabled = true;
        botonFuturo.textContent = "Crear reserva · próxima etapa";
        pie.append(estado, botonFuturo);
        card.appendChild(pie);

        mensajes.appendChild(card);
        scrollFinal();
        return card;
    }

    async function detalleErrorFuncion(error) {
        try {
            const respuesta = error?.context;
            if (respuesta && typeof respuesta.clone === "function") {
                return await respuesta.clone().json();
            }
        } catch {}
        return null;
    }

    async function analizarReserva(mensaje, imagenes) {
        const { data, error } = await cliente.functions.invoke("haiku-asistente-reserva", {
            body: {
                mensaje,
                imagenes,
            },
        });

        if (error) {
            const detalle = await detalleErrorFuncion(error);
            const e = new Error(detalle?.error || error?.message || "No fue posible analizar las capturas.");
            e.code = detalle?.code || "FUNCTION_ERROR";
            throw e;
        }

        if (!data?.ok || !data?.preview) {
            const e = new Error(data?.error || "El asistente no devolvió una vista previa.");
            e.code = data?.code || "INVALID_PREVIEW";
            throw e;
        }

        return data;
    }

    async function enviarMensaje() {
        if (procesando) return;

        const texto = campo.value.trim();
        if (!texto && adjuntos.length === 0) return;

        const cantidad = adjuntos.length;
        const archivosActuales = adjuntos.map(item => item.file);
        const instruccion = texto || "Analiza estas capturas y prepara una vista previa de la reserva.";

        procesando = true;
        actualizarEnviar();

        let imagenes;
        try {
            imagenes = await Promise.all(archivosActuales.map(archivoADataUrl));
        } catch (error) {
            procesando = false;
            actualizarEnviar();
            agregarMensaje("asistente", error?.message || "No pude preparar una de las imágenes.");
            return;
        }

        const partes = [];
        if (texto) partes.push(texto);
        if (cantidad) partes.push(`${cantidad} ${cantidad === 1 ? "imagen adjunta" : "imágenes adjuntas"}`);
        agregarMensaje("usuario", partes.join("\n\n") || "Analizar capturas");

        campo.value = "";
        limpiarAdjuntos();
        actualizarEnviar();

        const estado = agregarMensaje(
            "asistente",
            cantidad
                ? `Analizando ${cantidad} ${cantidad === 1 ? "captura" : "capturas"}…`
                : "Analizando la instrucción…",
            "haiku-asistente-mensaje--procesando"
        );

        try {
            const resultado = await analizarReserva(instruccion, imagenes);
            estado.classList.remove("haiku-asistente-mensaje--procesando");
            estado.textContent = resultado.preview?.resumen || "Análisis completado. Revisa los datos antes de continuar.";
            renderizarPreview(resultado.preview);
        } catch (error) {
            console.error("HAIKU · Asistente IA:", error);
            estado.classList.remove("haiku-asistente-mensaje--procesando");

            if (error?.code === "OPENAI_API_KEY_NOT_CONFIGURED") {
                estado.textContent = "El asistente ya está conectado, pero falta configurar su clave privada de OpenAI en Supabase. No se envió ni guardó ninguna reserva.";
            } else {
                estado.textContent = `No pude completar el análisis: ${error?.message || "error desconocido"}`;
            }
        } finally {
            procesando = false;
            actualizarEnviar();
            scrollFinal();
        }
    }

    boton.addEventListener("click", alternarPanel);
    cerrar.addEventListener("click", cerrarPanel);
    adjuntar.addEventListener("click", () => {
        if (!procesando) archivosInput.click();
    });
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
        procesando: () => procesando,
        ultimaPreview: () => ultimaPreview,
        adjuntos: () => adjuntos.map(item => ({
            nombre: item.file.name,
            tipo: item.file.type,
            bytes: item.file.size
        }))
    };

    actualizarEnviar();
    mostrarSiCorresponde();

    console.info("HAIKU · Asistente flotante V2 preparado.");
})();
