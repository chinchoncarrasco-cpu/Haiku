// ========================================
// PROYECTO H · MEDICIÓN DE USO DEL ASISTENTE V1
// Intercepta únicamente la Edge Function del asistente para mostrar
// tokens y costo estimado, sin guardar mensajes ni datos de huéspedes.
// ========================================
(() => {
    "use strict";

    if (window.PROYECTO_H_ASISTENTE_USO?.activo) return;

    const STORAGE_KEY = "proyecto_h_asistente_uso_v1";
    const MAX_HISTORIAL = 50;
    const SLUG = "haiku-asistente-reserva";

    let cliente = null;
    let historial = leerHistorial();
    let parcheAplicado = false;
    let observer = null;

    function numero(valor) {
        const n = Number(valor);
        return Number.isFinite(n) ? n : 0;
    }

    function costoVisible(valor) {
        const n = Number(valor);
        if (!Number.isFinite(n)) return "costo no disponible";
        if (n === 0) return "≈ US$0.0000";
        if (n < 0.0001) return `≈ US$${n.toFixed(6)}`;
        return `≈ US$${n.toFixed(4)}`;
    }

    function tokensVisible(valor) {
        return Math.max(0, Math.round(numero(valor))).toLocaleString("es-CL");
    }

    function horaVisible(fechaIso) {
        const d = new Date(fechaIso);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString("es-CL", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function leerHistorial() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(data) ? data.slice(0, MAX_HISTORIAL) : [];
        } catch {
            return [];
        }
    }

    function guardarHistorial() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(historial.slice(0, MAX_HISTORIAL)));
        } catch {}
    }

    function normalizarUso(data) {
        const uso = data?.uso;
        if (!uso || typeof uso !== "object") return null;

        const costo = Number(uso.costo_usd_estimado);
        return {
            fecha: new Date().toISOString(),
            modelo: String(data?.modelo || uso?.modelo || "modelo no informado"),
            input_tokens: numero(uso.input_tokens),
            cached_input_tokens: numero(uso.cached_input_tokens),
            output_tokens: numero(uso.output_tokens),
            reasoning_tokens: numero(uso.reasoning_tokens),
            total_tokens: numero(uso.total_tokens),
            costo_usd_estimado: Number.isFinite(costo) ? costo : null,
        };
    }

    function registrarUso(data) {
        const item = normalizarUso(data);
        if (!item) return;

        historial.unshift(item);
        historial = historial.slice(0, MAX_HISTORIAL);
        guardarHistorial();
        asegurarUi();
        renderizarResumen();
        renderizarHistorial();

        // El módulo principal pinta primero la vista previa. Este pequeño retardo
        // hace que el costo aparezca justo debajo de la respuesta correspondiente.
        window.setTimeout(() => agregarPieConsulta(item), 0);
    }

    function totalCosto() {
        return historial.reduce((total, item) => {
            const costo = Number(item?.costo_usd_estimado);
            return total + (Number.isFinite(costo) ? costo : 0);
        }, 0);
    }

    function crearEstilos() {
        if (document.getElementById("proyecto-h-asistente-uso-estilos")) return;
        const style = document.createElement("style");
        style.id = "proyecto-h-asistente-uso-estilos";
        style.textContent = `
            .ph-asistente-uso-barra {
                display:flex; align-items:center; justify-content:space-between; gap:10px;
                padding:8px 14px; border-bottom:1px solid #e3e9e5; background:#fbfcfb;
                color:#5c6c63; font-size:.68rem;
            }
            .ph-asistente-uso-resumen { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .ph-asistente-uso-resumen strong { color:#244c37; font-weight:700; }
            .ph-asistente-uso-toggle {
                flex:0 0 auto; border:0; background:transparent; color:#1f6e4c;
                font:inherit; font-weight:700; cursor:pointer; padding:3px 2px;
            }
            .ph-asistente-uso-historial {
                max-height:150px; overflow:auto; padding:8px 12px 10px; border-bottom:1px solid #e3e9e5;
                background:#f7faf8;
            }
            .ph-asistente-uso-historial[hidden] { display:none !important; }
            .ph-asistente-uso-vacio { color:#718078; font-size:.68rem; padding:4px 2px; }
            .ph-asistente-uso-item {
                display:grid; grid-template-columns:1fr auto; gap:3px 10px; padding:7px 3px;
                border-bottom:1px solid #e6ebe8; font-size:.67rem; color:#536158;
            }
            .ph-asistente-uso-item:last-child { border-bottom:0; }
            .ph-asistente-uso-item strong { color:#213c2d; font-size:.7rem; }
            .ph-asistente-uso-item small { grid-column:1 / -1; color:#7b8881; }
            .ph-asistente-uso-nota { padding:5px 3px 0; color:#829087; font-size:.61rem; line-height:1.35; }
            .ph-asistente-uso-consulta {
                align-self:flex-start; max-width:92%; box-sizing:border-box; padding:6px 9px;
                border:1px solid #d8e5dc; border-radius:10px; background:#edf5f0;
                color:#466052; font-size:.65rem; line-height:1.35;
            }
            .ph-asistente-uso-consulta strong { color:#1f6e4c; }
            @media (max-width: 600px) {
                .ph-asistente-uso-barra { padding:7px 11px; }
                .ph-asistente-uso-historial { max-height:125px; }
            }
        `;
        document.head.appendChild(style);
    }

    function asegurarUi() {
        const panel = document.querySelector("#haiku-asistente-panel");
        if (!panel) return false;
        crearEstilos();

        if (!panel.querySelector("#ph-asistente-uso-barra")) {
            const barra = document.createElement("div");
            barra.id = "ph-asistente-uso-barra";
            barra.className = "ph-asistente-uso-barra";
            barra.innerHTML = `
                <span class="ph-asistente-uso-resumen" id="ph-asistente-uso-resumen">Uso IA · sin consultas medidas</span>
                <button type="button" class="ph-asistente-uso-toggle" id="ph-asistente-uso-toggle" aria-expanded="false">Historial</button>
            `;

            const lista = document.createElement("div");
            lista.id = "ph-asistente-uso-historial";
            lista.className = "ph-asistente-uso-historial";
            lista.hidden = true;

            const cabecera = panel.querySelector(".haiku-asistente-cabecera");
            if (cabecera?.nextSibling) {
                panel.insertBefore(barra, cabecera.nextSibling);
                panel.insertBefore(lista, barra.nextSibling);
            } else {
                panel.prepend(lista);
                panel.prepend(barra);
            }

            barra.querySelector("#ph-asistente-uso-toggle")?.addEventListener("click", evento => {
                const boton = evento.currentTarget;
                lista.hidden = !lista.hidden;
                boton.setAttribute("aria-expanded", String(!lista.hidden));
                boton.textContent = lista.hidden ? "Historial" : "Ocultar";
            });
        }

        renderizarResumen();
        renderizarHistorial();
        return true;
    }

    function renderizarResumen() {
        const resumen = document.querySelector("#ph-asistente-uso-resumen");
        if (!resumen) return;

        if (!historial.length) {
            resumen.textContent = "Uso IA · sin consultas medidas";
            return;
        }

        const ultima = historial[0];
        const plural = historial.length === 1 ? "consulta" : "consultas";
        resumen.innerHTML = `<strong>${historial.length} ${plural}</strong> · última ${costoVisible(ultima.costo_usd_estimado)} · acumulado ${costoVisible(totalCosto())}`;
    }

    function renderizarHistorial() {
        const lista = document.querySelector("#ph-asistente-uso-historial");
        if (!lista) return;
        lista.innerHTML = "";

        if (!historial.length) {
            const vacio = document.createElement("div");
            vacio.className = "ph-asistente-uso-vacio";
            vacio.textContent = "Aquí aparecerán las próximas consultas medidas.";
            lista.appendChild(vacio);
            return;
        }

        historial.forEach(item => {
            const fila = document.createElement("div");
            fila.className = "ph-asistente-uso-item";

            const titulo = document.createElement("strong");
            titulo.textContent = `${horaVisible(item.fecha)} · ${tokensVisible(item.total_tokens)} tokens`;
            const costo = document.createElement("strong");
            costo.textContent = costoVisible(item.costo_usd_estimado);
            const detalle = document.createElement("small");
            detalle.textContent = `Entrada ${tokensVisible(item.input_tokens)} · caché ${tokensVisible(item.cached_input_tokens)} · salida ${tokensVisible(item.output_tokens)} · ${item.modelo}`;

            fila.append(titulo, costo, detalle);
            lista.appendChild(fila);
        });

        const nota = document.createElement("div");
        nota.className = "ph-asistente-uso-nota";
        nota.textContent = "Historial local de este navegador. Sólo guarda tokens, costo estimado, hora y modelo; no guarda capturas, mensajes ni datos de huéspedes.";
        lista.appendChild(nota);
    }

    function agregarPieConsulta(item) {
        const mensajes = document.querySelector("#haiku-asistente-mensajes");
        if (!mensajes) return;

        const pie = document.createElement("div");
        pie.className = "ph-asistente-uso-consulta";
        pie.innerHTML = `Uso IA · <strong>${tokensVisible(item.total_tokens)} tokens</strong> · ${costoVisible(item.costo_usd_estimado)}`;
        pie.title = `Entrada: ${tokensVisible(item.input_tokens)} · Caché: ${tokensVisible(item.cached_input_tokens)} · Salida: ${tokensVisible(item.output_tokens)} · Modelo: ${item.modelo}`;
        mensajes.appendChild(pie);
        mensajes.scrollTop = mensajes.scrollHeight;
    }

    function parchearInvoke() {
        cliente = window.haikuSupabase;
        const functionsClient = cliente?.functions;
        if (!functionsClient || typeof functionsClient.invoke !== "function") return false;
        if (functionsClient.__proyectoHUsoParcheado) {
            parcheAplicado = true;
            return true;
        }

        const invokeOriginal = functionsClient.invoke.bind(functionsClient);
        functionsClient.invoke = async function(nombre, opciones) {
            const resultado = await invokeOriginal(nombre, opciones);
            if (nombre === SLUG && resultado?.data?.ok && resultado.data?.uso) {
                registrarUso(resultado.data);
            }
            return resultado;
        };

        Object.defineProperty(functionsClient, "__proyectoHUsoParcheado", {
            value: true,
            configurable: false,
            enumerable: false,
            writable: false,
        });

        parcheAplicado = true;
        return true;
    }

    function iniciar() {
        crearEstilos();
        parchearInvoke();
        asegurarUi();

        observer = new MutationObserver(() => asegurarUi());
        observer.observe(document.documentElement, { childList: true, subtree: true });

        let intentos = 0;
        const timer = window.setInterval(() => {
            intentos++;
            if (!parcheAplicado) parchearInvoke();
            asegurarUi();
            if ((parcheAplicado && document.querySelector("#haiku-asistente-panel")) || intentos > 120) {
                window.clearInterval(timer);
            }
        }, 250);
    }

    window.PROYECTO_H_ASISTENTE_USO = {
        activo: true,
        historial: () => historial.map(item => ({ ...item })),
        totalUsd: () => totalCosto(),
        limpiar: () => {
            historial = [];
            guardarHistorial();
            renderizarResumen();
            renderizarHistorial();
        },
    };

    iniciar();
})();
