// ========================================
// HAIKU · ABONOS · DETALLE DE VERIFICACIÓN V1
// Captura y muestra respaldo según medio de pago.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    const MEDIOS = Object.freeze({
        "Transferencia": "transferencia",
        "WebPay Crédito": "webpay_credito",
        "WebPay Débito": "webpay_debito",
        "Tarjeta Crédito": "tarjeta_credito",
        "Tarjeta Débito": "tarjeta_debito",
        "Efectivo": "efectivo"
    });

    const MEDIOS_UI = Object.freeze({
        transferencia: "Transferencia",
        webpay_credito: "WebPay Crédito",
        webpay_debito: "WebPay Débito",
        tarjeta_credito: "Tarjeta Crédito",
        tarjeta_debito: "Tarjeta Débito",
        efectivo: "Efectivo"
    });

    const guardando = new Set();
    let timer = null;
    let secuencia = 0;

    function escapar(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function dinero(valor) {
        return "$" + Number(valor || 0).toLocaleString("es-CL");
    }

    function requisitos(medioDB) {
        if (medioDB === "transferencia") {
            return [{ clave: "glosa", etiqueta: "Glosa", placeholder: "Pegar glosa bancaria" }];
        }
        if (["webpay_credito", "webpay_debito"].includes(medioDB)) {
            return [{ clave: "codaut", etiqueta: "CodAut", placeholder: "Código de autorización WebPay" }];
        }
        if (["tarjeta_credito", "tarjeta_debito"].includes(medioDB)) {
            return [
                { clave: "folio", etiqueta: "Folio", placeholder: "Folio de la transacción" },
                { clave: "bovtar", etiqueta: "BOVTAR", placeholder: "Código BOVTAR" }
            ];
        }
        return [];
    }

    function medioTarjeta(tarjeta) {
        const medioUI = tarjeta?.querySelector(".pago-abono-medio")?.value || "";
        return MEDIOS[medioUI] || "";
    }

    function contenedorDetalles(tarjeta) {
        let cont = tarjeta.querySelector("[data-haiku-abono-detalles-v1]");
        if (!cont) {
            cont = document.createElement("div");
            cont.className = "haiku-abono-detalles-v1";
            cont.dataset.haikuAbonoDetallesV1 = "1";
            const grid = tarjeta.querySelector(".pago-abono-grid");
            if (grid) grid.insertAdjacentElement("afterend", cont);
        }
        return cont;
    }

    function pintarCamposPendientes(tarjeta) {
        if (!tarjeta || tarjeta.classList.contains("abono-verificado")) return;
        const cont = contenedorDetalles(tarjeta);
        if (!cont) return;

        const campos = requisitos(medioTarjeta(tarjeta));
        if (!campos.length) {
            cont.innerHTML = "";
            cont.hidden = true;
            return;
        }

        const anteriores = {};
        cont.querySelectorAll("[data-haiku-abono-extra]").forEach(input => {
            anteriores[input.dataset.haikuAbonoExtra] = input.value;
        });

        cont.innerHTML = campos.map(campo => `
            <label class="haiku-abono-extra-grupo">
                <span>${escapar(campo.etiqueta)}</span>
                <input type="text"
                    data-haiku-abono-extra="${escapar(campo.clave)}"
                    value="${escapar(anteriores[campo.clave] || "")}"
                    placeholder="${escapar(campo.placeholder)}"
                    autocomplete="off">
            </label>
        `).join("");
        cont.hidden = false;
    }

    function leerExtras(tarjeta, medioDB) {
        const valor = clave => tarjeta
            ?.querySelector(`[data-haiku-abono-extra="${clave}"]`)
            ?.value?.trim() || "";

        const extras = {
            glosa: valor("glosa"),
            codAut: valor("codaut"),
            folio: valor("folio"),
            bovtar: valor("bovtar")
        };

        if (medioDB === "transferencia" && !extras.glosa) {
            throw new Error("Para una transferencia debes ingresar la Glosa antes de confirmar el abono.");
        }
        if (["webpay_credito", "webpay_debito"].includes(medioDB) && !extras.codAut) {
            throw new Error("Para WebPay debes ingresar el CodAut antes de confirmar el abono.");
        }
        if (["tarjeta_credito", "tarjeta_debito"].includes(medioDB) && (!extras.folio || !extras.bovtar)) {
            throw new Error("Para pago con tarjeta debes ingresar Folio y BOVTAR antes de confirmar el abono.");
        }
        return extras;
    }

    async function saldoReserva(reservaId) {
        const { data, error } = await cliente
            .from("vista_saldos_reserva")
            .select("saldo")
            .eq("reserva_id", reservaId)
            .maybeSingle();
        if (error) throw error;
        return Number(data?.saldo || 0);
    }

    async function registrarAbono(reservaId, monto, medioDB, extras, numeroCabana) {
        const { data, error } = await cliente.rpc("haiku_registrar_pago", {
            p_reserva_id: reservaId,
            p_monto: monto,
            p_medio_pago: medioDB,
            p_etapa_operativa: "abono",
            p_fecha_pago: new Date().toISOString(),
            p_folio: extras.folio || null,
            p_codigo_autorizacion: extras.codAut || null,
            p_bove: extras.bovtar || null,
            p_referencia_externa: extras.glosa || null,
            p_observaciones: `Abono registrado desde HAIKU · CAB ${numeroCabana || ""}`,
            p_aplicaciones: [],
            p_modo_aplicacion: "alojamiento"
        });
        if (error) throw error;
        return data;
    }

    function textoDetallePago(pago) {
        if (pago.medio_pago === "transferencia") {
            return pago.referencia_externa
                ? `Glosa: ${escapar(pago.referencia_externa)}`
                : "Glosa: no registrada en este abono";
        }
        if (["webpay_credito", "webpay_debito"].includes(pago.medio_pago)) {
            return pago.codigo_autorizacion
                ? `CodAut: ${escapar(pago.codigo_autorizacion)}`
                : "CodAut: no registrado en este abono";
        }
        if (["tarjeta_credito", "tarjeta_debito"].includes(pago.medio_pago)) {
            const folio = pago.folio ? escapar(pago.folio) : "no registrado";
            const bovtar = pago.bove ? escapar(pago.bove) : "no registrado";
            return `Folio: ${folio} · BOVTAR: ${bovtar}`;
        }
        if (pago.medio_pago === "efectivo") return "Efectivo · sin dato adicional";
        return "Sin detalle adicional";
    }

    async function pintarVerificados() {
        const lista = document.getElementById("pagos-lista-abonos");
        if (!lista || !window.haikuSesion) return;

        const tarjetas = [...lista.querySelectorAll(".pago-abono-item[data-reserva-id]")];
        const ids = [...new Set(tarjetas
            .filter(t => t.classList.contains("abono-verificado"))
            .map(t => t.dataset.reservaId)
            .filter(Boolean))];
        if (!ids.length) return;

        const turno = ++secuencia;
        const { data, error } = await cliente
            .from("pagos")
            .select("id,reserva_id,monto,medio_pago,folio,codigo_autorizacion,bove,referencia_externa,fecha_pago")
            .in("reserva_id", ids)
            .eq("tipo_movimiento", "pago")
            .eq("etapa_operativa", "abono")
            .eq("estado", "confirmado")
            .order("fecha_pago", { ascending: true });
        if (error) {
            console.warn("HAIKU · No fue posible leer detalle de abonos:", error);
            return;
        }
        if (turno !== secuencia) return;

        const porReserva = new Map();
        (data || []).forEach(pago => {
            if (!porReserva.has(pago.reserva_id)) porReserva.set(pago.reserva_id, []);
            porReserva.get(pago.reserva_id).push(pago);
        });

        tarjetas.forEach(tarjeta => {
            if (!tarjeta.classList.contains("abono-verificado")) return;
            tarjeta.querySelector("[data-haiku-abonos-verificados-v1]")?.remove();
            const pagos = porReserva.get(tarjeta.dataset.reservaId) || [];
            if (!pagos.length) return;

            const bloque = document.createElement("div");
            bloque.className = "haiku-abonos-verificados-v1";
            bloque.dataset.haikuAbonosVerificadosV1 = "1";
            bloque.innerHTML = pagos.map(pago => `
                <div class="haiku-abono-registro-v1">
                    <div class="haiku-abono-registro-principal-v1">
                        <strong>${escapar(dinero(pago.monto))}</strong>
                        <span>${escapar(MEDIOS_UI[pago.medio_pago] || pago.medio_pago || "Sin medio")}</span>
                    </div>
                    <small>${textoDetallePago(pago)}</small>
                </div>
            `).join("");

            const verificacion = tarjeta.querySelector(".pago-abono-verificacion");
            if (verificacion) verificacion.insertAdjacentElement("beforebegin", bloque);
            else tarjeta.appendChild(bloque);
        });
    }

    function prepararTarjetas() {
        const lista = document.getElementById("pagos-lista-abonos");
        if (!lista) return;
        lista.querySelectorAll(".pago-abono-item").forEach(tarjeta => {
            if (tarjeta.classList.contains("abono-verificado")) {
                tarjeta.querySelector("[data-haiku-abono-detalles-v1]")?.remove();
            } else {
                pintarCamposPendientes(tarjeta);
            }
        });
        pintarVerificados().catch(error => console.warn("HAIKU · Detalle de abonos verificados:", error));
    }

    function programarPreparacion() {
        clearTimeout(timer);
        timer = setTimeout(prepararTarjetas, 45);
    }

    window.addEventListener("change", evento => {
        const medio = evento.target?.closest?.(".pago-abono-medio");
        if (!medio) return;
        const tarjeta = medio.closest(".pago-abono-item");
        if (tarjeta) pintarCamposPendientes(tarjeta);
    }, true);

    // Intercepta antes del listener legacy de document para registrar una sola vez.
    window.addEventListener("change", async evento => {
        const check = evento.target?.closest?.("[data-pago-abono]");
        if (!check || !check.dataset.reservaId || !check.checked) return;

        evento.preventDefault();
        evento.stopPropagation();
        evento.stopImmediatePropagation();

        const tarjeta = check.closest(".pago-abono-item");
        const reservaId = String(check.dataset.reservaId || "");
        if (!tarjeta || !reservaId || guardando.has(reservaId)) return;

        const monto = Number(tarjeta.querySelector(".pago-abono-monto")?.value || 0);
        const medioUI = tarjeta.querySelector(".pago-abono-medio")?.value || "";
        const medioDB = MEDIOS[medioUI] || "";

        if (monto <= 0 || !medioDB) {
            check.checked = false;
            alert("Ingresa un monto de abono y selecciona el medio de pago.");
            return;
        }
        if (!window.haikuTienePermiso?.("pagos.registrar")) {
            check.checked = false;
            alert("Tu usuario no tiene permiso para registrar pagos.");
            return;
        }

        let extras;
        try {
            extras = leerExtras(tarjeta, medioDB);
        } catch (error) {
            check.checked = false;
            alert(error.message);
            return;
        }

        guardando.add(reservaId);
        check.disabled = true;

        try {
            const saldo = await saldoReserva(reservaId);
            if (monto > saldo) throw new Error(`El abono supera el saldo actual (${dinero(saldo)}).`);

            await registrarAbono(reservaId, monto, medioDB, extras, check.dataset.pagoAbono);
            await Promise.allSettled([
                Promise.resolve().then(() => window.haikuCargarAbonosSupabase?.()),
                Promise.resolve().then(() => window.haikuCargarSaldosCheckinSupabase?.()),
                Promise.resolve().then(() => window.haikuSincronizarReservasSupabase?.())
            ]);
            setTimeout(programarPreparacion, 80);
        } catch (error) {
            console.error("HAIKU · No fue posible registrar abono con detalle:", error);
            check.checked = false;
            alert(error?.message || "No fue posible registrar el abono.");
        } finally {
            guardando.delete(reservaId);
            if (check.isConnected && !check.checked) check.disabled = false;
        }
    }, true);

    const lista = document.getElementById("pagos-lista-abonos");
    if (lista) {
        new MutationObserver(programarPreparacion).observe(lista, { childList: true, subtree: true });
    }

    window.addEventListener("haiku:auth-ready", () => setTimeout(programarPreparacion, 120));
    setTimeout(programarPreparacion, 160);

    const estilo = document.createElement("style");
    estilo.textContent = `
        .haiku-abono-detalles-v1{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(47,118,83,.12)}
        .haiku-abono-detalles-v1[hidden]{display:none!important}
        .haiku-abono-extra-grupo{display:flex;flex-direction:column;gap:5px;min-width:0}
        .haiku-abono-extra-grupo span{font-size:10px;color:#68716d}
        .haiku-abono-extra-grupo input{width:100%;min-width:0;height:38px;padding:0 10px;border:1px solid #ccd3cf;border-radius:7px;background:#fff;font:inherit;box-sizing:border-box}
        .haiku-abonos-verificados-v1{display:flex;flex-direction:column;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(47,118,83,.12)}
        .haiku-abono-registro-v1{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 9px;border:1px solid rgba(47,118,83,.14);border-radius:8px;background:rgba(255,255,255,.48)}
        .haiku-abono-registro-principal-v1{display:flex;align-items:center;gap:8px;flex:0 0 auto}
        .haiku-abono-registro-principal-v1 strong{font-size:11px}
        .haiku-abono-registro-principal-v1 span,.haiku-abono-registro-v1 small{font-size:10px;color:#65706a}
        .haiku-abono-registro-v1 small{text-align:right;overflow-wrap:anywhere}
        @media(max-width:700px){.haiku-abono-detalles-v1{grid-template-columns:1fr;gap:7px}.haiku-abono-registro-v1{align-items:flex-start;flex-direction:column;gap:3px}.haiku-abono-registro-v1 small{text-align:left}}
    `;
    document.head.appendChild(estilo);

    window.HAIKU_ABONOS_DETALLE_V1 = Object.freeze({ refrescar: programarPreparacion });
    console.info("HAIKU · Detalle de verificación de abonos V1 preparado.");
})();