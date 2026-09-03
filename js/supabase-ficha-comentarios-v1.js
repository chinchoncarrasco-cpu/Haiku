// ========================================
// HAIKU · FICHA · COMENTARIOS DE RESERVA V1
// Muestra las observaciones registradas al crear la reserva
// en un bloque separado debajo de NOTAS.
// ========================================
(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let solicitud = 0;

    function asegurarBloque() {
        let bloque = document.getElementById("ficha-reserva-comentarios-bloque");
        if (bloque) return bloque;

        const notas = document.getElementById("ficha-reserva-notas");
        const bloqueNotas = notas?.closest(".ficha-bloque");
        if (!notas || !bloqueNotas) return null;

        bloque = document.createElement("section");
        bloque.id = "ficha-reserva-comentarios-bloque";
        bloque.className = "ficha-bloque";
        bloque.innerHTML = `
            <h3 class="ficha-bloque-titulo">💭 COMENTARIOS DE RESERVA</h3>
            <div id="ficha-reserva-comentarios" class="ficha-notas haiku-ficha-comentarios">
                Sin comentarios de reserva.
            </div>
        `;

        bloqueNotas.insertAdjacentElement("afterend", bloque);
        return bloque;
    }

    function pintar(texto) {
        asegurarBloque();
        const contenedor = document.getElementById("ficha-reserva-comentarios");
        if (!contenedor) return;

        const limpio = String(texto || "").trim();
        contenedor.textContent = limpio || "Sin comentarios de reserva.";
        contenedor.classList.toggle("haiku-ficha-comentarios-vacio", !limpio);
    }

    async function cargar() {
        const bloque = asegurarBloque();
        const modal = document.getElementById("ficha-reserva-modal");
        if (!bloque || !modal || modal.hidden) return;

        const reservaId = String(modal.dataset.reservaId || "");
        if (!reservaId) {
            pintar("");
            return;
        }

        const turno = ++solicitud;
        const contenedor = document.getElementById("ficha-reserva-comentarios");
        if (contenedor) contenedor.textContent = "Cargando comentarios…";

        try {
            const { data, error } = await cliente
                .from("reservas")
                .select("observaciones")
                .eq("id", reservaId)
                .maybeSingle();

            if (error) throw error;
            if (turno !== solicitud) return;

            pintar(data?.observaciones || "");
        } catch (error) {
            if (turno !== solicitud) return;
            console.warn("HAIKU · No fue posible cargar comentarios de reserva:", error);
            pintar("");
        }
    }

    function instalar() {
        asegurarBloque();
        const modal = document.getElementById("ficha-reserva-modal");
        if (!modal || modal.dataset.haikuComentariosObservado === "1") return;

        modal.dataset.haikuComentariosObservado = "1";
        new MutationObserver(() => {
            if (!modal.hidden) setTimeout(cargar, 0);
        }).observe(modal, {
            attributes: true,
            attributeFilter: ["hidden", "data-reserva-id"]
        });

        if (!modal.hidden) cargar();
    }

    const estilo = document.createElement("style");
    estilo.textContent = `
        #ficha-reserva-comentarios-bloque .haiku-ficha-comentarios {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            line-height: 1.45;
        }
        #ficha-reserva-comentarios-bloque .haiku-ficha-comentarios-vacio {
            color: var(--texto-suave, #78817c);
        }
    `;
    document.head.appendChild(estilo);

    window.addEventListener("haiku:auth-ready", () => setTimeout(instalar, 120));
    window.addEventListener("load", () => setTimeout(instalar, 180));
    setTimeout(instalar, 240);

    window.HAIKU_FICHA_COMENTARIOS_V1 = Object.freeze({ instalar, cargar });
    console.info("HAIKU · Comentarios de reserva en ficha preparados.");
})();