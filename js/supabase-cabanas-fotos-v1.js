// =====================================================
// HAIKU · FOTOGRAFÍAS CABAÑAS / REVISIÓN · V1
// Capa visual: identifica la cabaña abierta y aplica
// fondos fotográficos suaves a las tarjetas de Aseo.
// No modifica datos, reservas, checklist ni Supabase.
// =====================================================

(() => {
    "use strict";

    const CABANAS_CON_FOTO = new Set([
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"
    ]);

    function instalarEstilosAseo() {
        const ID_ESTILO = "haiku-aseo-fotos-v1";

        if (document.getElementById(ID_ESTILO)) {
            return;
        }

        const estilo = document.createElement("style");
        estilo.id = ID_ESTILO;
        estilo.textContent = `
            /* =============================================
               HAIKU · FOTOS SUAVES EN TARJETAS DE ASEO
               Sólo visual. No altera controles ni lógica.
            ============================================= */

            #seccion-aseo #aseo-resumen .aseo-resumen-cabana {
                position: relative !important;
                isolation: isolate;
                overflow: hidden !important;
                background: transparent !important;
            }

            #seccion-aseo #aseo-resumen .aseo-resumen-cabana::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana::after {
                content: "";
                position: absolute;
                inset: 0;
                pointer-events: none;
                border-radius: inherit;
            }

            #seccion-aseo #aseo-resumen .aseo-resumen-cabana::before {
                z-index: 0;
                background-repeat: no-repeat;
                background-size: cover;
                background-position: center center;
                filter: blur(9px);
                transform: scale(1.08);
                opacity: .78;
            }

            #seccion-aseo #aseo-resumen .aseo-resumen-cabana::after {
                z-index: 1;
                background: linear-gradient(
                    180deg,
                    rgba(255, 255, 255, .72) 0%,
                    rgba(255, 255, 255, .82) 100%
                );
            }

            #seccion-aseo #aseo-resumen .aseo-resumen-cabana > * {
                position: relative;
                z-index: 2;
            }

            #seccion-aseo #aseo-resumen .aseo-resumen-cabana input,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana select,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana textarea {
                position: relative;
                z-index: 3;
            }

            /*
               IMPORTANTE:
               :nth-child(N of .aseo-resumen-cabana) cuenta solamente
               tarjetas de Aseo e ignora otros hijos del contenedor.
            */

            /* CAB 1, 2, 3, 4 y 6 */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(1 of .aseo-resumen-cabana)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(2 of .aseo-resumen-cabana)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(3 of .aseo-resumen-cabana)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(4 of .aseo-resumen-cabana)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(6 of .aseo-resumen-cabana)::before {
                background-image: url("assets/img/cabanas-revision-foto-original.jpg");
            }

            /* CAB 5 */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(5 of .aseo-resumen-cabana)::before {
                background-image: url("CAB5.jpg");
            }

            /* CAB 7, 8 y 9 */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(7 of .aseo-resumen-cabana)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(8 of .aseo-resumen-cabana)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(9 of .aseo-resumen-cabana)::before {
                background-image: url("internal-cabin-classic-loft-1120x434.jpg");
            }

            /* CAB 10 */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(10 of .aseo-resumen-cabana)::before {
                background-image: url("miniloft.jpg");
            }

            /* CAB 11 */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(11 of .aseo-resumen-cabana)::before {
                background-image: url("maxiloft.jpg");
            }

            @media (max-width: 700px) {
                #seccion-aseo #aseo-resumen .aseo-resumen-cabana::before {
                    filter: blur(8px);
                    transform: scale(1.10);
                    opacity: .76;
                }

                #seccion-aseo #aseo-resumen .aseo-resumen-cabana::after {
                    background: linear-gradient(
                        180deg,
                        rgba(255, 255, 255, .74) 0%,
                        rgba(255, 255, 255, .84) 100%
                    );
                }
            }
        `;

        document.head.appendChild(estilo);
    }

    function obtenerRevision() {
        return document.getElementById("revision-individual");
    }

    function aplicar(numeroCabana) {
        const revision = obtenerRevision();

        if (!revision) {
            return false;
        }

        const numero = String(numeroCabana || "");

        if (CABANAS_CON_FOTO.has(numero)) {
            revision.dataset.fotoCabana = numero;
        } else {
            revision.removeAttribute("data-foto-cabana");
        }

        return true;
    }

    function limpiar() {
        const revision = obtenerRevision();

        if (!revision) {
            return false;
        }

        revision.removeAttribute("data-foto-cabana");
        return true;
    }

    instalarEstilosAseo();

    document.addEventListener(
        "click",
        (evento) => {
            const tarjeta = evento.target.closest(
                ".cabana-revision[data-revision-cabana]"
            );

            if (tarjeta) {
                aplicar(tarjeta.dataset.revisionCabana);
                return;
            }

            if (
                evento.target.closest("#volver-cabanas") ||
                evento.target.closest(".menu-item")
            ) {
                limpiar();
            }
        },
        true
    );

    const revisionInicial = obtenerRevision();
    const numeroInicial = localStorage.getItem("haikuRevisionCabana");

    if (
        revisionInicial?.classList.contains("activa") &&
        numeroInicial
    ) {
        aplicar(numeroInicial);
    }

    window.HAIKU_CABANAS_FOTOS_V1 = {
        aplicar,
        limpiar,
        instalarEstilosAseo,
        cabanas: [...CABANAS_CON_FOTO]
    };
})();
