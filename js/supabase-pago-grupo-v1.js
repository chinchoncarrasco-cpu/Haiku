// ========================================
// HAIKU · PAGO POR TITULAR / RESERVA CONJUNTA · V1
// Un pago visible; distribución interna por reserva.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let guardando = false;
    let resumenActual = null;
    let reservaSeleccionada = "";
    let secuenciaFicha = 0;

    const dinero = valor => `$${Math.round(Number(valor || 0)).toLocaleString("es-CL")}`;

    function fechaActual() {
        try { return String(fechaSeleccionada || "").slice(0, 10); }
        catch { return ""; }
    }

    function crearBoton() {
        const cabecera = document.querySelector("#seccion-pagos .cabecera");
        if (!cabecera || cabecera.querySelector(".haiku-anadir-pago-boton")) return;

        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "haiku-anadir-pago-boton";
        boton.textContent = "Añadir pago";
        boton.addEventListener("click", abrirModal);

        const ajustar = cabecera.querySelector(".haiku-ajuste-cargo-boton");
        ajustar ? cabecera.insertBefore(boton, ajustar) : cabecera.appendChild(boton);
    }

    function crearModal() {
        if (document.getElementById("haiku-pago-grupo-overlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "haiku-pago-grupo-overlay";
        overlay.className = "haiku-pago-grupo-overlay";
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="haiku-pago-grupo-modal" role="dialog" aria-modal="true" aria-labelledby="haiku-pago-grupo-titulo">
                <div class="haiku-pago-grupo-cabecera">
                    <div>
                        <small>Control financiero</small>
                        <h3 id="haiku-pago-grupo-titulo">Añadir pago</h3>
                    </div>
                    <button type="button" class="haiku-pago-grupo-cerrar" data-haiku-pago-cerrar aria-label="Cerrar">×</button>
                </div>
                <div class="haiku-pago-grupo-cuerpo">
                    <div class="haiku-pago-grupo-campo">
                        <label for="haiku-pago-reserva">Titular / reserva</label>
                        <select id="haiku-pago-reserva" class="haiku-pago-grupo-select">
                            <option value="">Seleccionar...</option>
                        </select>
                    </div>

                    <div id="haiku-pago-vinculo" class="haiku-pago-grupo-vinculo" hidden></div>

                    <div id="haiku-pago-resumen" class="haiku-pago-grupo-resumen" hidden>
                        <div><span>Total alojamiento</span><strong id="haiku-pago-total">$0</strong></div>
                        <div><span>Abonado</span><strong id="haiku-pago-abonado">$0</strong></div>
                        <div class="saldo"><span>Saldo</span><strong id="haiku-pago-saldo">$0</strong></div>
                    </div>

                    <div class="haiku-pago-grupo-grid">
                        <div class="haiku-pago-grupo-campo">
                            <label for="haiku-pago-monto">Monto de este pago</label>
                            <input id="haiku-pago-monto" class="haiku-pago-grupo-input" type="number" min="1" step="1" inputmode="numeric" placeholder="0">
                        </div>
                        <div class="haiku-pago-grupo-campo">
                            <label for="haiku-pago-medio">Medio de pago</label>
                            <select id="haiku-pago-medio" class="haiku-pago-grupo-select">
                                <option value="">Seleccionar...</option>
                                <option value="transferencia">Transferencia</option>
                                <option value="webpay_credito">WebPay Crédito</option>
                                <option value="webpay_debito">WebPay Débito</option>
                                <option value="tarjeta_credito">Tarjeta Crédito</option>
                                <option value="tarjeta_debito">Tarjeta Débito</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                    </div>

                    <div class="haiku-pago-grupo-grid">
                        <div class="haiku-pago-grupo-campo haiku-pago-grupo-extra" data-extra="glosa" hidden>
                            <label for="haiku-pago-glosa">Glosa</label>
                            <input id="haiku-pago-glosa" class="haiku-pago-grupo-input" type="text" placeholder="Pegar glosa bancaria">
                        </div>
                        <div class="haiku-pago-grupo-campo haiku-pago-grupo-extra" data-extra="codaut" hidden>
                            <label for="haiku-pago-codaut">CodAut</label>
                            <input id="haiku-pago-codaut" class="haiku-pago-grupo-input" type="text" placeholder="Código autorización">
                        </div>
                        <div class="haiku-pago-grupo-campo haiku-pago-grupo-extra" data-extra="folio" hidden>
                            <label for="haiku-pago-folio">Folio</label>
                            <input id="haiku-pago-folio" class="haiku-pago-grupo-input" type="text" placeholder="Folio de transacción">
                        </div>
                        <div class="haiku-pago-grupo-campo haiku-pago-grupo-extra" data-extra="bove" hidden>
                            <label for="haiku-pago-bove">BOVTAR</label>
                            <input id="haiku-pago-bove" class="haiku-pago-grupo-input" type="text" placeholder="Código BOVTAR">
                        </div>
                    </div>

                    <div class="haiku-pago-grupo-campo">
                        <label for="haiku-pago-observacion">Nota opcional</label>
                        <textarea id="haiku-pago-observacion" class="haiku-pago-grupo-textarea" placeholder="Ej: Abono recibido por titular..."></textarea>
                    </div>

                    <div id="haiku-pago-estado" class="haiku-pago-grupo-estado" aria-live="polite"></div>

                    <div class="haiku-pago-grupo-acciones">
                        <button type="button" class="haiku-pago-grupo-cancelar" data-haiku-pago-cerrar>Cancelar</button>
                        <button type="button" id="haiku-pago-confirmar" class="haiku-pago-grupo-confirmar" disabled>Registrar pago</button>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        overlay.addEventListener("click", evento => {
            if (evento.target === overlay) cerrarModal();
        });
        overlay.querySelectorAll("[data-haiku-pago-cerrar]").forEach(b => b.addEventListener("click", cerrarModal));
        overlay.querySelector("#haiku-pago-reserva")?.addEventListener("change", async evento => {
            reservaSeleccionada = evento.target.value || "";
            await cargarResumenSeleccionado();
        });
        overlay.querySelector("#haiku-pago-medio")?.addEventListener("change", actualizarExtras);
        overlay.querySelector("#haiku-pago-monto")?.addEventListener("input", validarFormulario);
        overlay.querySelector("#haiku-pago-confirmar")?.addEventListener("click", registrarPago);
    }

    function estado(texto = "", tipo = "") {
        const el = document.getElementById("haiku-pago-estado");
        if (!el) return;
        el.className = "haiku-pago-grupo-estado" + (tipo ? ` ${tipo}` : "");
        el.textContent = texto;
    }

    function resetModal() {
        reservaSeleccionada = "";
        resumenActual = null;
        guardando = false;
        ["haiku-pago-monto","haiku-pago-glosa","haiku-pago-codaut","haiku-pago-folio","haiku-pago-bove","haiku-pago-observacion"].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = "";
        });
        const medio = document.getElementById("haiku-pago-medio"); if (medio) medio.value = "";
        const resumen = document.getElementById("haiku-pago-resumen"); if (resumen) resumen.hidden = true;
        const vinculo = document.getElementById("haiku-pago-vinculo"); if (vinculo) { vinculo.hidden = true; vinculo.textContent = ""; }
        document.querySelectorAll(".haiku-pago-grupo-extra").forEach(el => el.hidden = true);
        const confirmar = document.getElementById("haiku-pago-confirmar"); if (confirmar) { confirmar.disabled = true; confirmar.textContent = "Registrar pago"; }
        estado("");
    }

    async function obtenerReservasDia() {
        const fecha = fechaActual();
        if (!fecha) return [];

        const { data, error } = await cliente.rpc("haiku_operacion_dia", { p_fecha: fecha });
        if (error) throw error;

        const base = new Map();
        const agregar = (numero, reservaId, titular, contexto) => {
            if (!reservaId || base.has(String(reservaId))) return;
            base.set(String(reservaId), {
                reservaId: String(reservaId),
                numero: Number(numero || 0),
                titular: titular || "Sin titular",
                contexto: contexto || ""
            });
        };

        (data || []).forEach(fila => {
            agregar(fila.numero, fila.ingreso_reserva_id, fila.ingreso_titular, "Ingresa");
            agregar(fila.numero, fila.continua_reserva_id, fila.continua_titular, "Continúa");
            agregar(fila.numero, fila.salida_reserva_id, fila.salida_titular, "Sale");
            agregar(fila.numero, fila.fullday_reserva_id, fila.fullday_titular, "Full Day");
        });

        const items = [...base.values()];
        if (!items.length) return [];

        const { data: reservas, error: eReservas } = await cliente
            .from("reservas")
            .select("id,grupo_reserva_id,titular_nombre")
            .in("id", items.map(i => i.reservaId));
        if (eReservas) throw eReservas;

        const meta = new Map((reservas || []).map(r => [String(r.id), r]));
        const grupos = new Map();

        items.forEach(item => {
            const r = meta.get(item.reservaId) || {};
            const key = r.grupo_reserva_id ? `g:${r.grupo_reserva_id}` : `r:${item.reservaId}`;
            if (!grupos.has(key)) {
                grupos.set(key, {
                    reservaId: item.reservaId,
                    grupoId: r.grupo_reserva_id || "",
                    titular: r.titular_nombre || item.titular,
                    cabs: [],
                    contextos: []
                });
            }
            const g = grupos.get(key);
            if (item.numero && !g.cabs.includes(item.numero)) g.cabs.push(item.numero);
            if (item.contexto && !g.contextos.includes(item.contexto)) g.contextos.push(item.contexto);
        });

        return [...grupos.values()].map(g => {
            g.cabs.sort((a,b) => a-b);
            return g;
        }).sort((a,b) => (a.cabs[0] || 999) - (b.cabs[0] || 999));
    }

    async function cargarReservas() {
        const select = document.getElementById("haiku-pago-reserva");
        if (!select) return;
        select.disabled = true;
        select.innerHTML = `<option value="">Cargando...</option>`;
        try {
            const items = await obtenerReservasDia();
            select.innerHTML = `<option value="">Seleccionar titular / reserva...</option>`;
            items.forEach(item => {
                const op = document.createElement("option");
                op.value = item.reservaId;
                op.textContent = item.grupoId
                    ? `↳ ${item.titular} · ${item.cabs.map(n => `CAB ${n}`).join(" + ")}`
                    : `CAB ${item.cabs[0] || "—"} · ${item.titular}`;
                select.appendChild(op);
            });
            if (!items.length) select.innerHTML = `<option value="">No hay reservas para esta fecha</option>`;
        } catch (error) {
            console.error("HAIKU · cargar titulares para pago:", error);
            select.innerHTML = `<option value="">No fue posible cargar reservas</option>`;
            estado(error?.message || "No fue posible cargar las reservas.", "error");
        } finally {
            select.disabled = false;
        }
    }

    async function finanzasReserva(reservaId) {
        const { data: grupo, error: eGrupo } = await cliente.rpc("haiku_finanzas_grupo", { p_reserva_id: reservaId });
        if (eGrupo) throw eGrupo;
        if (grupo?.es_grupo) return grupo;

        const { data: cargos, error } = await cliente
            .from("vista_estado_cargos")
            .select("tipo_cargo,estado,monto_ajustado,aplicado_neto,saldo_cargo")
            .eq("reserva_id", reservaId);
        if (error) throw error;

        const activos = (cargos || []).filter(c => c.estado === "activo");
        const alojamiento = activos.filter(c => c.tipo_cargo === "alojamiento");
        const servicios = activos.filter(c => c.tipo_cargo === "servicio");
        return {
            es_grupo: false,
            reserva_id: reservaId,
            total_alojamiento: alojamiento.reduce((s,c) => s + Number(c.monto_ajustado || 0), 0),
            abonado_alojamiento: alojamiento.reduce((s,c) => s + Number(c.aplicado_neto || 0), 0),
            saldo_alojamiento: alojamiento.reduce((s,c) => s + Number(c.saldo_cargo || 0), 0),
            servicios_pendientes: servicios.reduce((s,c) => s + Number(c.saldo_cargo || 0), 0),
            miembros: []
        };
    }

    async function cargarResumenSeleccionado() {
        resumenActual = null;
        if (!reservaSeleccionada) {
            const r = document.getElementById("haiku-pago-resumen"); if (r) r.hidden = true;
            validarFormulario();
            return;
        }

        estado("Cargando saldo...");
        try {
            resumenActual = await finanzasReserva(reservaSeleccionada);
            document.getElementById("haiku-pago-total").textContent = dinero(resumenActual.total_alojamiento);
            document.getElementById("haiku-pago-abonado").textContent = dinero(resumenActual.abonado_alojamiento);
            document.getElementById("haiku-pago-saldo").textContent = dinero(resumenActual.saldo_alojamiento);
            const resumen = document.getElementById("haiku-pago-resumen"); if (resumen) resumen.hidden = false;

            const vinculo = document.getElementById("haiku-pago-vinculo");
            if (vinculo) {
                if (resumenActual.es_grupo) {
                    const cabs = (resumenActual.miembros || []).map(m => `CAB ${m.cabana}`).join(" · ");
                    vinculo.textContent = `↳ Reserva conjunta · ${cabs}`;
                    vinculo.hidden = false;
                } else {
                    vinculo.textContent = "";
                    vinculo.hidden = true;
                }
            }

            const monto = document.getElementById("haiku-pago-monto");
            if (monto) {
                monto.value = String(Number(resumenActual.saldo_alojamiento || 0));
                monto.max = String(Number(resumenActual.saldo_alojamiento || 0));
            }
            estado("");
            validarFormulario();
        } catch (error) {
            console.error("HAIKU · resumen de pago:", error);
            estado(error?.message || "No fue posible cargar el saldo.", "error");
        }
    }

    function actualizarExtras() {
        const medio = document.getElementById("haiku-pago-medio")?.value || "";
        const visibles = new Set();
        if (medio === "transferencia") visibles.add("glosa");
        if (["webpay_credito","webpay_debito"].includes(medio)) visibles.add("codaut");
        if (["tarjeta_credito","tarjeta_debito"].includes(medio)) { visibles.add("folio"); visibles.add("bove"); }
        document.querySelectorAll(".haiku-pago-grupo-extra").forEach(el => {
            el.hidden = !visibles.has(el.dataset.extra || "");
        });
        validarFormulario();
    }

    function validarFormulario() {
        const confirmar = document.getElementById("haiku-pago-confirmar");
        if (!confirmar) return;
        const monto = Number(document.getElementById("haiku-pago-monto")?.value || 0);
        const medio = document.getElementById("haiku-pago-medio")?.value || "";
        const saldo = Number(resumenActual?.saldo_alojamiento || 0);
        confirmar.disabled = guardando || !reservaSeleccionada || !resumenActual || monto <= 0 || monto > saldo || !medio;
    }

    function validarDetalles(medio) {
        const valor = id => document.getElementById(id)?.value?.trim() || "";
        const datos = {
            glosa: valor("haiku-pago-glosa"),
            codaut: valor("haiku-pago-codaut"),
            folio: valor("haiku-pago-folio"),
            bove: valor("haiku-pago-bove"),
            observacion: valor("haiku-pago-observacion")
        };
        if (medio === "transferencia" && !datos.glosa) throw new Error("Ingresa la glosa de la transferencia.");
        if (["webpay_credito","webpay_debito"].includes(medio) && !datos.codaut) throw new Error("Ingresa el CodAut de WebPay.");
        if (["tarjeta_credito","tarjeta_debito"].includes(medio) && (!datos.folio || !datos.bove)) throw new Error("Ingresa Folio y BOVTAR.");
        return datos;
    }

    async function registrarPago() {
        if (guardando || !reservaSeleccionada || !resumenActual) return;
        if (typeof window.haikuTienePermiso === "function" && !window.haikuTienePermiso("pagos.registrar")) {
            alert("Tu usuario no tiene permiso para registrar pagos.");
            return;
        }

        const monto = Math.round(Number(document.getElementById("haiku-pago-monto")?.value || 0));
        const medio = document.getElementById("haiku-pago-medio")?.value || "";
        const saldo = Number(resumenActual.saldo_alojamiento || 0);
        if (monto <= 0 || monto > saldo || !medio) return;

        let datos;
        try { datos = validarDetalles(medio); }
        catch (error) { estado(error.message, "error"); return; }

        guardando = true;
        validarFormulario();
        const confirmar = document.getElementById("haiku-pago-confirmar");
        if (confirmar) confirmar.textContent = "Registrando...";
        estado("Registrando pago...");

        try {
            const { data, error } = await cliente.rpc("haiku_registrar_pago_grupo", {
                p_reserva_id: reservaSeleccionada,
                p_monto: monto,
                p_medio_pago: medio,
                p_etapa_operativa: "abono",
                p_fecha_pago: new Date().toISOString(),
                p_folio: datos.folio || null,
                p_codigo_autorizacion: datos.codaut || null,
                p_bove: datos.bove || null,
                p_referencia_externa: datos.glosa || null,
                p_observaciones: datos.observacion || null
            });
            if (error) throw error;

            estado(resumenActual.es_grupo ? "Pago conjunto registrado." : "Pago registrado.", "exito");

            await Promise.allSettled([
                Promise.resolve().then(() => window.haikuCargarAbonosSupabase?.()),
                Promise.resolve().then(() => window.haikuCargarSaldosCheckinSupabase?.()),
                Promise.resolve().then(() => window.haikuSincronizarReservasSupabase?.())
            ]);

            await refrescarFichaFinanzas();
            setTimeout(() => cerrarModal(true), 550);
            return data;
        } catch (error) {
            console.error("HAIKU · registrar pago por titular:", error);
            estado(error?.message || "No fue posible registrar el pago.", "error");
        } finally {
            guardando = false;
            if (confirmar) confirmar.textContent = "Registrar pago";
            validarFormulario();
        }
    }

    async function abrirModal() {
        if (!window.haikuSesion) {
            alert("Debes iniciar sesión para registrar pagos.");
            return;
        }
        if (typeof window.haikuTienePermiso === "function" && !window.haikuTienePermiso("pagos.registrar")) {
            alert("Tu usuario no tiene permiso para registrar pagos.");
            return;
        }
        const overlay = document.getElementById("haiku-pago-grupo-overlay");
        if (!overlay) return;
        resetModal();
        overlay.hidden = false;
        document.body.style.overflow = "hidden";
        await cargarReservas();
    }

    function cerrarModal(forzar = false) {
        const overlay = document.getElementById("haiku-pago-grupo-overlay");
        if (!overlay || (guardando && !forzar)) return;
        overlay.hidden = true;
        document.body.style.overflow = "";
    }

    function etiquetaFicha(indice, texto) {
        const label = document.querySelector(`#ficha-reserva-modal .ficha-pagos > div:nth-child(${indice}) > span`);
        if (label) label.textContent = texto;
    }

    function limpiarNotaFicha() {
        document.querySelector("#ficha-reserva-modal .haiku-ficha-finanzas-grupo-nota")?.remove();
    }

    async function refrescarFichaFinanzas() {
        const modal = document.getElementById("ficha-reserva-modal");
        if (!modal || modal.hidden) return;
        const reservaId = modal.dataset.reservaId || "";
        if (!reservaId) return;

        const turno = ++secuenciaFicha;
        try {
            const datos = await finanzasReserva(reservaId);
            if (turno !== secuenciaFicha) return;

            limpiarNotaFicha();
            if (!datos?.es_grupo) {
                etiquetaFicha(1, "Total reserva");
                etiquetaFicha(2, "Abono");
                etiquetaFicha(3, "Saldo");
                etiquetaFicha(4, "Servicios pendientes");
                return;
            }

            const valores = {
                "ficha-pago-total": datos.total_alojamiento,
                "ficha-pago-abono": datos.abonado_alojamiento,
                "ficha-pago-saldo": datos.saldo_alojamiento,
                "ficha-pago-servicios": datos.servicios_pendientes
            };
            Object.entries(valores).forEach(([id, valor]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = dinero(valor);
            });
            etiquetaFicha(1, "Total grupo");
            etiquetaFicha(2, "Abono grupo");
            etiquetaFicha(3, "Saldo grupo");
            etiquetaFicha(4, "Servicios grupo");

            const pagos = document.querySelector("#ficha-reserva-modal .ficha-pagos");
            if (pagos) {
                const nota = document.createElement("div");
                nota.className = "haiku-ficha-finanzas-grupo-nota";
                nota.textContent = `↳ Valores conjuntos · ${(datos.miembros || []).map(m => `CAB ${m.cabana}`).join(" · ")}`;
                pagos.insertAdjacentElement("afterend", nota);
            }
        } catch (error) {
            console.warn("HAIKU · finanzas conjuntas en ficha:", error);
        }
    }

    function observarFicha() {
        const modal = document.getElementById("ficha-reserva-modal");
        if (!modal || modal.dataset.haikuPagoGrupoObservado === "1") return;
        modal.dataset.haikuPagoGrupoObservado = "1";
        new MutationObserver(() => {
            if (!modal.hidden && modal.dataset.reservaId) {
                queueMicrotask(() => refrescarFichaFinanzas());
            }
        }).observe(modal, { attributes:true, attributeFilter:["hidden","data-reserva-id"] });
    }

    function instalar() {
        crearModal();
        crearBoton();
        observarFicha();
    }

    window.addEventListener("haiku:auth-ready", () => setTimeout(instalar, 100));
    window.addEventListener("load", () => setTimeout(instalar, 180));
    document.addEventListener("click", evento => {
        if (evento.target.closest?.('[data-seccion="pagos"]')) setTimeout(crearBoton, 80);
    });

    setTimeout(instalar, 220);

    window.HAIKU_PAGO_GRUPO_V1 = Object.freeze({
        abrir: abrirModal,
        refrescarFicha: refrescarFichaFinanzas
    });

    console.info("HAIKU · Pago por titular / reserva conjunta V1 preparado.");
})();
