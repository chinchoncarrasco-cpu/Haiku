// ========================================
// HAIKU · CAMBIO DE CABAÑA · INDICADOR VINCULADO V1
// Reutiliza el mismo símbolo visual de reservas conjuntas (↳)
// para una sola reserva que contiene 2+ estadías consecutivas.
// Sólo lectura/visual. Sin observers, intervalos ni parches globales.
// ========================================
(() => {
    "use strict";

    if (window.HAIKU_CAMBIO_CABANA_VINCULO_V1) return;

    const sb = window.haikuSupabase;
    if (!sb) return;

    let pintando = false;

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

        if (evento.target.closest?.("[data-ficha-cabana], .calendario-reserva-barra[data-reserva-id]")) {
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
        refrescarFicha: pintarFicha
    });

    console.info("HAIKU · Indicador de vínculo para cambio de cabaña preparado.");
})();
