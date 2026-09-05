// ========================================
// HAIKU · CAMBIO DE CABAÑA · INDICADOR VINCULADO V1
// Reutiliza el mismo símbolo visual de reservas conjuntas (↳)
// para una sola reserva que contiene 2+ estadías consecutivas.
// Además contextualiza la ficha según la CAB/tramo realmente abierto.
// Sólo lectura/visual. Sin observers, intervalos ni parches globales.
// ========================================
(() => {
    "use strict";

    if (window.HAIKU_CAMBIO_CABANA_VINCULO_V1) return;

    const sb = window.haikuSupabase;
    if (!sb) return;

    let pintando = false;
    let secuenciaContexto = 0;
    let contextoFichaActual = null;

    function fechaActual() {
        try { return String(fechaSeleccionada || "").slice(0, 10); }
        catch { return ""; }
    }

    function formatearFechaFicha(fecha) {
        const [a, m, d] = String(fecha || "").slice(0, 10).split("-");
        return a && m && d ? `${d}-${m}-${a.slice(-2)}` : String(fecha || "—");
    }

    function nochesEntre(inicio, fin) {
        const a = new Date(`${String(inicio || "").slice(0, 10)}T12:00:00`);
        const b = new Date(`${String(fin || "").slice(0, 10)}T12:00:00`);
        if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return 0;
        return Math.max(0, Math.round((b - a) / 86400000));
    }

    function reservaIdDeFila(fila) {
        if (!fila) return "";
        if (["libre-ingresa", "sale-ingresa"].includes(fila.estado_operativo)) {
            return fila.ingreso_reserva_id || "";
        }
        if (fila.estado_operativo === "sale-libre") return fila.salida_reserva_id || "";
        if (fila.estado_operativo === "continua") return fila.continua_reserva_id || "";
        if (fila.estado_operativo === "fullday") return fila.fullday_reserva_id || "";
        return "";
    }

    async function resolverReserva(numeroCabana, fecha) {
        const { data, error } = await sb.rpc("haiku_operacion_dia", { p_fecha: fecha });
        if (error) throw error;
        const fila = (data || []).find(item => Number(item.numero) === Number(numeroCabana));
        return {
            fila: fila || null,
            reservaId: reservaIdDeFila(fila)
        };
    }

    function idsVisiblesCalendario() {
        return [...new Set(
            [...document.querySelectorAll(
                ".calendario-reserva-barra[data-reserva-id], .calendario-panel-reserva[data-reserva-id]"
            )]
                .map(el => String(el.dataset.reservaId || "").split("::TRAMO::")[0])
                .filter(Boolean)
        )];
    }

    async function reservasMultitramo(ids) {
        if (!ids.length) return new Set();

        const { data, error } = await sb
            .from("reserva_estadias")
            .select("reserva_id,estado_estadia")
            .in("reserva_id", ids);

        if (error) throw error;

        const conteo = new Map();
        (data || []).forEach(estadia => {
            if (["cancelada", "no_show"].includes(String(estadia.estado_estadia || ""))) return;
            const id = String(estadia.reserva_id || "");
            if (!id) return;
            conteo.set(id, (conteo.get(id) || 0) + 1);
        });

        return new Set(
            [...conteo.entries()]
                .filter(([, cantidad]) => cantidad >= 2)
                .map(([id]) => id)
        );
    }

    function limpiarMarcasCalendario() {
        document
            .querySelectorAll(".haiku-cambio-cabana-vinculo-marca")
            .forEach(el => el.remove());
    }

    function insertarMarca(elemento) {
        if (!elemento || elemento.querySelector(":scope > .haiku-cambio-cabana-vinculo-marca")) return;

        const marca = document.createElement("span");
        marca.className = "haiku-reserva-grupo-marca haiku-cambio-cabana-vinculo-marca";
        marca.textContent = "↳";
        marca.title = "Misma reserva · cambio de cabaña";
        marca.setAttribute("aria-label", "Misma reserva con cambio de cabaña");

        elemento.prepend(marca);
        elemento.title = "Misma reserva · cambio de cabaña";
        elemento.dataset.haikuCambioCabanaVinculado = "1";
    }

    async function pintarCalendario() {
        if (pintando || !window.haikuSesion) return;

        const elementos = [...document.querySelectorAll(
            ".calendario-reserva-barra[data-reserva-id], .calendario-panel-reserva[data-reserva-id]"
        )];
        if (!elementos.length) return;

        const ids = idsVisiblesCalendario();
        if (!ids.length) return;

        pintando = true;
        try {
            const multiples = await reservasMultitramo(ids);
            limpiarMarcasCalendario();

            elementos.forEach(elemento => {
                const id = String(elemento.dataset.reservaId || "").split("::TRAMO::")[0];
                if (!multiples.has(id)) return;
                insertarMarca(elemento);
            });
        } catch (error) {
            console.warn("HAIKU · No fue posible pintar vínculo de cambio de cabaña:", error);
        } finally {
            pintando = false;
        }
    }

    function seleccionarEstadiaContextual(estadias, numeroCabana, fecha) {
        const activas = (estadias || []).filter(
            e => !["cancelada", "no_show"].includes(String(e?.estado_estadia || ""))
        );
        if (activas.length < 2) return null;

        const numero = Number(numeroCabana);
        const dia = String(fecha || "").slice(0, 10);

        return activas.find(e => {
            if (Number(e?.cabana_numero) !== numero) return false;
            const ingreso = String(e?.fecha_ingreso || "").slice(0, 10);
            const salida = String(e?.fecha_salida || "").slice(0, 10);
            return dia && ingreso && salida && dia >= ingreso && dia < salida;
        }) || activas.find(e => Number(e?.cabana_numero) === numero) || null;
    }

    function aplicarContextoFicha(contexto, reservaId, estadia) {
        if (!contexto || contexto.secuencia !== secuenciaContexto || !estadia) return;

        const modal = document.getElementById("ficha-reserva-modal");
        if (!modal || modal.hidden) return;

        const modalReservaId = String(modal.dataset.reservaId || "");
        if (modalReservaId && modalReservaId !== String(reservaId || "")) return;

        const numero = Number(estadia.cabana_numero || contexto.numeroCabana);
        const ingreso = String(estadia.fecha_ingreso || "").slice(0, 10);
        const salida = String(estadia.fecha_salida || "").slice(0, 10);
        const noches = estadia.tipo_estadia === "fullday" ? 0 : nochesEntre(ingreso, salida);

        const cabana = document.getElementById("ficha-reserva-cabana");
        const campoIngreso = document.getElementById("ficha-reserva-ingreso");
        const campoSalida = document.getElementById("ficha-reserva-salida");
        const campoNoches = document.getElementById("ficha-reserva-noches");

        if (cabana) cabana.textContent = `CAB ${numero}`;
        if (campoIngreso) campoIngreso.textContent = formatearFechaFicha(ingreso);
        if (campoSalida) campoSalida.textContent = formatearFechaFicha(salida);
        if (campoNoches) {
            campoNoches.textContent = estadia.tipo_estadia === "fullday"
                ? "Full Day"
                : `${noches} ${noches === 1 ? "noche" : "noches"}`;
        }

        modal.dataset.numeroCabana = String(numero);
        if (estadia.id) modal.dataset.estadiaId = String(estadia.id);
        modal.dataset.haikuContextoTramo = "1";
        modal.dataset.haikuContextoFecha = String(contexto.fecha || "");
    }

    async function contextualizarFicha(contexto) {
        if (!contexto || contexto.secuencia !== secuenciaContexto) return;

        try {
            const { reservaId } = await resolverReserva(contexto.numeroCabana, contexto.fecha);
            if (!reservaId || contexto.secuencia !== secuenciaContexto) return;

            const { data: core, error } = await sb.rpc("haiku_ficha_reserva_core", {
                p_reserva_id: reservaId
            });
            if (error) throw error;
            if (contexto.secuencia !== secuenciaContexto) return;

            const estadia = seleccionarEstadiaContextual(
                Array.isArray(core?.estadias) ? core.estadias : [],
                contexto.numeroCabana,
                contexto.fecha
            );
            if (!estadia) return;

            const aplicar = () => aplicarContextoFicha(contexto, reservaId, estadia);
            aplicar();
            setTimeout(aplicar, 240);
            setTimeout(aplicar, 720);
        } catch (error) {
            console.warn("HAIKU · No fue posible contextualizar la ficha por tramo:", error);
        }
    }

    async function pintarFicha() {
        const modal = document.getElementById("ficha-reserva-modal");
        if (!modal || modal.hidden) return;

        const reservaId = String(modal.dataset.reservaId || "");
        if (!reservaId) return;

        try {
            const multiples = await reservasMultitramo([reservaId]);
            document.getElementById("haiku-ficha-cambio-cabana-vinculo")?.remove();
            if (!multiples.has(reservaId)) return;

            const titulo = modal.querySelector(".ficha-reserva-titulo") ||
                modal.querySelector(".ficha-reserva-cabecera h2") ||
                modal.querySelector(".ficha-reserva-cabecera h3");
            if (!titulo) return;

            const marca = document.createElement("span");
            marca.id = "haiku-ficha-cambio-cabana-vinculo";
            marca.className = "haiku-reserva-grupo-marca";
            marca.textContent = "↳";
            marca.title = "Misma reserva · cambio de cabaña";
            marca.setAttribute("aria-label", "Misma reserva con cambio de cabaña");
            titulo.prepend(marca);
        } catch (error) {
            console.warn("HAIKU · No fue posible pintar vínculo en ficha:", error);
        }
    }

    function refrescarPronto() {
        setTimeout(pintarCalendario, 80);
        setTimeout(pintarCalendario, 320);
    }

    document.addEventListener("click", evento => {
        if (evento.target.closest?.(
            '.menu-item[data-seccion="calendario"], #mes-anterior, #mes-siguiente, .dia-calendario, #crear-reserva-cambio-cabana, #boton-ver-reserva-creada'
        )) {
            refrescarPronto();
        }

        const botonFicha = evento.target.closest?.("[data-ficha-cabana]");
        if (botonFicha) {
            const numeroCabana = Number(botonFicha.dataset.fichaCabana || 0);
            const fecha = fechaActual();
            if (numeroCabana > 0 && fecha) {
                contextoFichaActual = {
                    numeroCabana,
                    fecha,
                    secuencia: ++secuenciaContexto
                };
                setTimeout(() => contextualizarFicha(contextoFichaActual), 40);
            }
        }

        if (botonFicha || evento.target.closest?.(".calendario-reserva-barra[data-reserva-id]")) {
            setTimeout(pintarFicha, 360);
            setTimeout(pintarFicha, 760);
        }
    }, true);

    window.addEventListener("haiku:auth-ready", () => {
        setTimeout(pintarCalendario, 420);
    });

    window.addEventListener("load", () => {
        setTimeout(pintarCalendario, 650);
    });

    window.HAIKU_CAMBIO_CABANA_VINCULO_V1 = Object.freeze({
        refrescar: pintarCalendario,
        refrescarFicha: pintarFicha,
        contextualizarFicha
    });

    console.info("HAIKU · Indicador y contexto de cambio de cabaña preparados.");
})();
