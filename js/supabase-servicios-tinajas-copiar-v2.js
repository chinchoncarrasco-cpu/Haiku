// ========================================
// HAIKU · SERVICIOS · COPIAR TINAJAS V2
// Añade copia por tipo sin alterar la lógica de disponibilidad V1.
// ========================================
(() => {
    "use strict";

    if (window.HAIKU_SERVICIOS_TINAJAS_COPIAR_V2) return;

    const BLOQUE_ID = "haiku-tinajas-horarios-v1";
    const FECHA_ID = "haiku-tinajas-fecha-v1";
    const COPIAR_AMBOS_ID = "haiku-tinajas-copiar-v1";
    const ESTADO_ID = "haiku-tinajas-copia-estado-v1";
    const TONEL_ID = "haiku-tinajas-copiar-tonel-v2";
    const JACUZZI_ID = "haiku-tinajas-copiar-jacuzzi-v2";

    function cargarEstilos() {
        if (document.querySelector('link[data-haiku-tinajas-copiar-v2="1"]')) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `css/supabase-servicios-tinajas-copiar-v2.css?v=${Date.now()}`;
        link.dataset.haikuTinajasCopiarV2 = "1";
        document.head.appendChild(link);
    }

    function fechaVisible(fecha) {
        const valor = String(fecha || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor || "—";
        const [y, m, d] = valor.split("-");
        return `${d}/${m}/${y}`;
    }

    function textoTipo(tipo, titulo, fecha) {
        const api = window.HAIKU_SERVICIOS_TINAJAS_HORARIOS_V1;
        if (!api || typeof api.horariosDisponibles !== "function") return "";

        const horarios = api.horariosDisponibles(tipo, fecha) || [];
        const fechaTexto = fechaVisible(fecha);

        if (!horarios.length) {
            return [
                "Hola 😊",
                "",
                `Por el momento no tenemos horarios disponibles de ${titulo.toLowerCase()} para el ${fechaTexto}.`
            ].join("\n");
        }

        return [
            "Hola 😊",
            "",
            `Estos son los horarios disponibles de ${titulo.toLowerCase()} para el ${fechaTexto}:`,
            "",
            ...horarios.map(h => `• ${h.inicio} a ${h.fin}`),
            "",
            "Si quieres reservar alguno, indícanos el horario 😊"
        ].join("\n");
    }

    async function copiarTipo(tipo, titulo, boton) {
        const bloque = document.getElementById(BLOQUE_ID);
        const fecha = bloque?.querySelector(`#${FECHA_ID}`)?.value || "";
        const estado = bloque?.querySelector(`#${ESTADO_ID}`);
        if (!bloque || !fecha || !estado || !boton) return;

        const texto = textoTipo(tipo, titulo, fecha);
        if (!texto) {
            estado.textContent = "No se pudo generar el mensaje";
            return;
        }

        boton.disabled = true;
        estado.textContent = "Copiando…";

        try {
            if (!navigator.clipboard?.writeText) throw new Error("Clipboard API no disponible");
            await navigator.clipboard.writeText(texto);
            estado.textContent = `✓ ${titulo} copiada`;
            setTimeout(() => {
                if (estado.textContent === `✓ ${titulo} copiada`) estado.textContent = "";
            }, 2500);
        } catch (error) {
            console.error(`HAIKU · No fue posible copiar ${titulo}:`, error);
            estado.textContent = "No se pudo copiar";
        } finally {
            boton.disabled = false;
        }
    }

    function crearBoton(id, texto, tipo, titulo, antesDe) {
        if (document.getElementById(id)) return document.getElementById(id);
        const boton = document.createElement("button");
        boton.type = "button";
        boton.id = id;
        boton.className = "haiku-tinajas-boton-copiar-v2 haiku-tinajas-boton-copiar-v2--secundario";
        boton.textContent = texto;
        boton.addEventListener("click", () => copiarTipo(tipo, titulo, boton));
        antesDe.parentNode.insertBefore(boton, antesDe);
        return boton;
    }

    function instalar() {
        const bloque = document.getElementById(BLOQUE_ID);
        const api = window.HAIKU_SERVICIOS_TINAJAS_HORARIOS_V1;
        const botonAmbos = bloque?.querySelector(`#${COPIAR_AMBOS_ID}`);
        if (!bloque || !api || !botonAmbos) return false;

        cargarEstilos();

        botonAmbos.textContent = "Copiar ambos";
        botonAmbos.classList.add(
            "haiku-tinajas-boton-copiar-v2",
            "haiku-tinajas-boton-copiar-v2--principal"
        );

        crearBoton(TONEL_ID, "Copiar Tónel", "tonel", "Tinaja Tónel", botonAmbos);
        crearBoton(JACUZZI_ID, "Copiar Jacuzzi", "jacuzzi", "Tinaja Jacuzzi", botonAmbos);

        return true;
    }

    window.HAIKU_SERVICIOS_TINAJAS_COPIAR_V2 = Object.freeze({
        instalar,
        textoTipo
    });

    if (!instalar()) {
        document.addEventListener("haiku:servicios-hidratados", instalar, { once: true });
        window.addEventListener("load", instalar, { once: true });
    }

    console.info("HAIKU · Copia separada de Tinajas V2 preparada.");
})();
