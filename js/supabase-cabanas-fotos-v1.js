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

            /* Fotografía: un poco ampliada para que el blur no deje bordes. */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana::before {
                z-index: 0;
                background-repeat: no-repeat;
                background-size: cover;
                background-position: center center;
                filter: blur(9px);
                transform: scale(1.08);
                opacity: .72;
            }

            /* Velo blanco: conserva la legibilidad de toda la tarjeta. */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana::after {
                z-index: 1;
                background: linear-gradient(
                    180deg,
                    rgba(255, 255, 255, .79) 0%,
                    rgba(255, 255, 255, .86) 100%
                );
            }

            /* Todo el contenido real queda por encima de foto + velo. */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana > * {
                position: relative;
                z-index: 2;
            }

            /* Los controles conservan su fondo propio para máxima lectura. */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana input,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana select,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana textarea {
                position: relative;
                z-index: 3;
            }

            /* CAB 1, 2, 3, 4 y 6 */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(1)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(2)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(3)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(4)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(6)::before {
                background-image: url("assets/img/cabanas-revision-foto-original.jpg");
            }

            /* CAB 5 */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(5)::before {
                background-image: url("CAB5.jpg");
            }

            /* CAB 7, 8 y 9 */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(7)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(8)::before,
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(9)::before {
                background-image: url("internal-cabin-classic-loft-1120x434.jpg");
            }

            /* CAB 10 */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(10)::before {
                background-image: url("miniloft.jpg");
            }

            /* CAB 11 */
            #seccion-aseo #aseo-resumen .aseo-resumen-cabana:nth-child(11)::before {
                background-image: url("maxiloft.jpg");
            }

            /* En móvil mantenemos el mismo efecto, apenas más claro. */
            @media (max-width: 700px) {
                #seccion-aseo #aseo-resumen .aseo-resumen-cabana::before {
                    filter: blur(8px);
                    transform: scale(1.10);
                    opacity: .70;
                }

                #seccion-aseo #aseo-resumen .aseo-resumen-cabana::after {
                    background: linear-gradient(
                        180deg,
                        rgba(255, 255, 255, .81) 0%,
                        rgba(255, 255, 255, .88) 100%
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

    // Captura el clic antes de abrir la revisión para que la foto
    // esté identificada desde el primer render visual.
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

            // Al volver al listado o abandonar la sección Cabañas,
            // retiramos sólo la marca visual para que el fondo no se filtre
            // a Calendario, Pagos, Aseo u otra sección.
            if (
                evento.target.closest("#volver-cabanas") ||
                evento.target.closest(".menu-item")
            ) {
                limpiar();
            }
        },
        true
    );

    // Si por alguna razón la revisión ya estaba abierta al cargar,
    // recupera únicamente el número recordado por la UI existente.
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
