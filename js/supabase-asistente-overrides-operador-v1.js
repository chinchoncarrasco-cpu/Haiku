// ========================================
// HAKU · OVERRIDES EXPLICITOS DEL OPERADOR V1
// Permite que una correccion textual, clara y deliberada del operador
// prevalezca sobre valores financieros leidos desde una captura.
//
// Alcance V1 (conservador):
// - Sólo monto total de alojamiento.
// - Requiere frase explicita asociada a "total" / "valor total".
// - Si existe 1 pago explicito y su monto coincide con el total corregido,
//   armoniza Monto pagado y Saldo a 0 para que la validacion refleje la
//   instruccion humana, preservando los valores originales en metadatos.
// - No altera disponibilidad, fechas, cabaña, Cloudbeds ID ni referencias
//   del medio de pago.
// - No guarda nada por sí solo.
// ========================================
(() => {
    "use strict";

    if (window.HAIKU_ASISTENTE_OVERRIDES_OPERADOR_V1) return;

    const campo = document.getElementById("haiku-asistente-texto");
    const enviar = document.getElementById("haiku-asistente-enviar");
    const mensajes = document.getElementById("haiku-asistente-mensajes");

    if (!campo || !enviar || !mensajes || !window.HAIKU_ASISTENTE) {
        console.info("HAKU · Overrides operador V1 no se instaló: asistente no disponible.");
        return;
    }

    let instruccionPendiente = "";

    function clave(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    function montoDesdeTextoToken(token) {
        const limpio = String(token || "")
            .replace(/clp/ig, "")
            .replace(/\$/g, "")
            .replace(/\s/g, "")
            .replace(/\./g, "")
            .replace(/,/g, "");
        const n = Number(limpio);
        return Number.isInteger(n) && n > 0 ? n : null;
    }

    function extraerOverrideTotal(textoOriginal) {
        const original = String(textoOriginal || "");
        const t = clave(original);
        if (!t) return null;

        // Exige intención explícita sobre el TOTAL, para no confundir el
        // monto de un pago con el valor de alojamiento.
        const patrones = [
            /(?:valor\s+total(?:\s+de\s+la\s+reserva)?|total\s+(?:real|final|correcto|de\s+la\s+reserva)|la\s+reserva\s+(?:es|queda\s+en)|usa(?:r)?\s+(?:como\s+)?total)\s*(?:es|:|=|queda\s+en|de)?\s*(?:clp\s*)?\$?\s*([0-9][0-9. ,]{2,})/i,
            /(?:aunque|aun\s+que|sé\s+que|se\s+que).*?(?:aparece|dice|muestra).*?\$?\s*[0-9][0-9. ,]{2,}.*?(?:pero|sin\s+embargo).*?(?:total|valor).*?(?:es|queda\s+en)?\s*(?:clp\s*)?\$?\s*([0-9][0-9. ,]{2,})/i
        ];

        for (const patron of patrones) {
            const m = original.match(patron);
            if (!m) continue;
            const monto = montoDesdeTextoToken(m[1]);
            if (!monto) continue;

            const mencionaRazon = /\b(descuento|promocion|promo|ajuste|cortesia|convenio|precio\s+especial|tarifa\s+especial)\b/i.test(original);
            return {
                campo: "monto_total",
                valor: monto,
                razon: mencionaRazon ? "Ajuste indicado por operador" : "Total indicado explícitamente por operador",
                texto_original: original.trim()
            };
        }

        return null;
    }

    function pagosDesdePreview(preview) {
        if (Array.isArray(preview?.pagos)) {
            return preview.pagos.filter(p => p && p.detectado !== false);
        }
        if (preview?.pago?.detectado === true) return [preview.pago];
        return [];
    }

    function aplicarOverrideAEntrada(entrada, override) {
        if (!entrada?.reserva || !override) return false;

        const r = entrada.reserva;
        const pagos = Array.isArray(entrada.pagos)
            ? entrada.pagos.filter(p => p && p.detectado !== false)
            : [];

        const original = {
            monto_total: r.monto_total ?? null,
            monto_pagado: r.monto_pagado ?? null,
            saldo_pendiente: r.saldo_pendiente ?? null
        };

        r._override_operador = {
            tipo: "financiero",
            campo: "monto_total",
            valor: override.valor,
            razon: override.razon,
            original_cloudbeds: original
        };

        r.monto_total = override.valor;

        const sumaPagos = pagos.reduce((suma, p) => {
            const n = Number(p?.monto);
            return suma + (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
        }, 0);

        // Si los pagos explícitos respaldan exactamente el total corregido,
        // usamos esa cifra como pagado operativo y saldo 0. Esto evita que
        // un valor pre-descuento de la captura bloquee una instrucción clara.
        if (pagos.length > 0 && sumaPagos === override.valor) {
            r.monto_pagado = override.valor;
            r.saldo_pendiente = 0;
        }

        entrada.advertencias = (Array.isArray(entrada.advertencias) ? entrada.advertencias : [])
            .filter(item => {
                const x = clave(item);
                return !(
                    x.includes("monto total") &&
                    (x.includes("monto pagado") || x.includes("saldo"))
                ) && !(
                    x.includes("no cuadra") ||
                    x.includes("discrepancia") ||
                    x.includes("no coincide")
                );
            });

        entrada.advertencias.unshift(
            `${override.razon}: se usará ${override.valor.toLocaleString("es-CL")} CLP como total de alojamiento en lugar del valor visible en la captura.`
        );

        return true;
    }

    function aplicarOverride(preview, override) {
        if (!preview || !override) return false;

        const reservas = Array.isArray(preview.reservas)
            ? preview.reservas.filter(x => x?.reserva)
            : [];

        let aplicado = false;

        if (reservas.length === 1) {
            aplicado = aplicarOverrideAEntrada(reservas[0], override) || aplicado;
            const unica = reservas[0];
            preview.reserva = unica.reserva;
            preview.pagos = Array.isArray(unica.pagos) ? unica.pagos : preview.pagos;
            preview.advertencias = Array.isArray(unica.advertencias) ? unica.advertencias : preview.advertencias;
        } else if (!reservas.length && preview.reserva) {
            aplicado = aplicarOverrideAEntrada({
                reserva: preview.reserva,
                pagos: pagosDesdePreview(preview),
                advertencias: preview.advertencias || []
            }, override) || aplicado;

            const temp = {
                reserva: preview.reserva,
                pagos: pagosDesdePreview(preview),
                advertencias: Array.isArray(preview.advertencias) ? preview.advertencias : []
            };
            // reaplicamos sobre la misma referencia para recuperar advertencias filtradas
            aplicarOverrideAEntrada(temp, override);
            preview.advertencias = temp.advertencias;
        }

        return aplicado;
    }

    function actualizarDatoPorEtiqueta(card, etiquetaBuscada, valor) {
        const objetivo = clave(etiquetaBuscada);
        [...card.querySelectorAll(".haiku-asistente-preview-dato")].forEach(fila => {
            const etiqueta = clave(fila.querySelector("span")?.textContent);
            if (etiqueta !== objetivo) return;
            const strong = fila.querySelector("strong");
            if (strong) strong.textContent = valor;
        });
    }

    function limpiarAlertasFinancierasViejas(card) {
        [...card.querySelectorAll(".haiku-asistente-preview-lista--alerta")].forEach(bloque => {
            [...bloque.querySelectorAll("li")].forEach(li => {
                const t = clave(li.textContent);
                if (
                    (t.includes("monto total") && (t.includes("monto pagado") || t.includes("saldo"))) ||
                    t.includes("discrepancia") ||
                    t.includes("no cuadra") ||
                    t.includes("no coincide")
                ) li.remove();
            });
            if (!bloque.querySelector("li")) bloque.remove();
        });
    }

    function mostrarAjusteOperador(card, override) {
        if (!card || !override) return;
        if (card.querySelector("[data-haku-override-operador]")) return;

        const bloque = document.createElement("div");
        bloque.dataset.hakuOverrideOperador = "1";
        bloque.className = "haiku-asistente-preview-nota";
        bloque.textContent = `✎ Ajuste indicado por operador: total de alojamiento ${override.valor.toLocaleString("es-CL")} CLP. El valor visible de Cloudbeds queda sólo como referencia.`;

        const pie = card.querySelector(".haiku-asistente-preview-pie");
        pie ? card.insertBefore(bloque, pie) : card.appendChild(bloque);
    }

    function actualizarBoton(card, preview) {
        // Reutiliza el validador determinístico de pagos instalado antes.
        const normalizador = window.HAIKU_ASISTENTE_NORMALIZACION_PAGOS_V1;
        const boton = card.querySelector(".haiku-asistente-preview-pie button");
        if (!normalizador || !boton) return;

        const problemas = normalizador.problemasPreview(preview);
        const tieneReserva = window.haikuTienePermiso?.("reservas.crear") === true;
        const pagos = pagosDesdePreview(preview);
        const requierePago = pagos.length > 0;
        const tienePago = !requierePago || (
            window.haikuTienePermiso?.("pagos.registrar") === true &&
            window.haikuTienePermiso?.("pagos.verificar") === true
        );
        const puede = problemas.length === 0 && tieneReserva && tienePago;

        boton.disabled = !puede;
        if (problemas.length) boton.title = problemas.join(" ");
        else boton.removeAttribute("title");

        if (puede) {
            boton.textContent = pagos.length
                ? `Confirmar reserva + ${pagos.length} ${pagos.length === 1 ? "abono" : "abonos"}`
                : "Confirmar y crear";
        }
    }

    function preparar() {
        const textoActual = String(campo.value || "").trim();
        const override = extraerOverrideTotal(textoActual);
        if (!override) return;

        instruccionPendiente = textoActual;

        let observador = null;
        observador = new MutationObserver(mutations => {
            let card = null;
            for (const mutation of mutations) {
                for (const nodo of mutation.addedNodes || []) {
                    if (!(nodo instanceof Element)) continue;
                    if (nodo.matches?.(".haiku-asistente-preview")) {
                        card = nodo;
                        break;
                    }
                    card = nodo.querySelector?.(".haiku-asistente-preview") || null;
                    if (card) break;
                }
                if (card) break;
            }
            if (!card) return;

            observador.disconnect();
            observador = null;

            const preview = window.HAIKU_ASISTENTE?.ultimaPreview?.();
            if (!preview) return;

            const aplicado = aplicarOverride(preview, override);
            if (!aplicado) return;

            actualizarDatoPorEtiqueta(card, "Total Cloudbeds", `$${override.valor.toLocaleString("es-CL")}`);
            if (pagosDesdePreview(preview).reduce((s, p) => s + Number(p?.monto || 0), 0) === override.valor) {
                actualizarDatoPorEtiqueta(card, "Pagado Cloudbeds", `$${override.valor.toLocaleString("es-CL")}`);
                actualizarDatoPorEtiqueta(card, "Saldo Cloudbeds", "$0");
            }
            limpiarAlertasFinancierasViejas(card);
            mostrarAjusteOperador(card, override);
            actualizarBoton(card, preview);

            console.info("HAKU · Override explícito del operador aplicado al total financiero.");
        });

        observador.observe(mensajes, { childList: true });
        window.setTimeout(() => {
            if (!observador) return;
            observador.disconnect();
            observador = null;
        }, 30000);
    }

    enviar.addEventListener("click", preparar);
    campo.addEventListener("keydown", evento => {
        if (!(evento.ctrlKey || evento.metaKey) || evento.key !== "Enter") return;
        preparar();
    });

    window.HAIKU_ASISTENTE_OVERRIDES_OPERADOR_V1 = Object.freeze({
        extraerOverrideTotal,
        aplicarOverride
    });

    console.info("HAKU · Overrides explícitos del operador V1 preparado.");
})();
