// ========================================
// HAKU · OVERRIDES EXPLÍCITOS DEL OPERADOR V1
// Una corrección textual clara del operador puede prevalecer sobre un valor
// financiero leído desde una captura, sin debilitar las demás protecciones.
//
// V1 conservadora:
// - sólo "monto total" / "valor total" del alojamiento;
// - exige una frase explícita asociada al total;
// - conserva los valores Cloudbeds originales en metadatos;
// - no altera cabaña, fechas, ID Cloudbeds, disponibilidad ni referencias
//   del medio de pago;
// - no guarda nada por sí sola.
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

    function clave(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    function montoDesdeToken(token) {
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
        const original = String(textoOriginal || "").trim();
        if (!original) return null;

        const patrones = [
            /(?:valor\s+total(?:\s+de\s+la\s+reserva)?|total\s+(?:real|final|correcto|de\s+la\s+reserva)|la\s+reserva\s+(?:es|queda\s+en)|usa(?:r)?\s+(?:como\s+)?total)\s*(?:es|:|=|queda\s+en|de)?\s*(?:clp\s*)?\$?\s*([0-9][0-9. ,]{2,})/i,
            /(?:aunque|aun\s+que|sé\s+que|se\s+que).*?(?:aparece|dice|muestra).*?\$?\s*[0-9][0-9. ,]{2,}.*?(?:pero|sin\s+embargo).*?(?:total|valor).*?(?:es|queda\s+en)?\s*(?:clp\s*)?\$?\s*([0-9][0-9. ,]{2,})/i
        ];

        for (const patron of patrones) {
            const m = original.match(patron);
            if (!m) continue;
            const valor = montoDesdeToken(m[1]);
            if (!valor) continue;

            const tieneRazon = /\b(descuento|promocion|promo|ajuste|cortesia|convenio|precio\s+especial|tarifa\s+especial)\b/i.test(original);
            return {
                campo: "monto_total",
                valor,
                razon: tieneRazon ? "Ajuste indicado por operador" : "Total indicado explícitamente por operador",
                texto_original: original
            };
        }

        return null;
    }

    function pagosDeEntrada(entrada) {
        return Array.isArray(entrada?.pagos)
            ? entrada.pagos.filter(p => p && p.detectado !== false)
            : [];
    }

    function pagosDesdePreview(preview) {
        if (Array.isArray(preview?.pagos)) return preview.pagos.filter(p => p && p.detectado !== false);
        return preview?.pago?.detectado === true ? [preview.pago] : [];
    }

    function esAdvertenciaFinancieraReemplazada(item) {
        const t = clave(item);
        return (
            (t.includes("monto total") && (t.includes("monto pagado") || t.includes("saldo"))) ||
            t.includes("discrepancia") ||
            t.includes("no cuadra") ||
            t.includes("no coincide")
        );
    }

    function aplicarOverrideAEntrada(entrada, override) {
        if (!entrada?.reserva || !override) return false;

        const r = entrada.reserva;
        const pagos = pagosDeEntrada(entrada);
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

        // Si el/los pagos explícitos suman exactamente el total indicado por
        // el operador, armonizamos la lectura financiera operativa.
        if (pagos.length > 0 && sumaPagos === override.valor) {
            r.monto_pagado = override.valor;
            r.saldo_pendiente = 0;
        }

        entrada.advertencias = (Array.isArray(entrada.advertencias) ? entrada.advertencias : [])
            .filter(item => !esAdvertenciaFinancieraReemplazada(item));

        return true;
    }

    function aplicarOverride(preview, override) {
        if (!preview || !override) return false;

        const reservas = Array.isArray(preview.reservas)
            ? preview.reservas.filter(x => x?.reserva)
            : [];

        if (reservas.length === 1) {
            const unica = reservas[0];
            if (!aplicarOverrideAEntrada(unica, override)) return false;
            preview.reserva = unica.reserva;
            preview.pagos = Array.isArray(unica.pagos) ? unica.pagos : preview.pagos;
            preview.advertencias = Array.isArray(unica.advertencias) ? unica.advertencias : [];
            if (preview.pagos?.length === 1) preview.pago = preview.pagos[0];
            return true;
        }

        if (!reservas.length && preview.reserva) {
            const temp = {
                reserva: preview.reserva,
                pagos: pagosDesdePreview(preview),
                advertencias: Array.isArray(preview.advertencias) ? preview.advertencias : []
            };
            if (!aplicarOverrideAEntrada(temp, override)) return false;
            preview.reserva = temp.reserva;
            preview.pagos = temp.pagos;
            preview.advertencias = temp.advertencias;
            if (temp.pagos.length === 1) preview.pago = temp.pagos[0];
            return true;
        }

        // En lotes de varias reservas no adivinamos a cuál pertenece el total.
        return false;
    }

    function agregarDatoAjuste(card, override, preview) {
        const r = preview?.reserva || {};
        const original = r?._override_operador?.original_cloudbeds || {};
        if (card.querySelector("[data-haku-override-operador]")) return;

        const bloque = document.createElement("div");
        bloque.dataset.hakuOverrideOperador = "1";
        bloque.className = "haiku-asistente-preview-nota";
        Object.assign(bloque.style, {
            fontSize: "11px",
            lineHeight: "1.35",
            fontWeight: "400",
            color: "#68736d",
            background: "transparent",
            border: "0",
            padding: "3px 0",
            margin: "5px 0 3px"
        });

        const antes = Number.isFinite(Number(original.monto_total))
            ? ` Cloudbeds muestra $${Number(original.monto_total).toLocaleString("es-CL")}.`
            : "";
        bloque.textContent = `Nota: se usará $${override.valor.toLocaleString("es-CL")} como total indicado por el operador.${antes}`;

        const pie = card.querySelector(".haiku-asistente-preview-pie");
        pie ? card.insertBefore(bloque, pie) : card.appendChild(bloque);
    }

    function limpiarAlertasViejas(card) {
        [...card.querySelectorAll(".haiku-asistente-preview-lista--alerta")].forEach(bloque => {
            [...bloque.querySelectorAll("li")].forEach(li => {
                if (esAdvertenciaFinancieraReemplazada(li.textContent)) li.remove();
            });
            if (!bloque.querySelector("li")) bloque.remove();
        });
    }

    function actualizarBoton(card, preview) {
        const normalizador = window.HAIKU_ASISTENTE_NORMALIZACION_PAGOS_V1;
        const boton = card.querySelector(".haiku-asistente-preview-pie button");
        if (!normalizador || !boton) return;

        const problemas = normalizador.problemasPreview(preview);
        const pagos = pagosDesdePreview(preview);
        const tieneReserva = window.haikuTienePermiso?.("reservas.crear") === true;
        const tienePago = pagos.length === 0 || (
            window.haikuTienePermiso?.("pagos.registrar") === true &&
            window.haikuTienePermiso?.("pagos.verificar") === true
        );
        const puede = problemas.length === 0 && tieneReserva && tienePago;

        boton.disabled = !puede;
        if (problemas.length) boton.title = problemas.join(" ");
        else if (!tieneReserva) boton.title = "Tu usuario no tiene permiso para crear reservas.";
        else if (!tienePago) boton.title = "Tu usuario no tiene permisos para registrar y verificar pagos.";
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

            // Siempre desconectamos antes de tocar la vista.
            observador.disconnect();
            observador = null;

            const preview = window.HAIKU_ASISTENTE?.ultimaPreview?.();
            if (!preview || !aplicarOverride(preview, override)) return;

            limpiarAlertasViejas(card);
            agregarDatoAjuste(card, override, preview);
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

    // Historial local: se carga después de que Haku y sus extensiones ya
    // existen. No toca Supabase; sólo conserva la conversación al hacer F5.
    if (!window.HAIKU_ASISTENTE_HISTORIAL_V1 &&
        !document.querySelector('script[data-haku-historial-v1]')) {
        const scriptHistorial = document.createElement("script");
        scriptHistorial.dataset.hakuHistorialV1 = "1";
        const version = new URL(document.currentScript?.src || location.href).searchParams.get("v") || Date.now();
        scriptHistorial.src = `js/supabase-asistente-historial-v1.js?v=${encodeURIComponent(version)}`;
        scriptHistorial.async = false;
        document.head.appendChild(scriptHistorial);
    }

    console.info("HAKU · Overrides explícitos del operador V1 preparado.");
})();