// ========================================
// HAIKU · SUPABASE · ATAJOS DESDE FICHA
// Total/Saldo -> Saldo Check-in
// Abono       -> Verificar abonos
// Servicios   -> Cobros Check-out (día de salida)
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    const CONFIG = Object.freeze({
        "ficha-pago-total": {
            destino: "saldo",
            fecha: "ingreso",
            titulo: "Ir a Saldo Check-in"
        },
        "ficha-pago-abono": {
            destino: "abono",
            fecha: "ingreso",
            titulo: "Ir a Verificar abonos"
        },
        "ficha-pago-saldo": {
            destino: "saldo",
            fecha: "ingreso",
            titulo: "Ir a Saldo Check-in"
        },
        "ficha-pago-servicios": {
            destino: "servicios",
            fecha: "salida",
            titulo: "Ir a Cobros Check-out del día de salida"
        }
    });

    const cacheEstadias = new Map();
    let navegando = false;

    function prepararAtajos() {
        Object.entries(CONFIG).forEach(([id, config]) => {
            const valor = document.getElementById(id);
            const cuadro = valor?.parentElement;
            if (!valor || !cuadro) return;

            // Todos los cuadros financieros funcionan como navegación.
            // Servicios se mantiene activo incluso cuando marca $0, porque
            // también sirve para revisar pagos ya realizados o el estado
            // completo del Check-out en la fecha de salida.
            const habilitado = true;

            cuadro.classList.toggle("haiku-ficha-atajo", habilitado);
            cuadro.classList.toggle("haiku-ficha-atajo-inactivo", !habilitado);
            cuadro.dataset.haikuFichaAtajo = habilitado ? id : "";

            if (habilitado) {
                cuadro.setAttribute("role", "button");
                cuadro.setAttribute("tabindex", "0");
                cuadro.setAttribute("title", config.titulo);
                cuadro.setAttribute("aria-label", config.titulo);
            } else {
                cuadro.removeAttribute("role");
                cuadro.removeAttribute("tabindex");
                cuadro.removeAttribute("title");
                cuadro.removeAttribute("aria-label");
            }
        });
    }

    async function obtenerEstadia(reservaId, numeroCabana) {
        const clave = `${reservaId}|${numeroCabana}`;
        if (cacheEstadias.has(clave)) return cacheEstadias.get(clave);

        const { data, error } = await cliente.rpc("haiku_ficha_reserva_core", {
            p_reserva_id: reservaId
        });
        if (error) throw error;

        const estadias = Array.isArray(data?.estadias) ? data.estadias : [];
        const estadia = estadias.find(
            e => String(e?.cabana_numero || "") === String(numeroCabana || "")
        ) || estadias[0] || null;

        if (estadia) cacheEstadias.set(clave, estadia);
        return estadia;
    }

    function establecerFecha(fecha) {
        const iso = String(fecha || "").slice(0, 10);
        if (!iso) return;

        try {
            fechaSeleccionada = iso;
        } catch (error) {
            console.warn("HAIKU · No fue posible cambiar fecha global desde atajo:", error);
        }

        localStorage.setItem("haikuFechaSeleccionada", iso);
    }

    function cerrarFicha() {
        const cerrar = document.getElementById("ficha-reserva-cerrar");
        if (cerrar) cerrar.click();
    }

    function abrirPagos() {
        const boton = document.querySelector('.menu-item[data-seccion="pagos"]');
        if (boton) boton.click();
    }

    async function refrescarPagos(destino) {
        try {
            if (destino === "abono") {
                await window.haikuCargarAbonosSupabase?.();
                return;
            }

            if (destino === "saldo") {
                await window.haikuCargarSaldosCheckinSupabase?.();
                return;
            }

            if (destino === "servicios") {
                if (typeof window.haikuCargarCheckoutSupabase === "function") {
                    await window.haikuCargarCheckoutSupabase();
                } else if (typeof cargarCobrosCheckout === "function") {
                    await Promise.resolve(cargarCobrosCheckout());
                }
            }
        } catch (error) {
            console.warn("HAIKU · Refresco de atajo de pagos:", error);
        }
    }

    function buscarTarjeta(destino, reservaId, numeroCabana) {
        if (destino === "abono") {
            return document.querySelector(
                `#pagos-lista-abonos .pago-abono-item[data-reserva-id="${CSS.escape(reservaId)}"]`
            );
        }

        if (destino === "saldo") {
            return document.querySelector(
                `#pagos-lista-checkin .haiku-saldo-v4[data-reserva-id="${CSS.escape(reservaId)}"]`
            );
        }

        if (destino === "servicios") {
            const lista = document.getElementById("pagos-lista-checkout");
            if (!lista) return null;

            const exacta = lista.querySelector(
                `[data-reserva-id="${CSS.escape(reservaId)}"]`
            );
            if (exacta) return exacta;

            return [...lista.querySelectorAll(".pago-checkout-item")].find(
                item => item.textContent.includes(`CAB ${numeroCabana}`)
            ) || lista;
        }

        return null;
    }

    async function enfocarDestino(destino, reservaId, numeroCabana) {
        for (let intento = 0; intento < 24; intento++) {
            const tarjeta = buscarTarjeta(destino, reservaId, numeroCabana);
            if (tarjeta) {
                tarjeta.scrollIntoView({ behavior: "smooth", block: "center" });
                tarjeta.classList.add("haiku-atajo-destino");
                setTimeout(() => tarjeta.classList.remove("haiku-atajo-destino"), 1900);
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 90));
        }

        const fallback = destino === "abono"
            ? document.getElementById("pagos-lista-abonos")
            : destino === "saldo"
                ? document.getElementById("pagos-lista-checkin")
                : document.getElementById("pagos-lista-checkout");

        fallback?.scrollIntoView({ behavior: "smooth", block: "center" });
        return false;
    }

    async function ejecutarAtajo(id) {
        const config = CONFIG[id];
        if (!config || navegando) return;

        const modal = document.getElementById("ficha-reserva-modal");
        const reservaId = String(modal?.dataset?.reservaId || "");
        const numeroCabana = String(modal?.dataset?.numeroCabana || "");
        if (!reservaId) return;

        navegando = true;
        try {
            const estadia = await obtenerEstadia(reservaId, numeroCabana);
            if (!estadia) throw new Error("No se encontró la estadía de esta reserva.");

            const fechaDestino = config.fecha === "salida"
                ? (estadia.fecha_salida || estadia.fecha_ingreso)
                : estadia.fecha_ingreso;

            establecerFecha(fechaDestino);
            cerrarFicha();
            abrirPagos();

            await new Promise(resolve => setTimeout(resolve, 80));
            await refrescarPagos(config.destino);
            await enfocarDestino(config.destino, reservaId, numeroCabana);

            console.info(
                "HAIKU · Atajo ficha → Pagos:",
                config.destino,
                reservaId,
                String(fechaDestino || "").slice(0, 10)
            );
        } catch (error) {
            console.error("HAIKU · No fue posible abrir atajo desde ficha:", error);
            alert(error?.message || "No fue posible abrir el apartado correspondiente.");
        } finally {
            navegando = false;
        }
    }

    document.addEventListener("click", evento => {
        const cuadro = evento.target.closest?.("[data-haiku-ficha-atajo]");
        const id = cuadro?.dataset?.haikuFichaAtajo || "";
        if (!id) return;

        evento.preventDefault();
        evento.stopPropagation();
        ejecutarAtajo(id);
    }, true);

    document.addEventListener("keydown", evento => {
        if (!["Enter", " "].includes(evento.key)) return;
        const cuadro = evento.target.closest?.("[data-haiku-ficha-atajo]");
        const id = cuadro?.dataset?.haikuFichaAtajo || "";
        if (!id) return;

        evento.preventDefault();
        ejecutarAtajo(id);
    }, true);

    const modal = document.getElementById("ficha-reserva-modal");
    if (modal) {
        new MutationObserver(prepararAtajos).observe(modal, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["class"]
        });
    }

    window.addEventListener("haiku:auth-ready", () => setTimeout(prepararAtajos, 120));
    setTimeout(prepararAtajos, 180);

    const estilo = document.createElement("style");
    estilo.textContent = `
        .ficha-pagos > .haiku-ficha-atajo {
            position: relative;
            cursor: pointer;
            transition: background .16s ease, box-shadow .16s ease, transform .16s ease;
        }
        .ficha-pagos > .haiku-ficha-atajo:hover {
            background: #f5faf7;
            box-shadow: inset 0 0 0 1px rgba(47,118,83,.16);
        }
        .ficha-pagos > .haiku-ficha-atajo:active {
            transform: scale(.985);
        }
        .ficha-pagos > .haiku-ficha-atajo:focus-visible {
            outline: 2px solid rgba(47,118,83,.42);
            outline-offset: -2px;
        }
        .ficha-pagos > .haiku-ficha-atajo::after {
            content: "›";
            position: absolute;
            top: 6px;
            right: 8px;
            color: #8aa294;
            font-size: 12px;
            font-weight: 800;
            opacity: .72;
        }
        .haiku-atajo-destino {
            animation: haikuAtajoDestino 1.8s ease;
        }
        @keyframes haikuAtajoDestino {
            0%, 100% { box-shadow: inherit; }
            22%, 70% { box-shadow: 0 0 0 3px rgba(47,118,83,.22), 0 10px 24px rgba(47,118,83,.12); }
        }
    `;
    document.head.appendChild(estilo);

    console.info("HAIKU · Atajos de ficha Supabase preparados.");
})();