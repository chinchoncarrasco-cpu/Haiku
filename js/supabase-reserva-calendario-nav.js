// ========================================
// HAIKU · SUPABASE · CALENDARIO RESERVAS
// Navegación mes anterior / siguiente
// ========================================

(() => {
    "use strict";

    const SELECTOR_CALENDARIO = "#reserva-calendario";
    const CLASE_NAV = "haiku-reserva-calendario-nav";

    function moverMes(delta) {
        try {
            if (typeof mesReservaBase === "undefined") {
                throw new Error("mesReservaBase no está disponible");
            }

            mesReservaBase = new Date(
                mesReservaBase.getFullYear(),
                mesReservaBase.getMonth() + delta,
                1
            );

            if (typeof renderizarCalendarioNuevaReserva === "function") {
                renderizarCalendarioNuevaReserva();
            }

            if (typeof actualizarSeleccionCalendarioReserva === "function") {
                actualizarSeleccionCalendarioReserva();
            }

            requestAnimationFrame(instalarControles);
        } catch (error) {
            console.error("HAIKU · No fue posible mover el calendario de reserva:", error);
        }
    }

    function instalarControles() {
        const calendario = document.querySelector(SELECTOR_CALENDARIO);
        if (!calendario) return false;

        if (calendario.querySelector(`.${CLASE_NAV}`)) {
            return true;
        }

        const meses = calendario.querySelector(".reserva-calendario-meses");
        if (!meses) return false;

        const nav = document.createElement("div");
        nav.className = CLASE_NAV;
        nav.innerHTML = `
            <button type="button"
                    class="haiku-reserva-calendario-nav-btn"
                    data-haiku-reserva-mes="-1"
                    aria-label="Mes anterior"
                    title="Mes anterior">←</button>

            <span class="haiku-reserva-calendario-nav-texto">
                Cambiar mes
            </span>

            <button type="button"
                    class="haiku-reserva-calendario-nav-btn"
                    data-haiku-reserva-mes="1"
                    aria-label="Mes siguiente"
                    title="Mes siguiente">→</button>
        `;

        calendario.insertBefore(nav, meses);
        return true;
    }

    document.addEventListener("click", evento => {
        const boton = evento.target.closest?.("[data-haiku-reserva-mes]");
        if (!boton) return;

        evento.preventDefault();
        evento.stopPropagation();
        evento.stopImmediatePropagation();

        const delta = Number(boton.dataset.haikuReservaMes || 0);
        if (!Number.isFinite(delta) || delta === 0) return;

        moverMes(delta);
    }, true);

    const observer = new MutationObserver(() => {
        instalarControles();
    });

    function activar() {
        instalarControles();

        const calendario = document.querySelector(SELECTOR_CALENDARIO);
        if (calendario && calendario.dataset.haikuNavObservado !== "1") {
            calendario.dataset.haikuNavObservado = "1";
            observer.observe(calendario, {
                childList: true,
                subtree: true
            });
        }
    }

    document.addEventListener("click", evento => {
        if (
            evento.target.closest?.("#btn-nueva-reserva") ||
            evento.target.closest?.("[data-editar-reserva]") ||
            evento.target.closest?.("[data-editar-noches]") ||
            evento.target.closest?.("[data-editar-estadia]")
        ) {
            setTimeout(activar, 40);
            setTimeout(activar, 120);
        }
    }, true);

    window.addEventListener("haiku:auth-ready", () => setTimeout(activar, 100));
    setTimeout(activar, 250);

    const estilo = document.createElement("style");
    estilo.textContent = `
        .${CLASE_NAV} {
            display: grid;
            grid-template-columns: 42px 1fr 42px;
            align-items: center;
            gap: 10px;
            margin: 0 0 10px;
        }

        .haiku-reserva-calendario-nav-btn {
            width: 42px;
            height: 38px;
            border: 1px solid #d9e1db;
            border-radius: 10px;
            background: #ffffff;
            color: #244232;
            font-size: 18px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(36, 66, 50, .05);
            transition: background .15s ease, border-color .15s ease, transform .15s ease;
        }

        .haiku-reserva-calendario-nav-btn:hover {
            background: #f3f8f5;
            border-color: #b9d0c1;
        }

        .haiku-reserva-calendario-nav-btn:active {
            transform: translateY(1px);
        }

        .haiku-reserva-calendario-nav-texto {
            text-align: center;
            color: #6b776f;
            font-size: 11px;
            font-weight: 600;
        }

        @media (max-width: 650px) {
            .${CLASE_NAV} {
                grid-template-columns: 38px 1fr 38px;
                gap: 8px;
            }

            .haiku-reserva-calendario-nav-btn {
                width: 38px;
                height: 36px;
            }
        }
    `;
    document.head.appendChild(estilo);

    console.info("HAIKU · Navegación mensual de reservas preparada.");
})();
