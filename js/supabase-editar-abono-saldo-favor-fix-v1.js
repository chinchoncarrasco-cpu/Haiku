// ========================================
// HAIKU · EDITAR ABONO · SALDO A FAVOR · FIX V1
// Evita que el validador antiguo (saldo + abono anterior)
// bloquee Guardar corrección cuando se usa la opción especial.
// ========================================
(() => {
    "use strict";

    let timer = 0;

    function valor(id) {
        return document.getElementById(id)?.value?.trim() || "";
    }

    function programar(ms = 0) {
        clearTimeout(timer);
        timer = setTimeout(validarEspecial, ms);
    }

    function datosValidos() {
        const monto = Math.round(Number(valor("haiku-pago-monto") || 0));
        const medio = valor("haiku-pago-medio");
        const fecha = valor("haiku-pago-fecha");

        if (monto <= 0 || !medio || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return false;
        }

        if (medio === "transferencia" && !valor("haiku-pago-glosa")) {
            return false;
        }

        if (["webpay_credito", "webpay_debito"].includes(medio) &&
            !valor("haiku-pago-codaut")) {
            return false;
        }

        if (["tarjeta_credito", "tarjeta_debito"].includes(medio) &&
            (!valor("haiku-pago-folio") || !valor("haiku-pago-bove"))) {
            return false;
        }

        return true;
    }

    function validarEspecial() {
        const aviso = document.getElementById("haiku-abono-edicion-aviso");
        const check = document.getElementById("haiku-edicion-saldo-favor-check");
        const monto = document.getElementById("haiku-pago-monto");
        const boton = document.getElementById("haiku-pago-confirmar");

        if (!aviso || !check || !monto || !boton) return;

        if (!check.checked) {
            // Cuando la opción especial no está activa, el editor normal
            // conserva el control de max/disabled.
            return;
        }

        // En este modo el monto puede superar el antiguo saldo máximo.
        monto.removeAttribute("max");
        monto.disabled = false;

        const puedeGuardar = datosValidos();
        boton.disabled = !puedeGuardar;
        boton.setAttribute("aria-disabled", puedeGuardar ? "false" : "true");

        if (puedeGuardar) {
            boton.style.cursor = "pointer";
            boton.title = "Guardar corrección y dejar el excedente como saldo a favor";
        } else {
            boton.style.cursor = "not-allowed";
            boton.title = "Completa los datos requeridos del pago";
        }
    }

    document.addEventListener("change", evento => {
        if (evento.target.matches?.(
            "#haiku-edicion-saldo-favor-check,#haiku-pago-medio,#haiku-pago-fecha"
        )) {
            programar(0);
            programar(30);
        }
    });

    document.addEventListener("input", evento => {
        if (evento.target.matches?.(
            "#haiku-pago-monto,#haiku-pago-glosa,#haiku-pago-codaut,#haiku-pago-folio,#haiku-pago-bove"
        )) {
            programar(0);
            programar(30);
        }
    });

    document.addEventListener("click", evento => {
        if (evento.target.closest?.("[data-haiku-editar-abono]")) {
            programar(80);
            programar(180);
        }
    });

    console.info("HAIKU · Fix de Guardar corrección con saldo a favor preparado.");
})();