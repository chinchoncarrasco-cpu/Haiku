// ========================================
// HAIKU · HISTORIAL + AUDITORÍA · SUPABASE V1
// Historial humano + auditoría técnica desde eventos_auditoria.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    const seccion = document.getElementById("seccion-historial");
    if (!seccion) return;

    let modo = "historial";
    let eventos = [];
    let limite = 250;
    let totalExacto = 0;
    let cargando = false;
    let ultimaCarga = 0;

    const contexto = {
        usuarios: new Map(),
        reservas: new Map(),
        cabanas: new Map(),
        pagos: new Map(),
        servicios: new Map()
    };

    const CAMPOS = {
        estado: "Estado",
        estado_reserva: "Estado de reserva",
        estado_servicio: "Estado del servicio",
        titular_nombre: "Titular",
        fecha_ingreso: "Ingreso",
        fecha_salida: "Salida",
        cabana_id: "Cabaña",
        monto: "Monto",
        medio_pago: "Medio de pago",
        etapa_operativa: "Etapa",
        codigo_autorizacion: "CodAut",
        folio: "Folio",
        bove: "BOVE",
        bove_cierre: "BOVE alojamiento",
        bove_checkout: "BOVE Check-out",
        resumen_entrega: "Resumen de entrega",
        novedades: "Novedades",
        motivo_reapertura: "Motivo reapertura",
        checkin_realizado_en: "Check-in",
        checkout_realizado_en: "Check-out",
        observaciones: "Observaciones"
    };

    function limpiar(valor) {
        return String(valor ?? "").trim();
    }

    function escaparJson(valor) {
        try {
            return JSON.stringify(valor ?? {}, null, 2);
        } catch {
            return String(valor ?? "");
        }
    }

    function dinero(valor) {
        return `$${Number(valor || 0).toLocaleString("es-CL")}`;
    }

    function medioPago(valor) {
        const mapa = {
            transferencia: "Transferencia",
            webpay_credito: "WebPay Crédito",
            webpay_debito: "WebPay Débito",
            tarjeta_credito: "Tarjeta Crédito",
            tarjeta_debito: "Tarjeta Débito",
            efectivo: "Efectivo"
        };
        return mapa[String(valor || "")] || limpiar(valor).replaceAll("_", " ") || "—";
    }

    function fechaHora(valor) {
        if (!valor) return "—";
        try {
            return new Intl.DateTimeFormat("es-CL", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "America/Santiago"
            }).format(new Date(valor));
        } catch {
            return String(valor);
        }
    }

    function fechaLocal(valor) {
        if (!valor) return "";
        try {
            const partes = new Intl.DateTimeFormat("en-CA", {
                timeZone: "America/Santiago",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }).formatToParts(new Date(valor));
            const obj = Object.fromEntries(partes.map(p => [p.type, p.value]));
            return `${obj.year}-${obj.month}-${obj.day}`;
        } catch {
            return "";
        }
    }

    function elemento(tag, clase, texto) {
        const el = document.createElement(tag);
        if (clase) el.className = clase;
        if (texto !== undefined) el.textContent = texto;
        return el;
    }

    function idsUnicos(lista) {
        return [...new Set(lista.filter(Boolean).map(String))];
    }

    function usuarioNombre(id) {
        if (!id) return "Sistema";
        const u = contexto.usuarios.get(String(id));
        if (!u) return "Usuario HAIKU";
        return [u.nombre, u.apellido].filter(Boolean).join(" ") || "Usuario HAIKU";
    }

    function reservaInfo(id) {
        return id ? contexto.reservas.get(String(id)) || null : null;
    }

    function cabanaInfo(id) {
        return id ? contexto.cabanas.get(String(id)) || null : null;
    }

    function pagoInfo(evento) {
        if (!["pago", "pagos"].includes(evento?.entidad_tipo)) return null;
        return evento.entidad_id ? contexto.pagos.get(String(evento.entidad_id)) || null : null;
    }

    function servicioInfo(evento) {
        if (evento?.entidad_tipo !== "servicios") return null;
        return evento.entidad_id ? contexto.servicios.get(String(evento.entidad_id)) || null : null;
    }

    function normalizarCambios(evento) {
        const lista = Array.isArray(evento?.cambios) ? evento.cambios : [];
        return lista.map(c => ({
            campo: limpiar(c?.campo) || "Cambio",
            anterior: c?.anterior !== undefined ? c.anterior : c?.antes,
            nuevo: c?.nuevo !== undefined ? c.nuevo : c?.despues
        }));
    }

    function valorHumano(valor, campo = "") {
        if (valor === null || valor === undefined || valor === "") return "—";
        if (typeof valor === "boolean") return valor ? "Sí" : "No";
        if (typeof valor === "object") {
            const texto = escaparJson(valor);
            return texto.length > 190 ? `${texto.slice(0, 187)}…` : texto;
        }
        if (String(campo).includes("monto")) return dinero(valor);
        if (campo === "medio_pago") return medioPago(valor);
        return String(valor);
    }

    function nombreCampo(campo) {
        return CAMPOS[campo] || limpiar(campo).replaceAll("_", " ").replace(/^./, s => s.toUpperCase());
    }

    function categoriaEvento(evento) {
        const entidad = String(evento?.entidad_tipo || "");
        const tipo = String(evento?.tipo_evento || "");
        if (entidad === "reservas" || entidad === "reserva" || entidad === "reserva_estadias" || entidad === "estadia_noches") return "reserva";
        if (entidad === "pagos" || entidad === "pago" || tipo === "finanzas") return "pago";
        if (entidad === "servicios" || entidad === "servicio") return "servicio";
        if (entidad.includes("cierre") || entidad === "turnos" || tipo === "cierre_turno") return "cierre";
        return "sistema";
    }

    function cambioTiene(evento, campo) {
        return normalizarCambios(evento).find(c => c.campo === campo) || null;
    }

    function esTecnicoOcultoEnHistorial(evento) {
        const entidad = String(evento?.entidad_tipo || "");
        const tipo = String(evento?.tipo_evento || "");

        if (["reserva_estadias", "estadia_noches", "turnos", "cierres_turno"].includes(entidad)) {
            return ["creacion", "actualizacion", "eliminacion"].includes(tipo);
        }

        return false;
    }

    function tituloHumano(evento) {
        const entidad = String(evento?.entidad_tipo || "");
        const tipo = String(evento?.tipo_evento || "");
        const pago = pagoInfo(evento);
        const servicio = servicioInfo(evento);

        if (tipo === "cierre_turno") {
            if (String(evento.accion).includes("reabr")) return "Cierre de turno reabierto";
            if (String(evento.accion).includes("cerr")) return "Cierre de turno realizado";
            return evento.descripcion || "Cierre de turno";
        }

        if (entidad === "reservas") {
            if (tipo === "creacion") return "Reserva creada";
            if (cambioTiene(evento, "bove_checkout")) return "BOVE Check-out actualizado";
            if (cambioTiene(evento, "bove_cierre")) return "BOVE alojamiento actualizado";
            if (cambioTiene(evento, "estado_reserva")) return "Estado de reserva actualizado";
            return "Reserva actualizada";
        }

        if (["pagos", "pago"].includes(entidad) || tipo === "finanzas") {
            const estado = cambioTiene(evento, "estado");
            const esWebpay = String(pago?.medio_pago || "").startsWith("webpay_");
            if (tipo === "creacion") {
                return esWebpay && pago?.estado === "pendiente_asociacion"
                    ? "WebPay pendiente registrado"
                    : "Pago registrado";
            }
            if (estado?.nuevo === "confirmado") {
                return esWebpay ? "WebPay asociado y confirmado" : "Pago confirmado";
            }
            if (tipo === "finanzas") return evento.descripcion || evento.accion || "Movimiento financiero";
            return esWebpay ? "WebPay actualizado" : "Pago actualizado";
        }

        if (entidad === "servicios") {
            if (tipo === "creacion") {
                const nombre = servicio?.catalogo_servicios?.nombre;
                return nombre ? `Servicio agregado · ${nombre}` : "Servicio agregado";
            }
            return "Servicio actualizado";
        }

        if (tipo === "creacion") return "Registro creado";
        if (tipo === "actualizacion") return "Registro actualizado";
        if (tipo === "eliminacion") return "Registro eliminado";
        return evento.descripcion || evento.accion || "Actividad registrada";
    }

    function descripcionHumana(evento) {
        const pago = pagoInfo(evento);
        const servicio = servicioInfo(evento);
        if (pago) {
            const partes = [dinero(pago.monto), medioPago(pago.medio_pago)];
            if (pago.etapa_operativa) partes.push(String(pago.etapa_operativa).replaceAll("_", " "));
            return partes.filter(Boolean).join(" · ");
        }
        if (servicio) {
            const nombre = servicio.catalogo_servicios?.nombre || "Servicio";
            const partes = [nombre];
            if (Number(servicio.total || 0) > 0) partes.push(dinero(servicio.total));
            if (servicio.fecha_servicio) partes.push(String(servicio.fecha_servicio));
            return partes.join(" · ");
        }
        return evento.descripcion || "";
    }

    function referenciaHumana(evento) {
        const reserva = reservaInfo(evento.reserva_id);
        const cabana = cabanaInfo(evento.cabana_id);
        const partes = [];

        if (cabana?.numero) partes.push(`CAB ${cabana.numero}`);
        if (reserva?.titular_nombre) partes.push(reserva.titular_nombre);
        if (reserva?.codigo_haiku) partes.push(reserva.codigo_haiku);
        else if (reserva?.cloudbeds_id) partes.push(reserva.cloudbeds_id);

        return partes.length ? partes.join(" · ") : "Actividad general";
    }

    function textoBuscable(evento) {
        const reserva = reservaInfo(evento.reserva_id);
        const cabana = cabanaInfo(evento.cabana_id);
        const pago = pagoInfo(evento);
        const servicio = servicioInfo(evento);
        return [
            evento.accion,
            evento.descripcion,
            evento.tipo_evento,
            evento.entidad_tipo,
            evento.entidad_id,
            evento.reserva_id,
            evento.estadia_id,
            evento.turno_id,
            usuarioNombre(evento.usuario_id),
            reserva?.titular_nombre,
            reserva?.codigo_haiku,
            reserva?.cloudbeds_id,
            cabana?.numero,
            pago?.medio_pago,
            pago?.monto,
            servicio?.catalogo_servicios?.nombre,
            ...normalizarCambios(evento).flatMap(c => [c.campo, valorHumano(c.anterior, c.campo), valorHumano(c.nuevo, c.campo)])
        ].filter(v => v !== undefined && v !== null).join(" ").toLocaleLowerCase("es-CL");
    }

    function permisosLocales() {
        const sesion = window.haikuSesion || {};
        const roles = Array.isArray(sesion.roles) ? sesion.roles : [];
        const permisos = Array.isArray(sesion.permisos) ? sesion.permisos : [];
        const codigosRoles = roles.map(r => String(typeof r === "string" ? r : (r?.codigo || r?.nombre || "")).toLowerCase());
        const codigosPermisos = permisos.map(p => String(typeof p === "string" ? p : (p?.codigo || p?.nombre || "")));
        return {
            auditoria: codigosRoles.some(r => ["administrador", "manager"].includes(r)) || codigosPermisos.includes("auditoria.ver")
        };
    }

    function construirUI() {
        const legacyModal = document.getElementById("historial-reserva-modal");
        if (legacyModal) legacyModal.hidden = true;

        seccion.innerHTML = `
            <div class="historial-supa-shell">
                <header class="historial-supa-header">
                    <div>
                        <p class="historial-supa-kicker">TRAZABILIDAD</p>
                        <h2>Historial y auditoría</h2>
                        <p>Actividad real registrada en Supabase. Historial resume lo importante; Auditoría conserva el detalle técnico completo.</p>
                    </div>
                    <button type="button" class="historial-supa-refresh" data-historial-refresh>↻ Actualizar</button>
                </header>

                <div class="historial-supa-tabs" role="tablist">
                    <button type="button" class="historial-supa-tab activo" data-historial-modo="historial">Historial</button>
                    <button type="button" class="historial-supa-tab" data-historial-modo="auditoria">Auditoría</button>
                </div>

                <section class="historial-supa-panel">
                    <div class="historial-supa-filtros">
                        <label class="historial-supa-filtro">
                            <span>Buscar</span>
                            <input type="search" data-historial-buscar placeholder="Reserva, huésped, pago, servicio o acción…" autocomplete="off">
                        </label>
                        <label class="historial-supa-filtro">
                            <span>Desde</span>
                            <input type="date" data-historial-desde>
                        </label>
                        <label class="historial-supa-filtro">
                            <span>Hasta</span>
                            <input type="date" data-historial-hasta>
                        </label>
                        <label class="historial-supa-filtro">
                            <span>Tipo</span>
                            <select data-historial-tipo>
                                <option value="">Todos</option>
                                <option value="reserva">Reservas</option>
                                <option value="pago">Pagos</option>
                                <option value="servicio">Servicios</option>
                                <option value="cierre">Cierre de turno</option>
                                <option value="sistema">Otros</option>
                            </select>
                        </label>
                    </div>

                    <div class="historial-supa-toolbar">
                        <strong data-historial-contador>Preparando historial…</strong>
                        <span data-historial-fuente>Supabase</span>
                    </div>

                    <div class="historial-supa-lista" data-historial-lista>
                        <p class="historial-supa-cargando">Cargando actividad…</p>
                    </div>
                    <div class="historial-supa-mas-wrap" data-historial-mas-wrap hidden>
                        <button type="button" class="historial-supa-mas" data-historial-mas>Cargar más actividad</button>
                    </div>
                </section>
            </div>
        `;

        seccion.querySelector("[data-historial-refresh]")?.addEventListener("click", () => cargarEventos(true));
        seccion.querySelectorAll("[data-historial-modo]").forEach(btn => {
            btn.addEventListener("click", () => cambiarModo(btn.dataset.historialModo));
        });
        ["input", "change"].forEach(nombre => {
            seccion.addEventListener(nombre, event => {
                if (event.target?.matches?.("[data-historial-buscar],[data-historial-desde],[data-historial-hasta],[data-historial-tipo]")) {
                    renderizar();
                }
            });
        });
        seccion.querySelector("[data-historial-mas]")?.addEventListener("click", () => {
            limite += 250;
            cargarEventos(true);
        });
    }

    async function consultaPorIds(tabla, select, ids) {
        if (!ids.length) return [];
        const { data, error } = await cliente.from(tabla).select(select).in("id", ids);
        if (error) {
            console.warn(`HAIKU · Historial no pudo enriquecer ${tabla}:`, error);
            return [];
        }
        return data || [];
    }

    async function enriquecer(lista) {
        const usuarioIds = idsUnicos(lista.map(e => e.usuario_id));
        const reservaIds = idsUnicos(lista.map(e => e.reserva_id));
        const cabanaIds = idsUnicos(lista.map(e => e.cabana_id));
        const pagoIds = idsUnicos(lista.filter(e => ["pago", "pagos"].includes(e.entidad_tipo)).map(e => e.entidad_id));
        const servicioIds = idsUnicos(lista.filter(e => e.entidad_tipo === "servicios").map(e => e.entidad_id));

        const [usuarios, reservas, cabanas, pagos, servicios] = await Promise.all([
            consultaPorIds("usuarios", "id,nombre,apellido", usuarioIds),
            consultaPorIds("reservas", "id,codigo_haiku,cloudbeds_id,titular_nombre", reservaIds),
            consultaPorIds("cabanas", "id,numero,nombre", cabanaIds),
            consultaPorIds("pagos", "id,reserva_id,monto,medio_pago,estado,etapa_operativa,tipo_movimiento,codigo_autorizacion,folio,bove,datos_origen", pagoIds),
            consultaPorIds("servicios", "id,reserva_id,total,estado_servicio,fecha_servicio,hora_inicio,tipo_cobro,catalogo_servicios(nombre,codigo)", servicioIds)
        ]);

        contexto.usuarios = new Map(usuarios.map(x => [String(x.id), x]));
        contexto.reservas = new Map(reservas.map(x => [String(x.id), x]));
        contexto.cabanas = new Map(cabanas.map(x => [String(x.id), x]));
        contexto.pagos = new Map(pagos.map(x => [String(x.id), x]));
        contexto.servicios = new Map(servicios.map(x => [String(x.id), x]));
    }

    async function cargarEventos(forzar = false) {
        if (cargando) return;
        if (!forzar && Date.now() - ultimaCarga < 1200) {
            renderizar();
            return;
        }

        const lista = seccion.querySelector("[data-historial-lista]");
        const boton = seccion.querySelector("[data-historial-refresh]");
        cargando = true;
        if (boton) boton.disabled = true;
        if (lista && eventos.length === 0) lista.innerHTML = '<p class="historial-supa-cargando">Cargando actividad desde Supabase…</p>';

        try {
            const { data, error, count } = await cliente
                .from("eventos_auditoria")
                .select("id,usuario_id,accion,tipo_evento,entidad_tipo,entidad_id,reserva_id,estadia_id,cabana_id,turno_id,descripcion,cambios,datos_contexto,origen,creado_en", { count: "exact" })
                .order("creado_en", { ascending: false })
                .range(0, limite - 1);

            if (error) throw error;

            eventos = data || [];
            totalExacto = Number(count || eventos.length);
            await enriquecer(eventos);
            ultimaCarga = Date.now();
            renderizar();
            console.info("HAIKU · Historial Supabase cargado:", eventos.length, "de", totalExacto);
        } catch (error) {
            console.error("HAIKU · No fue posible cargar historial Supabase:", error);
            if (lista) {
                lista.innerHTML = "";
                const p = elemento("p", "historial-supa-error", error?.message?.includes("permission")
                    ? "Tu usuario no tiene permiso para consultar la auditoría."
                    : "No fue posible cargar el historial desde Supabase.");
                lista.appendChild(p);
            }
        } finally {
            cargando = false;
            if (boton) boton.disabled = false;
        }
    }

    function cambiarModo(nuevo) {
        if (!['historial','auditoria'].includes(nuevo)) return;
        if (nuevo === "auditoria" && !permisosLocales().auditoria) {
            alert("Tu usuario no tiene permiso para ver la auditoría técnica.");
            return;
        }
        modo = nuevo;
        seccion.querySelectorAll("[data-historial-modo]").forEach(btn => {
            btn.classList.toggle("activo", btn.dataset.historialModo === modo);
        });
        renderizar();
    }

    function eventosFiltrados(origen = eventos, modoForzado = modo) {
        const buscar = limpiar(seccion.querySelector("[data-historial-buscar]")?.value).toLocaleLowerCase("es-CL");
        const desde = seccion.querySelector("[data-historial-desde]")?.value || "";
        const hasta = seccion.querySelector("[data-historial-hasta]")?.value || "";
        const tipo = seccion.querySelector("[data-historial-tipo]")?.value || "";

        return origen.filter(evento => {
            if (modoForzado === "historial" && esTecnicoOcultoEnHistorial(evento)) return false;
            const fecha = fechaLocal(evento.creado_en);
            if (desde && fecha < desde) return false;
            if (hasta && fecha > hasta) return false;
            if (tipo && categoriaEvento(evento) !== tipo) return false;
            if (buscar && !textoBuscable(evento).includes(buscar)) return false;
            return true;
        });
    }

    function crearCambios(evento) {
        const cambios = normalizarCambios(evento);
        if (!cambios.length) return null;
        const cont = elemento("div", "historial-supa-cambios");
        cambios.forEach(c => {
            const fila = elemento("div", "historial-supa-cambio");
            fila.append(
                elemento("strong", "", nombreCampo(c.campo)),
                elemento("span", "", `${valorHumano(c.anterior, c.campo)} → ${valorHumano(c.nuevo, c.campo)}`)
            );
            cont.appendChild(fila);
        });
        return cont;
    }

    function crearCard(evento, modoCard = modo) {
        const card = elemento("article", "historial-supa-card");
        card.dataset.categoria = categoriaEvento(evento);

        const boton = elemento("button", "historial-supa-card-resumen");
        boton.type = "button";
        boton.setAttribute("aria-expanded", "false");

        const marca = elemento("span", "historial-supa-marca");
        const contenido = elemento("span", "historial-supa-contenido");
        const accion = elemento("span", "historial-supa-accion");
        accion.appendChild(elemento("strong", "", modoCard === "historial" ? tituloHumano(evento) : (evento.accion || "Evento de auditoría")));
        accion.appendChild(elemento("em", "historial-supa-chip", modoCard === "historial" ? categoriaEvento(evento) : `${evento.tipo_evento} · ${evento.entidad_tipo}`));

        const meta = elemento("span", "historial-supa-meta");
        meta.textContent = referenciaHumana(evento);

        const desc = descripcionHumana(evento);
        if (desc && desc !== evento.descripcion) {
            const breve = elemento("span", "historial-supa-meta", desc);
            contenido.append(accion, meta, breve);
        } else {
            contenido.append(accion, meta);
        }

        const pie = elemento("span", "historial-supa-pie");
        pie.append(
            elemento("span", "", fechaHora(evento.creado_en)),
            elemento("span", "", usuarioNombre(evento.usuario_id)),
            elemento("span", "", evento.origen || "usuario")
        );
        contenido.appendChild(pie);

        const indicador = elemento("span", "historial-supa-toggle", "+");
        boton.append(marca, contenido, indicador);

        const detalle = elemento("div", "historial-supa-detalle");
        detalle.hidden = true;
        const descripcion = evento.descripcion || descripcionHumana(evento);
        if (descripcion) detalle.appendChild(elemento("p", "historial-supa-descripcion", descripcion));
        const cambios = crearCambios(evento);
        if (cambios) detalle.appendChild(cambios);

        if (modoCard === "auditoria") {
            const tecnico = elemento("div", "historial-supa-tecnico");
            [
                ["Evento", evento.id],
                ["Entidad", `${evento.entidad_tipo || "—"}${evento.entidad_id ? ` · ${evento.entidad_id}` : ""}`],
                ["Reserva", evento.reserva_id || "—"],
                ["Estadía", evento.estadia_id || "—"],
                ["Cabaña", evento.cabana_id || "—"],
                ["Turno", evento.turno_id || "—"]
            ].forEach(([titulo, valor]) => {
                const caja = elemento("div");
                caja.append(elemento("span", "", titulo), elemento("code", "", valor));
                tecnico.appendChild(caja);
            });
            detalle.appendChild(tecnico);

            const json = elemento("details", "historial-supa-json");
            json.appendChild(elemento("summary", "", "Contexto técnico JSON"));
            json.appendChild(elemento("pre", "", escaparJson(evento.datos_contexto || {})));
            detalle.appendChild(json);
        }

        if (!detalle.childElementCount) detalle.appendChild(elemento("p", "historial-supa-descripcion", "Evento registrado sin detalle adicional."));

        boton.addEventListener("click", () => {
            const abrir = detalle.hidden;
            detalle.hidden = !abrir;
            boton.setAttribute("aria-expanded", String(abrir));
            indicador.textContent = abrir ? "−" : "+";
        });

        card.append(boton, detalle);
        return card;
    }

    function pintarLista(contenedor, lista, modoCard, vacio) {
        contenedor.innerHTML = "";
        if (!lista.length) {
            contenedor.appendChild(elemento("p", "historial-supa-vacio", vacio));
            return;
        }
        lista.forEach(evento => contenedor.appendChild(crearCard(evento, modoCard)));
    }

    function renderizar() {
        const listaEl = seccion.querySelector("[data-historial-lista]");
        const contador = seccion.querySelector("[data-historial-contador]");
        const fuente = seccion.querySelector("[data-historial-fuente]");
        const masWrap = seccion.querySelector("[data-historial-mas-wrap]");
        if (!listaEl) return;

        const lista = eventosFiltrados();
        if (contador) contador.textContent = `${lista.length} ${lista.length === 1 ? "evento" : "eventos"}`;
        if (fuente) fuente.textContent = modo === "historial" ? "Vista operativa · Supabase" : "Auditoría completa · Supabase";
        pintarLista(
            listaEl,
            lista,
            modo,
            modo === "historial"
                ? "No hay actividad operativa para mostrar con estos filtros."
                : "No hay eventos de auditoría para mostrar con estos filtros."
        );
        if (masWrap) masWrap.hidden = eventos.length >= totalExacto;
    }

    function asegurarModalReserva() {
        let modal = document.getElementById("historial-supa-reserva-modal");
        if (modal) return modal;
        modal = elemento("div", "historial-supa-modal");
        modal.id = "historial-supa-reserva-modal";
        modal.hidden = true;
        modal.innerHTML = `
            <section class="historial-supa-modal-card" role="dialog" aria-modal="true">
                <header class="historial-supa-modal-head">
                    <div>
                        <h3>Historial de la reserva</h3>
                        <p data-historial-reserva-meta>Preparando…</p>
                    </div>
                    <button type="button" class="historial-supa-modal-cerrar" data-historial-reserva-cerrar aria-label="Cerrar">×</button>
                </header>
                <div class="historial-supa-modal-body">
                    <div class="historial-supa-lista" data-historial-reserva-lista>
                        <p class="historial-supa-cargando">Cargando historial…</p>
                    </div>
                </div>
            </section>
        `;
        document.body.appendChild(modal);
        modal.querySelector("[data-historial-reserva-cerrar]")?.addEventListener("click", () => cerrarModalReserva());
        modal.addEventListener("click", event => {
            if (event.target === modal) cerrarModalReserva();
        });
        return modal;
    }

    function cerrarModalReserva() {
        const modal = document.getElementById("historial-supa-reserva-modal");
        if (!modal) return;
        modal.hidden = true;
        document.body.style.overflow = "";
    }

    async function abrirHistorialReserva() {
        const ficha = document.getElementById("ficha-reserva-modal");
        const reservaId = ficha?.dataset.reservaId || "";
        if (!reservaId) return;

        const modal = asegurarModalReserva();
        const listaEl = modal.querySelector("[data-historial-reserva-lista]");
        const meta = modal.querySelector("[data-historial-reserva-meta]");
        const titular = document.getElementById("ficha-huesped-titular")?.textContent?.trim() || "";
        const cabana = ficha?.dataset.numeroCabana || "";
        if (meta) meta.textContent = [cabana ? `CAB ${cabana}` : "", titular].filter(Boolean).join(" · ") || "Reserva HAIKU";
        if (listaEl) listaEl.innerHTML = '<p class="historial-supa-cargando">Cargando historial desde Supabase…</p>';
        modal.hidden = false;
        document.body.style.overflow = "hidden";

        try {
            const { data, error } = await cliente
                .from("eventos_auditoria")
                .select("id,usuario_id,accion,tipo_evento,entidad_tipo,entidad_id,reserva_id,estadia_id,cabana_id,turno_id,descripcion,cambios,datos_contexto,origen,creado_en")
                .eq("reserva_id", reservaId)
                .order("creado_en", { ascending: false })
                .limit(400);
            if (error) throw error;
            const lista = data || [];
            await enriquecer([...eventos, ...lista]);
            const visibles = lista.filter(e => !esTecnicoOcultoEnHistorial(e));
            pintarLista(listaEl, visibles, "historial", "Esta reserva todavía no tiene actividad registrada en Supabase.");
        } catch (error) {
            console.error("HAIKU · No fue posible abrir historial de reserva:", error);
            if (listaEl) {
                listaEl.innerHTML = "";
                listaEl.appendChild(elemento("p", "historial-supa-error", "No fue posible cargar el historial de esta reserva."));
            }
        }
    }

    construirUI();
    asegurarModalReserva();

    // Intercepta el antiguo botón de historial de la ficha antes del listener legacy.
    document.addEventListener("click", event => {
        const botonFicha = event.target?.closest?.("#ficha-reserva-historial");
        if (botonFicha) {
            event.preventDefault();
            event.stopImmediatePropagation();
            abrirHistorialReserva();
            return;
        }

        const enlace = event.target?.closest?.('[data-seccion="historial"]');
        if (enlace) setTimeout(() => cargarEventos(true), 70);
    }, true);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") cerrarModalReserva();
    });

    // Cuando Historial pasa realmente a visible, pide una copia fresca a Supabase.
    let visibleAnterior = seccion.classList.contains("activa");
    const observador = new MutationObserver(() => {
        const visible = seccion.classList.contains("activa") && !seccion.hidden;
        if (visible && !visibleAnterior) setTimeout(() => cargarEventos(true), 30);
        visibleAnterior = visible;
    });
    observador.observe(seccion, { attributes: true, attributeFilter: ["class", "hidden", "style"] });

    window.addEventListener("haiku:auth-ready", () => {
        setTimeout(() => {
            if (seccion.classList.contains("activa")) cargarEventos(true);
        }, 250);
    });

    setTimeout(() => {
        if (window.haikuSesion && seccion.classList.contains("activa")) cargarEventos(true);
    }, 700);

    window.HistorialSupabase = {
        cargar: () => cargarEventos(true),
        abrirReserva: abrirHistorialReserva,
        eventos: () => [...eventos]
    };

    console.info("HAIKU · Historial + Auditoría Supabase V1 preparado.");
})();
