// ========================================
// HAIKU · ASISTENTE FLOTANTE V3
// Texto + capturas -> Edge Function -> vista previa estructurada.
// La creación requiere confirmación humana y reutiliza la RPC oficial.
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
    let guardandoReserva = false;
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
                    Envíame capturas y dime qué necesitas hacer. Leeré los datos y te mostraré una vista previa antes de cualquier cambio.
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
                    Vista previa segura: puedes adjuntar imágenes o pegar capturas con Ctrl+V. Una reserva sólo se crea después de pulsar “Confirmar y crear” y aceptar la confirmación final.
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
                if (procesando || guardandoReserva) return;
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
        enviar.disabled = procesando || guardandoReserva || vacio;
        adjuntar.disabled = procesando || guardandoReserva;
        campo.disabled = procesando || guardandoReserva;
        enviar.textContent = procesando ? "Analizando…" : "Enviar";
    }

    function bytesAdjuntos() {
        return adjuntos.reduce((total, item) => total + Number(item.file?.size || 0), 0);
    }

    function incorporarArchivos(files) {
        if (procesando || guardandoReserva) return;
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

    function imagenesDesdePortapapeles(evento) {
        const portapapeles = evento.clipboardData;
        if (!portapapeles) return [];

        const desdeItems = [...(portapapeles.items || [])]
            .filter(item =>
                item.kind === "file" &&
                /^image\/(png|jpeg|webp)$/i.test(item.type || "")
            )
            .map(item => item.getAsFile())
            .filter(Boolean);

        if (desdeItems.length) return desdeItems;

        return [...(portapapeles.files || [])]
            .filter(file => /^image\/(png|jpeg|webp)$/i.test(file.type || ""));
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
        if (valor === null || valor === undefined || valor === "") return;
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

    function problemasParaCrear(preview) {
        const r = preview?.reserva || {};
        const problemas = [];

        if (r.tipo_estadia !== "alojamiento") {
            problemas.push("Por ahora el botón sólo crea reservas de alojamiento.");
        }
        if (!r.titular_nombre) problemas.push("Falta titular.");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha_llegada || ""))) problemas.push("Falta fecha de llegada válida.");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha_salida || ""))) problemas.push("Falta fecha de salida válida.");
        if (!Number.isInteger(Number(r.cabana)) || Number(r.cabana) < 1) problemas.push("Falta cabaña válida.");
        if (!String(r.cloudbeds_id || "").trim()) problemas.push("Falta ID de reserva Cloudbeds.");
        if (preview?.confianza === "baja") problemas.push("La confianza de lectura es baja.");

        return problemas;
    }

    function nombresAcompanantes(preview) {
        if (!Array.isArray(preview?.acompanantes)) return [];
        return preview.acompanantes
            .map(item => String(item?.nombre || "").trim())
            .filter(Boolean);
    }

    async function crearReservaDesdePreview(preview) {
        if (!window.haikuTienePermiso?.("reservas.crear")) {
            throw new Error("Tu usuario no tiene permiso para crear reservas.");
        }

        const problemas = problemasParaCrear(preview);
        if (problemas.length) {
            throw new Error(problemas.join(" "));
        }

        const r = preview.reserva;
        const cabana = Number(r.cabana);

        const { data: disponibles, error: errorDisponibilidad } = await cliente.rpc(
            "haiku_cabanas_disponibles",
            {
                p_fecha_ingreso: r.fecha_llegada,
                p_fecha_salida: r.fecha_salida,
                p_tipo_estadia: "alojamiento"
            }
        );

        if (errorDisponibilidad) throw errorDisponibilidad;

        const disponible = (disponibles || []).some(
            item => Number(item.numero) === cabana
        );

        if (!disponible) {
            throw new Error(`CAB ${cabana} ya no está disponible para ese rango.`);
        }

        const { data, error } = await cliente.rpc(
            "haiku_crear_reserva",
            {
                p_titular_nombre: r.titular_nombre,
                p_cabana_numero: cabana,
                p_fecha_ingreso: r.fecha_llegada,
                p_fecha_salida: r.fecha_salida,
                p_adultos: Math.max(0, Number(r.adultos ?? 1)),
                p_ninos: Math.max(0, Number(r.ninos ?? 0)),
                p_mascotas: Math.max(0, Number(r.mascotas ?? 0)),
                p_correo_contacto: r.correo || null,
                p_telefono_contacto: r.telefono || null,
                p_rut: null,
                p_observaciones: r.observaciones || null,
                p_tarifas: {},
                p_acompanantes: nombresAcompanantes(preview),
                p_tipo_estadia: "alojamiento",
                p_cloudbeds_id: String(r.cloudbeds_id).trim()
            }
        );

        if (error) {
            if (error?.code === "23505" || /cloudbeds_id|reservas_cloudbeds_id_uidx/i.test(error?.message || "")) {
                throw new Error("Esta reserva de Cloudbeds ya existe en Proyecto H.");
            }
            throw error;
        }

        return data;
    }

    async function refrescarDespuesDeCrear() {
        try {
            if (typeof window.haikuSincronizarReservasSupabase === "function") {
                await window.haikuSincronizarReservasSupabase();
            }
        } catch (error) {
            console.warn("HAIKU · Asistente: reserva creada, pero falló sincronización visual:", error);
        }

        try { await window.HAIKU_OPERACION_RESUMEN_FIX_V1?.refrescar?.(); } catch {}
        try { if (typeof generarCalendario === "function") generarCalendario(); } catch {}
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
        agregarDato(datos, "ID Cloudbeds", r.cloudbeds_id);
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
        estado.textContent = "🔒 Nada guardado todavía.";
        const botonCrear = document.createElement("button");
        botonCrear.type = "button";

        const problemas = problemasParaCrear(preview);
        const tienePermiso = window.haikuTienePermiso?.("reservas.crear") === true;
        const puedeCrear = problemas.length === 0 && tienePermiso;

        botonCrear.disabled = !puedeCrear;
        botonCrear.textContent = puedeCrear
            ? "Confirmar y crear"
            : r.tipo_estadia === "full_day"
                ? "Full Day · próxima etapa"
                : "Crear reserva · revisar datos";
        if (problemas.length) botonCrear.title = problemas.join(" ");
        if (!tienePermiso) botonCrear.title = "Tu usuario no tiene permiso para crear reservas.";

        botonCrear.addEventListener("click", async () => {
            if (guardandoReserva || botonCrear.disabled) return;

            const confirmacion = [
                "CONFIRMAR CREACIÓN DE RESERVA",
                "",
                `${r.titular_nombre}`,
                `CAB ${r.cabana}`,
                `${fechaVisible(r.fecha_llegada)} → ${fechaVisible(r.fecha_salida)}`,
                `${Number(r.adultos ?? 1)} adulto(s)`,
                `ID Cloudbeds: ${r.cloudbeds_id}`,
                "",
                "Se usarán las tarifas catálogo configuradas en Proyecto H para cada noche.",
                "La reserva se guardará sólo si la cabaña sigue disponible.",
                "",
                "¿Confirmas crearla?"
            ].join("\n");

            if (!window.confirm(confirmacion)) return;

            const textoOriginal = botonCrear.textContent;
            guardandoReserva = true;
            actualizarEnviar();
            botonCrear.disabled = true;
            botonCrear.textContent = "Creando reserva…";
            estado.textContent = "Validando disponibilidad antes de guardar…";

            try {
                const creada = await crearReservaDesdePreview(preview);
                await refrescarDespuesDeCrear();

                marca.textContent = "RESERVA CREADA";
                estado.textContent = `✅ Reserva creada en Proyecto H${creada?.codigo_haiku ? ` · ${creada.codigo_haiku}` : ""}.`;
                botonCrear.textContent = "Reserva creada";
                botonCrear.disabled = true;
                card.dataset.haikuReservaCreada = "1";

                agregarMensaje(
                    "asistente",
                    `Reserva de ${r.titular_nombre} creada correctamente en CAB ${r.cabana}.`
                );
            } catch (error) {
                console.error("HAIKU · Asistente no pudo crear reserva:", error);
                estado.textContent = `⚠️ No se guardó la reserva: ${error?.message || "error desconocido"}`;
                botonCrear.textContent = textoOriginal;
                botonCrear.disabled = false;
            } finally {
                guardandoReserva = false;
                actualizarEnviar();
                scrollFinal();
            }
        });

        pie.append(estado, botonCrear);
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
        if (procesando || guardandoReserva) return;

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
        if (!procesando && !guardandoReserva) archivosInput.click();
    });
    archivosInput.addEventListener("change", () => incorporarArchivos(archivosInput.files || []));
    campo.addEventListener("input", actualizarEnviar);
    campo.addEventListener("paste", evento => {
        if (procesando || guardandoReserva) return;

        const imagenes = imagenesDesdePortapapeles(evento);
        if (!imagenes.length) return;

        // Una captura en el portapapeles se convierte en adjunto.
        // Si sólo hay texto, el navegador conserva el pegado normal.
        evento.preventDefault();
        incorporarArchivos(imagenes);
    });
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
        procesando: () => procesando || guardandoReserva,
        ultimaPreview: () => ultimaPreview,
        adjuntos: () => adjuntos.map(item => ({
            nombre: item.file.name,
            tipo: item.file.type,
            bytes: item.file.size
        }))
    };

    actualizarEnviar();
    mostrarSiCorresponde();

    console.info("HAIKU · Asistente flotante V3 preparado.");
})();