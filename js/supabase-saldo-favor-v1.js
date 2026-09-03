// ========================================
// HAIKU · SALDO A FAVOR V1
// Excedentes de pagos de alojamiento reutilizables en servicios.
// ========================================
(() => {
    "use strict";

    const sb = window.haikuSupabase;
    if (!sb) return;

    let cache = new Map();
    let timerDecoracion = 0;
    let registrandoExcedente = false;
    let aplicandoCredito = false;
    let modalResumen = null;

    const MEDIOS_UI = Object.freeze({
        transferencia: "Transferencia",
        webpay_credito: "WebPay Crédito",
        webpay_debito: "WebPay Débito",
        tarjeta_credito: "Tarjeta Crédito",
        tarjeta_debito: "Tarjeta Débito",
        efectivo: "Efectivo",
        otro: "Otro"
    });

    const dinero = valor => `$${Math.round(Number(valor || 0)).toLocaleString("es-CL")}`;

    function esc(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function fechaCorta(valor) {
        if (!valor) return "";
        try {
            return new Intl.DateTimeFormat("es-CL", {
                timeZone: "America/Santiago",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }).format(new Date(valor));
        } catch {
            return String(valor).slice(0, 10);
        }
    }

    function horaCorta(valor) {
        return valor ? String(valor).slice(0, 5) : "";
    }

    function fechaPagoISO(valor) {
        const fecha = String(valor || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "";
        return `${fecha}T12:00:00.000Z`;
    }

    function montoTexto(id) {
        return Number(
            String(document.getElementById(id)?.textContent || "0")
                .replace(/[^0-9-]/g, "")
        ) || 0;
    }

    function medioTexto(medio) {
        return MEDIOS_UI[medio] || medio || "Sin medio";
    }

    function origenTexto(fuente, { incluirDisponible = true } = {}) {
        const partes = [medioTexto(fuente?.medio_pago)];
        if (fuente?.glosa) partes.push(`Glosa: ${fuente.glosa}`);
        if (fuente?.codigo_autorizacion) partes.push(`CodAut: ${fuente.codigo_autorizacion}`);
        if (fuente?.folio) partes.push(`Folio: ${fuente.folio}`);
        if (fuente?.bovtar) partes.push(`BOVTAR: ${fuente.bovtar}`);
        if (fuente?.fecha_pago) partes.push(fechaCorta(fuente.fecha_pago));
        if (incluirDisponible) partes.push(`Disponible ${dinero(fuente?.disponible || 0)}`);
        return partes.join(" · ");
    }

    async function resumenSaldoFavor(reservaId, { fresco = false } = {}) {
        const id = String(reservaId || "");
        if (!id) return null;

        const previo = cache.get(id);
        if (!fresco && previo && Date.now() - previo.ts < 10000) return previo.data;

        const { data, error } = await sb.rpc("haiku_saldo_favor_unidad", {
            p_reserva_id: id
        });
        if (error) throw error;

        const normal = data || {
            saldo_a_favor: 0,
            fuentes: [],
            cargos_servicio: []
        };
        cache.set(id, { ts: Date.now(), data: normal });
        return normal;
    }

    function invalidarCache(reservaId = "") {
        if (reservaId) cache.delete(String(reservaId));
        else cache.clear();
    }

    // ----------------------------------------
    // AÑADIR PAGO · permite excedente
    // ----------------------------------------
    function asegurarCeldaSaldoFavor() {
        const resumen = document.getElementById("haiku-pago-resumen");
        if (!resumen) return null;

        let celda = resumen.querySelector(".haiku-pago-saldo-favor-celda");
        if (!celda) {
            celda = document.createElement("div");
            celda.className = "haiku-pago-saldo-favor-celda";
            celda.innerHTML = `<span>Saldo a favor</span><strong id="haiku-pago-saldo-favor">$0</strong>`;
            resumen.appendChild(celda);
        }
        return celda;
    }

    function asegurarPreviewExcedente() {
        const resumen = document.getElementById("haiku-pago-resumen");
        if (!resumen) return null;

        let preview = document.getElementById("haiku-pago-excedente-preview");
        if (!preview) {
            preview = document.createElement("div");
            preview.id = "haiku-pago-excedente-preview";
            preview.className = "haiku-pago-excedente-preview";
            preview.hidden = true;
            resumen.insertAdjacentElement("afterend", preview);
        }
        return preview;
    }

    function actualizarPreviewExcedente() {
        const monto = Math.round(Number(document.getElementById("haiku-pago-monto")?.value || 0));
        const saldo = montoTexto("haiku-pago-saldo");
        const preview = asegurarPreviewExcedente();
        if (!preview) return;

        const excedente = Math.max(0, monto - Math.max(0, saldo));
        if (monto <= 0 || excedente <= 0) {
            preview.hidden = true;
            preview.textContent = "";
            return;
        }

        const aplicado = Math.min(monto, Math.max(0, saldo));
        preview.innerHTML = `
            <strong>${dinero(excedente)} quedará como saldo a favor</strong>
            <span>${aplicado > 0
                ? `${dinero(aplicado)} se aplicarán al alojamiento y el excedente quedará disponible para servicios.`
                : `El alojamiento ya está pagado; este monto quedará disponible íntegramente para servicios.`}</span>`;
        preview.hidden = false;
    }

    function datosPagoModal() {
        const valor = id => document.getElementById(id)?.value?.trim() || "";
        return {
            reservaId: document.getElementById("haiku-pago-reserva")?.value || "",
            monto: Math.round(Number(document.getElementById("haiku-pago-monto")?.value || 0)),
            medio: document.getElementById("haiku-pago-medio")?.value || "",
            fecha: fechaPagoISO(document.getElementById("haiku-pago-fecha")?.value || ""),
            glosa: valor("haiku-pago-glosa"),
            codaut: valor("haiku-pago-codaut"),
            folio: valor("haiku-pago-folio"),
            bove: valor("haiku-pago-bove"),
            observacion: valor("haiku-pago-observacion")
        };
    }

    function datosPagoModalValidos(datos, { detalles = false } = {}) {
        if (!datos.reservaId || datos.monto <= 0 || !datos.medio || !datos.fecha) return false;
        if (!detalles) return true;
        if (datos.medio === "transferencia" && !datos.glosa) return false;
        if (["webpay_credito", "webpay_debito"].includes(datos.medio) && !datos.codaut) return false;
        if (["tarjeta_credito", "tarjeta_debito"].includes(datos.medio) && (!datos.folio || !datos.bove)) return false;
        return true;
    }

    function habilitarExcedenteModal() {
        const select = document.getElementById("haiku-pago-reserva");
        const input = document.getElementById("haiku-pago-monto");
        const boton = document.getElementById("haiku-pago-confirmar");
        if (!select || !input || !boton || !select.value) return;
        if (document.getElementById("haiku-abono-edicion-aviso")) return;

        input.removeAttribute("max");
        input.disabled = false;

        const datos = datosPagoModal();
        const saldo = montoTexto("haiku-pago-saldo");
        if ((datos.monto > saldo || saldo <= 0) && datosPagoModalValidos(datos)) {
            boton.disabled = false;
        }
        actualizarPreviewExcedente();
    }

    async function decorarModalPago() {
        const select = document.getElementById("haiku-pago-reserva");
        const overlay = document.getElementById("haiku-pago-grupo-overlay");
        if (!select || !overlay || overlay.hidden || !select.value) return;

        asegurarCeldaSaldoFavor();
        asegurarPreviewExcedente();
        habilitarExcedenteModal();

        try {
            const resumen = await resumenSaldoFavor(select.value);
            if (select.value !== document.getElementById("haiku-pago-reserva")?.value) return;
            const valor = document.getElementById("haiku-pago-saldo-favor");
            if (valor) valor.textContent = dinero(resumen?.saldo_a_favor || 0);
        } catch (error) {
            console.warn("HAIKU · saldo a favor en Añadir pago:", error);
        }
    }

    async function registrarExcedenteModal() {
        if (registrandoExcedente) return;
        if (document.getElementById("haiku-abono-edicion-aviso")) return;

        const datos = datosPagoModal();
        const saldo = montoTexto("haiku-pago-saldo");
        if (!(datos.monto > saldo || saldo <= 0)) return;

        if (!datosPagoModalValidos(datos)) return;
        if (datos.medio === "transferencia" && !datos.glosa) {
            return ponerEstadoPago("Ingresa la glosa de la transferencia.", "error");
        }
        if (["webpay_credito", "webpay_debito"].includes(datos.medio) && !datos.codaut) {
            return ponerEstadoPago("Ingresa el CodAut de WebPay.", "error");
        }
        if (["tarjeta_credito", "tarjeta_debito"].includes(datos.medio) && (!datos.folio || !datos.bove)) {
            return ponerEstadoPago("Ingresa Folio y BOVTAR.", "error");
        }
        if (!window.haikuTienePermiso?.("pagos.registrar")) {
            return ponerEstadoPago("Tu usuario no tiene permiso para registrar pagos.", "error");
        }

        registrandoExcedente = true;
        const boton = document.getElementById("haiku-pago-confirmar");
        const textoAnterior = boton?.textContent || "Registrar pago";
        if (boton) {
            boton.disabled = true;
            boton.textContent = "Registrando...";
        }
        ponerEstadoPago("Registrando pago y saldo a favor...");

        try {
            const { data, error } = await sb.rpc("haiku_registrar_pago_grupo", {
                p_reserva_id: datos.reservaId,
                p_monto: datos.monto,
                p_medio_pago: datos.medio,
                p_etapa_operativa: "abono",
                p_fecha_pago: datos.fecha,
                p_folio: ["tarjeta_credito", "tarjeta_debito"].includes(datos.medio) ? (datos.folio || null) : null,
                p_codigo_autorizacion: ["webpay_credito", "webpay_debito"].includes(datos.medio) ? (datos.codaut || null) : null,
                p_bove: ["tarjeta_credito", "tarjeta_debito"].includes(datos.medio) ? (datos.bove || null) : null,
                p_referencia_externa: datos.medio === "transferencia" ? (datos.glosa || null) : null,
                p_observaciones: datos.observacion || null
            });
            if (error) throw error;

            invalidarCache(datos.reservaId);
            await Promise.allSettled([
                Promise.resolve().then(() => window.haikuCargarAbonosSupabase?.()),
                Promise.resolve().then(() => window.haikuCargarSaldosCheckinSupabase?.()),
                Promise.resolve().then(() => window.haikuSincronizarReservasSupabase?.()),
                Promise.resolve().then(() => window.haikuCargarCheckoutSupabase?.()),
                Promise.resolve().then(() => window.HAIKU_EDITAR_ABONOS_V1?.refrescar?.())
            ]);

            const credito = Number(data?.saldo_a_favor_generado || 0);
            ["haiku-pago-monto", "haiku-pago-glosa", "haiku-pago-codaut", "haiku-pago-folio", "haiku-pago-bove", "haiku-pago-observacion"]
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = "";
                });

            document.getElementById("haiku-pago-reserva")?.dispatchEvent(
                new Event("change", { bubbles: true })
            );

            setTimeout(() => {
                ponerEstadoPago(
                    credito > 0
                        ? `Pago de ${dinero(datos.monto)} registrado · ${dinero(credito)} quedaron como saldo a favor.`
                        : `Pago de ${dinero(datos.monto)} registrado.`,
                    "exito"
                );
                decorarTodo();
            }, 350);
        } catch (error) {
            console.error("HAIKU · registrar pago con excedente:", error);
            ponerEstadoPago(error?.message || "No fue posible registrar el pago.", "error");
        } finally {
            registrandoExcedente = false;
            if (boton?.isConnected) {
                boton.textContent = textoAnterior;
                setTimeout(habilitarExcedenteModal, 20);
            }
        }
    }

    function ponerEstadoPago(texto, tipo = "") {
        const el = document.getElementById("haiku-pago-estado");
        if (!el) return;
        el.className = "haiku-pago-grupo-estado" + (tipo ? ` ${tipo}` : "");
        el.textContent = texto;
    }

    // ----------------------------------------
    // CHECK-IN · quitar límite visual y mostrar crédito
    // ----------------------------------------
    async function decorarCheckin() {
        const cards = [...document.querySelectorAll(
            "#pagos-lista-checkin .haiku-saldo-v5[data-reserva-id], #pagos-lista-checkin .haiku-checkin-grupo-v2[data-reserva-id]"
        )].filter(card => !card.hidden);

        cards.forEach(card => {
            card.querySelectorAll("[data-haiku-saldo-monto],[data-grupo-saldo-monto]")
                .forEach(input => input.removeAttribute("max"));
        });

        await Promise.allSettled(cards.map(async card => {
            const id = card.dataset.reservaId || "";
            if (!id) return;
            const resumen = await resumenSaldoFavor(id);
            const credito = Number(resumen?.saldo_a_favor || 0);

            let bloque = card.querySelector(".haiku-checkin-saldo-favor");
            if (credito <= 0) {
                bloque?.remove();
                return;
            }

            if (!bloque) {
                bloque = document.createElement("div");
                bloque.className = "haiku-checkin-saldo-favor";
                const resumenVisual = card.querySelector(".pago-checkin-resumen-nuevo");
                resumenVisual?.insertAdjacentElement("afterend", bloque);
            }

            bloque.innerHTML = `
                <span>Saldo a favor disponible</span>
                <strong>${dinero(credito)}</strong>`;
        }));
    }

    // ----------------------------------------
    // CHECK-OUT · panel y modal para usar crédito
    // ----------------------------------------
    function crearModalCredito() {
        if (document.getElementById("haiku-saldo-favor-overlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "haiku-saldo-favor-overlay";
        overlay.className = "haiku-saldo-favor-overlay";
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="haiku-saldo-favor-modal" role="dialog" aria-modal="true" aria-labelledby="haiku-saldo-favor-titulo">
                <div class="haiku-saldo-favor-modal-head">
                    <div>
                        <small>Control financiero</small>
                        <h3 id="haiku-saldo-favor-titulo">Usar saldo a favor</h3>
                    </div>
                    <button type="button" data-haiku-credito-cerrar aria-label="Cerrar">×</button>
                </div>
                <div class="haiku-saldo-favor-modal-body">
                    <div class="haiku-saldo-favor-total">
                        <span>Disponible</span>
                        <strong id="haiku-credito-disponible">$0</strong>
                    </div>

                    <label class="haiku-saldo-favor-campo">
                        <span>Aplicar a</span>
                        <select id="haiku-credito-cargo"></select>
                    </label>

                    <label class="haiku-saldo-favor-campo">
                        <span>Monto a usar</span>
                        <div class="haiku-saldo-favor-monto"><span>$</span><input id="haiku-credito-monto" type="number" min="1" step="1000" inputmode="numeric"></div>
                    </label>

                    <div id="haiku-credito-preview" class="haiku-saldo-favor-preview"></div>

                    <div class="haiku-saldo-favor-origenes">
                        <div class="haiku-saldo-favor-origenes-head">
                            <span>Origen del saldo a favor</span>
                            <small>Se mantienen los datos del pago original</small>
                        </div>
                        <div id="haiku-credito-fuentes"></div>
                    </div>

                    <div id="haiku-credito-estado" class="haiku-saldo-favor-estado" aria-live="polite"></div>
                    <div class="haiku-saldo-favor-actions">
                        <button type="button" class="secundario" data-haiku-credito-cerrar>Cancelar</button>
                        <button type="button" id="haiku-credito-aplicar">Usar saldo a favor</button>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        overlay.addEventListener("click", e => {
            if (e.target === overlay) cerrarModalCredito();
        });
        overlay.querySelectorAll("[data-haiku-credito-cerrar]")
            .forEach(b => b.addEventListener("click", cerrarModalCredito));
        overlay.querySelector("#haiku-credito-cargo")?.addEventListener("change", actualizarModalCredito);
        overlay.querySelector("#haiku-credito-monto")?.addEventListener("input", actualizarPreviewCredito);
        overlay.querySelector("#haiku-credito-aplicar")?.addEventListener("click", usarCreditoSeleccionado);
    }

    function cerrarModalCredito() {
        const overlay = document.getElementById("haiku-saldo-favor-overlay");
        if (!overlay || aplicandoCredito) return;
        overlay.hidden = true;
        document.body.style.overflow = "";
        modalResumen = null;
    }

    function cargoSeleccionado() {
        const id = document.getElementById("haiku-credito-cargo")?.value || "";
        return (modalResumen?.cargos_servicio || []).find(c => String(c.cargo_id) === String(id));
    }

    function actualizarModalCredito() {
        const cargo = cargoSeleccionado();
        const input = document.getElementById("haiku-credito-monto");
        if (!cargo || !input || !modalResumen) return;
        const max = Math.max(0, Math.min(
            Number(cargo.saldo || 0),
            Number(modalResumen.saldo_a_favor || 0)
        ));
        input.max = String(max);
        input.value = String(max);
        actualizarPreviewCredito();
    }

    function actualizarPreviewCredito() {
        const cargo = cargoSeleccionado();
        const preview = document.getElementById("haiku-credito-preview");
        const input = document.getElementById("haiku-credito-monto");
        if (!cargo || !preview || !input || !modalResumen) return;

        const credito = Number(modalResumen.saldo_a_favor || 0);
        const saldoServicio = Number(cargo.saldo || 0);
        const monto = Math.max(0, Math.min(
            Math.round(Number(input.value || 0)), credito, saldoServicio
        ));

        preview.innerHTML = `
            <div><span>Saldo servicio después</span><strong>${dinero(Math.max(0, saldoServicio - monto))}</strong></div>
            <div><span>Saldo a favor después</span><strong>${dinero(Math.max(0, credito - monto))}</strong></div>`;
    }

    async function abrirModalCredito(reservaId) {
        crearModalCredito();
        const overlay = document.getElementById("haiku-saldo-favor-overlay");
        if (!overlay) return;

        overlay.hidden = false;
        document.body.style.overflow = "hidden";
        document.getElementById("haiku-credito-estado").textContent = "Cargando saldo a favor...";

        try {
            modalResumen = await resumenSaldoFavor(reservaId, { fresco: true });
            const credito = Number(modalResumen?.saldo_a_favor || 0);
            const cargos = (modalResumen?.cargos_servicio || []).filter(c => Number(c.saldo || 0) > 0);

            if (credito <= 0) throw new Error("La reserva ya no tiene saldo a favor disponible.");
            if (!cargos.length) throw new Error("No hay servicios pendientes donde aplicar el saldo a favor.");

            overlay.dataset.reservaId = String(reservaId);
            document.getElementById("haiku-credito-disponible").textContent = dinero(credito);

            const select = document.getElementById("haiku-credito-cargo");
            select.innerHTML = cargos.map(c => {
                const cab = c.cabana ? `CAB ${c.cabana} · ` : "";
                const hora = c.hora ? `${horaCorta(c.hora)} · ` : "";
                return `<option value="${esc(c.cargo_id)}">${esc(`${cab}${hora}${c.concepto} · Pend. ${dinero(c.saldo)}`)}</option>`;
            }).join("");

            const fuentes = document.getElementById("haiku-credito-fuentes");
            fuentes.innerHTML = (modalResumen.fuentes || []).map(f => `
                <div class="haiku-saldo-favor-fuente">
                    <div><strong>${dinero(f.disponible)}</strong><span>${esc(medioTexto(f.medio_pago))}</span></div>
                    <small>${esc(origenTexto(f, { incluirDisponible: false }))}</small>
                </div>`).join("");

            document.getElementById("haiku-credito-estado").textContent = "";
            actualizarModalCredito();
        } catch (error) {
            console.error("HAIKU · abrir saldo a favor:", error);
            document.getElementById("haiku-credito-estado").textContent = error?.message || "No fue posible cargar el saldo a favor.";
            document.getElementById("haiku-credito-aplicar").disabled = true;
        }
    }

    async function usarCreditoSeleccionado() {
        if (aplicandoCredito || !modalResumen) return;
        if (!window.haikuTienePermiso?.("pagos.registrar")) {
            document.getElementById("haiku-credito-estado").textContent = "Tu usuario no tiene permiso para aplicar pagos.";
            return;
        }

        const cargo = cargoSeleccionado();
        const reservaId = document.getElementById("haiku-saldo-favor-overlay")?.dataset?.reservaId || "";
        const input = document.getElementById("haiku-credito-monto");
        const monto = Math.round(Number(input?.value || 0));
        const max = Math.min(Number(cargo?.saldo || 0), Number(modalResumen.saldo_a_favor || 0));

        if (!cargo || !reservaId || monto <= 0 || monto > max) {
            document.getElementById("haiku-credito-estado").textContent = "Revisa el monto a utilizar.";
            return;
        }

        aplicandoCredito = true;
        const boton = document.getElementById("haiku-credito-aplicar");
        const texto = boton.textContent;
        boton.disabled = true;
        boton.textContent = "Aplicando...";
        document.getElementById("haiku-credito-estado").textContent = "Aplicando saldo a favor al servicio...";

        try {
            const { data, error } = await sb.rpc("haiku_usar_saldo_favor", {
                p_reserva_id: reservaId,
                p_cargo_id: cargo.cargo_id,
                p_monto: monto
            });
            if (error) throw error;

            invalidarCache();
            document.getElementById("haiku-credito-estado").textContent =
                `Se usaron ${dinero(data?.monto_usado || monto)}. Saldo restante del servicio: ${dinero(data?.saldo_servicio_restante || 0)}.`;

            await Promise.allSettled([
                Promise.resolve().then(() => window.haikuCargarCheckoutSupabase?.()),
                Promise.resolve().then(() => window.haikuCargarSaldosCheckinSupabase?.()),
                Promise.resolve().then(() => window.haikuCargarAbonosSupabase?.()),
                Promise.resolve().then(() => window.HAIKU_PAGOS_PENDIENTES_SUPABASE_V1?.refrescar?.(
                    (() => { try { return String(fechaSeleccionada || "").slice(0,10); } catch { return ""; } })()
                ))
            ]);

            setTimeout(() => {
                aplicandoCredito = false;
                cerrarModalCredito();
                programarDecoracion(50);
            }, 450);
            return data;
        } catch (error) {
            console.error("HAIKU · usar saldo a favor:", error);
            document.getElementById("haiku-credito-estado").textContent = error?.message || "No fue posible usar el saldo a favor.";
        } finally {
            if (aplicandoCredito) {
                aplicandoCredito = false;
                boton.disabled = false;
                boton.textContent = texto;
            }
        }
    }

    async function decorarCheckout() {
        const cards = [...document.querySelectorAll("#pagos-lista-checkout .haiku-checkout-v1[data-reserva-id]")];

        await Promise.allSettled(cards.map(async card => {
            const reservaId = card.dataset.reservaId || "";
            if (!reservaId) return;

            const resumen = await resumenSaldoFavor(reservaId);
            const credito = Number(resumen?.saldo_a_favor || 0);
            const cargos = (resumen?.cargos_servicio || []).filter(c => Number(c.saldo || 0) > 0);

            let panel = card.querySelector(".haiku-checkout-saldo-favor");
            if (credito <= 0 || !cargos.length) {
                panel?.remove();
                return;
            }

            if (!panel) {
                panel = document.createElement("div");
                panel.className = "haiku-checkout-saldo-favor";
                const formulario = card.querySelector("[data-haiku-checkout-formulario]");
                const resumenVisual = card.querySelector(".haiku-checkout-resumen");
                if (formulario) formulario.insertAdjacentElement("beforebegin", panel);
                else resumenVisual?.insertAdjacentElement("afterend", panel);
            }

            const fuentes = (resumen.fuentes || []).slice(0, 2);
            panel.innerHTML = `
                <div class="haiku-checkout-saldo-favor-head">
                    <div><span>Saldo a favor</span><strong>${dinero(credito)}</strong></div>
                    <button type="button" data-haiku-usar-saldo-favor="${esc(reservaId)}">Usar saldo a favor</button>
                </div>
                <div class="haiku-checkout-saldo-favor-origen">
                    ${fuentes.map(f => `<small>${esc(origenTexto(f))}</small>`).join("")}
                    ${(resumen.fuentes || []).length > 2 ? `<small>+ ${(resumen.fuentes || []).length - 2} origen(es) adicional(es)</small>` : ""}
                </div>`;
        }));
    }

    async function decorarTodo() {
        await Promise.allSettled([
            decorarModalPago(),
            decorarCheckin(),
            decorarCheckout()
        ]);
    }

    function programarDecoracion(ms = 60) {
        clearTimeout(timerDecoracion);
        timerDecoracion = setTimeout(decorarTodo, ms);
    }

    // Captura sólo pagos que exceden el saldo. Los pagos normales siguen usando el módulo existente.
    document.addEventListener("click", evento => {
        const boton = evento.target.closest?.("#haiku-pago-confirmar");
        if (!boton || document.getElementById("haiku-abono-edicion-aviso")) return;

        const datos = datosPagoModal();
        const saldo = montoTexto("haiku-pago-saldo");
        if (!(datos.monto > saldo || saldo <= 0)) return;

        evento.preventDefault();
        evento.stopPropagation();
        evento.stopImmediatePropagation();
        registrarExcedenteModal();
    }, true);

    document.addEventListener("click", evento => {
        const boton = evento.target.closest?.("[data-haiku-usar-saldo-favor]");
        if (!boton) return;
        evento.preventDefault();
        abrirModalCredito(boton.dataset.haikuUsarSaldoFavor || "");
    });

    document.addEventListener("input", evento => {
        if (evento.target.matches?.("#haiku-pago-monto")) {
            setTimeout(() => {
                habilitarExcedenteModal();
                actualizarPreviewExcedente();
            }, 0);
        }
        if (evento.target.matches?.("[data-haiku-saldo-monto],[data-grupo-saldo-monto]")) {
            evento.target.removeAttribute("max");
        }
    });

    document.addEventListener("change", evento => {
        if (evento.target.matches?.("#haiku-pago-reserva,#haiku-pago-medio,#haiku-pago-fecha")) {
            setTimeout(() => {
                invalidarCache(evento.target.matches("#haiku-pago-reserva") ? evento.target.value : "");
                decorarModalPago();
                habilitarExcedenteModal();
            }, 180);
        }
    });

    const observer = new MutationObserver(() => programarDecoracion(50));
    [
        document.getElementById("haiku-pago-grupo-overlay"),
        document.getElementById("pagos-lista-checkin"),
        document.getElementById("pagos-lista-checkout")
    ].filter(Boolean).forEach(el => observer.observe(el, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden", "disabled", "max"]
    }));

    document.addEventListener("haiku:servicio-supabase-cambiado", () => {
        invalidarCache();
        programarDecoracion(120);
    });

    window.addEventListener("haiku:auth-ready", () => {
        invalidarCache();
        setTimeout(programarDecoracion, 300);
    });

    document.addEventListener("click", evento => {
        if (evento.target.closest?.('[data-seccion="pagos"], .menu-item[data-seccion="pagos"]')) {
            programarDecoracion(180);
        }
    });

    const style = document.createElement("style");
    style.id = "haiku-saldo-favor-v1-css";
    style.textContent = `
        #haiku-pago-resumen{grid-template-columns:repeat(4,minmax(0,1fr))}
        .haiku-pago-saldo-favor-celda strong,#haiku-pago-saldo-favor{color:#18724a}
        .haiku-pago-excedente-preview{margin:-4px 0 13px;padding:10px 12px;border:1px solid #bee0ca;border-radius:10px;background:#f2faf5;display:grid;gap:3px}
        .haiku-pago-excedente-preview strong{font-size:10px;color:#1b6b45}.haiku-pago-excedente-preview span{font-size:9px;color:#607067;line-height:1.4}
        .haiku-checkin-saldo-favor{margin:9px 0;padding:9px 11px;border:1px solid #bee0ca;border-radius:9px;background:#f2faf5;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:10px;color:#557064}
        .haiku-checkin-saldo-favor strong{color:#176a43;font-size:13px}
        .haiku-checkout-saldo-favor{margin:12px 0;padding:11px 12px;border:1px solid #b8ddc5;border-radius:10px;background:#f2faf5;display:grid;gap:8px}
        .haiku-checkout-saldo-favor-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.haiku-checkout-saldo-favor-head>div{display:flex;align-items:baseline;gap:8px}.haiku-checkout-saldo-favor-head span{font-size:11px;color:#537063}.haiku-checkout-saldo-favor-head strong{font-size:15px;color:#176a43}
        .haiku-checkout-saldo-favor-head button{border:0;border-radius:8px;background:#287b55;color:#fff;padding:8px 11px;font:inherit;font-size:10px;font-weight:750;cursor:pointer}
        .haiku-checkout-saldo-favor-origen{display:grid;gap:3px;padding-top:7px;border-top:1px solid #d7eadf}.haiku-checkout-saldo-favor-origen small{font-size:9px;line-height:1.35;color:#65766d;overflow-wrap:anywhere}
        .haiku-saldo-favor-overlay{position:fixed;inset:0;z-index:100000;background:rgba(19,31,25,.48);display:grid;place-items:center;padding:18px}.haiku-saldo-favor-overlay[hidden]{display:none!important}
        .haiku-saldo-favor-modal{width:min(560px,calc(100vw - 28px));max-height:calc(100vh - 36px);overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.24);color:#26332c}
        .haiku-saldo-favor-modal-head{padding:20px 22px 15px;border-bottom:1px solid #e5eae7;display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.haiku-saldo-favor-modal-head small{text-transform:uppercase;letter-spacing:.16em;color:#24704d;font-size:9px;font-weight:800}.haiku-saldo-favor-modal-head h3{margin:4px 0 0;font-size:21px}.haiku-saldo-favor-modal-head button{width:34px;height:34px;border:1px solid #dbe2dd;border-radius:50%;background:#fff;font-size:18px;cursor:pointer}
        .haiku-saldo-favor-modal-body{padding:18px 22px 22px;display:grid;gap:14px}.haiku-saldo-favor-total{border:1px solid #bde0ca;background:#f2faf5;border-radius:11px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between}.haiku-saldo-favor-total span{font-size:11px;color:#5a7165}.haiku-saldo-favor-total strong{font-size:18px;color:#176a43}
        .haiku-saldo-favor-campo{display:grid;gap:6px;font-size:10px;color:#5a675f}.haiku-saldo-favor-campo select,.haiku-saldo-favor-campo input{width:100%;box-sizing:border-box;min-height:40px;border:1px solid #d8e0db;border-radius:9px;background:#fff;padding:0 10px;font:inherit;color:#26332c}.haiku-saldo-favor-monto{display:flex;align-items:center;border:1px solid #d8e0db;border-radius:9px;overflow:hidden}.haiku-saldo-favor-monto>span{padding-left:10px;color:#5e6b64}.haiku-saldo-favor-monto input{border:0!important}
        .haiku-saldo-favor-preview{display:grid;grid-template-columns:1fr 1fr;gap:8px}.haiku-saldo-favor-preview>div{border:1px solid #e0e6e2;border-radius:9px;padding:9px 10px;display:grid;gap:3px}.haiku-saldo-favor-preview span{font-size:9px;color:#68746d}.haiku-saldo-favor-preview strong{font-size:12px}
        .haiku-saldo-favor-origenes{border:1px solid #e0e6e2;border-radius:10px;padding:10px 11px}.haiku-saldo-favor-origenes-head{display:grid;gap:2px;padding-bottom:8px;border-bottom:1px solid #edf1ee}.haiku-saldo-favor-origenes-head span{font-size:10px;font-weight:750}.haiku-saldo-favor-origenes-head small{font-size:8px;color:#78827c}.haiku-saldo-favor-fuente{padding:8px 0;display:grid;gap:4px}.haiku-saldo-favor-fuente+.haiku-saldo-favor-fuente{border-top:1px solid #edf1ee}.haiku-saldo-favor-fuente>div{display:flex;gap:7px;align-items:baseline}.haiku-saldo-favor-fuente strong{font-size:12px;color:#176a43}.haiku-saldo-favor-fuente span{font-size:10px}.haiku-saldo-favor-fuente small{font-size:8.5px;color:#6d7871;overflow-wrap:anywhere}
        .haiku-saldo-favor-estado{min-height:14px;font-size:9px;color:#617068}.haiku-saldo-favor-actions{display:flex;justify-content:flex-end;gap:9px;border-top:1px solid #e6ebe8;padding-top:13px}.haiku-saldo-favor-actions button{min-height:39px;border:0;border-radius:9px;padding:0 14px;background:#287b55;color:#fff;font:inherit;font-size:10px;font-weight:750;cursor:pointer}.haiku-saldo-favor-actions button.secundario{border:1px solid #d9e0dc;background:#fff;color:#44534b}.haiku-saldo-favor-actions button:disabled{opacity:.6;cursor:wait}
        @media(max-width:700px){#haiku-pago-resumen{grid-template-columns:repeat(2,minmax(0,1fr))}.haiku-checkout-saldo-favor-head{align-items:flex-start;flex-direction:column}.haiku-checkout-saldo-favor-head button{width:100%}.haiku-saldo-favor-preview{grid-template-columns:1fr}.haiku-saldo-favor-modal-body{padding:15px}.haiku-saldo-favor-modal-head{padding:17px 15px 13px}}
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    createModalSafe();
    setInterval(() => programarDecoracion(0), 30000);
    setTimeout(() => programarDecoracion(0), 900);

    function createModalSafe() {
        try { crearModalCredito(); } catch (error) {
            console.warn("HAIKU · no se pudo preparar modal de saldo a favor:", error);
        }
    }

    window.HAIKU_SALDO_FAVOR_V1 = Object.freeze({
        refrescar: () => {
            invalidarCache();
            return decorarTodo();
        },
        resumen: resumenSaldoFavor,
        abrir: abrirModalCredito
    });

    console.info("HAIKU · Saldo a favor V1 preparado.");
})();