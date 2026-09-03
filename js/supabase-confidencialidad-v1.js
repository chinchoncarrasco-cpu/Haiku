// ========================================
// CONFIDENCIALIDAD VISUAL V1
// Oculta el nombre del proyecto en Login y bloqueo de privacidad.
// No modifica autenticación, PIN, sesiones ni permisos.
// ========================================
(() => {
    "use strict";

    const tituloInterno = document.title;
    let actualizando = false;

    const reemplazosExactos = new Map([
        ["HAIKU · ACCESO INTERNO", "ACCESO INTERNO"],
        ["Ingresa con tu usuario autorizado de HAIKU.", "Ingresa con tu usuario autorizado."],
        ["Entrar a HAIKU", "Entrar"],
        ["Tu cuenta no está habilitada dentro de HAIKU.", "Tu cuenta no está habilitada para este acceso."],
        ["HAIKU · PRIVACIDAD", "ACCESO RESTRINGIDO"],
        ["Desbloquear HAIKU", "Desbloquear"],
        ["HAIKU bloqueado", "Acceso bloqueado"],
        ["HAIKU permanecerá oculto hasta completar la comprobación.", "El contenido permanecerá oculto hasta completar la comprobación."],
        ["No fue posible comprobar la configuración de privacidad. HAIKU se mantiene oculto por seguridad.", "No fue posible comprobar la configuración de privacidad. El contenido se mantiene oculto por seguridad."]
    ]);

    function sustituirTexto(texto) {
        const limpio = String(texto || "");
        if (!limpio.includes("HAIKU")) return limpio;
        if (reemplazosExactos.has(limpio)) return reemplazosExactos.get(limpio);

        // Respaldo para cualquier mensaje visible futuro dentro de estas pantallas.
        return limpio
            .replaceAll("HAIKU · ", "")
            .replaceAll("HAIKU", "el sistema")
            .replaceAll("haiku", "el sistema");
    }

    function limpiarNodo(raiz) {
        if (!raiz) return;

        const walker = document.createTreeWalker(
            raiz,
            NodeFilter.SHOW_TEXT
        );
        const nodos = [];
        while (walker.nextNode()) nodos.push(walker.currentNode);

        nodos.forEach(nodo => {
            const nuevo = sustituirTexto(nodo.nodeValue);
            if (nuevo !== nodo.nodeValue) nodo.nodeValue = nuevo;
        });
    }

    function overlayVisible(selector) {
        const el = document.querySelector(selector);
        return Boolean(el && !el.hidden);
    }

    function aplicar() {
        if (actualizando) return;
        actualizando = true;
        try {
            limpiarNodo(document.querySelector(".haiku-auth-overlay"));
            limpiarNodo(document.querySelector(".haiku-privacidad-overlay"));

            if (overlayVisible(".haiku-auth-overlay")) {
                document.title = "Acceso interno";
            } else if (overlayVisible(".haiku-privacidad-overlay")) {
                document.title = "Acceso restringido";
            } else if (document.title !== tituloInterno) {
                document.title = tituloInterno;
            }
        } finally {
            actualizando = false;
        }
    }

    const observador = new MutationObserver(() => queueMicrotask(aplicar));
    observador.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["hidden"]
    });

    aplicar();

    window.HAIKU_CONFIDENCIALIDAD_VISUAL = {
        aplicar
    };
})();
