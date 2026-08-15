// ========================================
// PAGOS
// ========================================


// ========================================
// MOSTRAR ABONOS DE LOS INGRESOS
// ========================================

function cargarAbonosPagos() {

    const lista = document.getElementById("pagos-lista-abonos");
    const contador = document.getElementById("pagos-contador-abonos");

    if (!lista || !contador) {
        return;
    }

    if (!fechaSeleccionada) {
        return;
    }

    const datos = obtenerDatosDia(fechaSeleccionada);

    if (!datos || !datos.cabanas) {
        return;
    }

    lista.innerHTML = "";

    let cantidad = 0;

    Object.entries(datos.cabanas).forEach(([numeroCabana, cabana]) => {

        const estado = cabana.estado || "";

        const ingresa =
            estado === "libre-ingresa" ||
            estado === "sale-ingresa";

        if (!ingresa) {
            return;
        }

        if (cabana.abonoVerificado !== true) {
    cantidad++;
}

        const tarjeta = document.createElement("div");
        tarjeta.className = "pago-abono-item";

        if (cabana.abonoVerificado === true) {
    tarjeta.classList.add("abono-verificado");
}

        const titular =
    cabana.titular ||
    cabana.nombre ||
    cabana.huesped ||
    "Sin titular";

const montoAbono =
    cabana.abono ||
    cabana.montoAbono ||
    "";

const medioPago = cabana.medioPago || "";

tarjeta.innerHTML = `
    <div class="pago-abono-contenido">

        <div class="pago-abono-linea-principal">
            <strong>CAB ${numeroCabana}</strong>
            <span>· ${titular}</span>
        </div>

        <div class="pago-abono-linea-detalle">

    <label class="pago-abono-campo">
        <strong>Abono:</strong>

        <div class="pago-abono-monto-wrap">
            <span>$</span>

            <input
                type="number"
                class="pago-abono-monto"
                data-pago-cabana="${numeroCabana}"
                value="${montoAbono || ""}"
                min="0"
                step="1000"
                placeholder="0"
            >
        </div>
    </label>

    <label class="pago-abono-campo">
        <strong>Medio:</strong>

        <select
  class="pago-abono-medio"
  data-pago-cabana="${numeroCabana}"
>
  <option value="" ${medioPago === "" ? "selected" : ""}>Seleccionar...</option>
  <option value="Transferencia" ${medioPago === "Transferencia" ? "selected" : ""}>Transferencia</option>
  <option value="WebPay Crédito" ${medioPago === "WebPay Crédito" ? "selected" : ""}>WebPay Crédito</option>
  <option value="WebPay Débito" ${medioPago === "WebPay Débito" ? "selected" : ""}>WebPay Débito</option>
  <option value="Tarjeta Crédito" ${medioPago === "Tarjeta Crédito" ? "selected" : ""}>Tarjeta Crédito</option>
  <option value="Tarjeta Débito" ${medioPago === "Tarjeta Débito" ? "selected" : ""}>Tarjeta Débito</option>
  <option value="Efectivo" ${medioPago === "Efectivo" ? "selected" : ""}>Efectivo</option>
</select>
    </label>

    <label class="pago-abono-check">
        <input
    type="checkbox"
    data-pago-abono="${numeroCabana}"
    ${cabana.abonoVerificado === true ? "checked" : ""}
>
    </label>

</div>

    </div>
`;

        lista.appendChild(tarjeta);
    });

    contador.textContent = cantidad;

}


// ========================================
// CARGA INICIAL DE PAGOS
// ========================================

cargarAbonosPagos();
cargarSaldosCheckin();

// =====================================
// SALDOS CHECK-IN
// =====================================

function cargarSaldosCheckin() {

    const lista = document.getElementById("pagos-lista-checkin");
    const contador = document.getElementById("pagos-contador-checkin");

    if (!lista || !contador) {
        return;
    }

    if (!fechaSeleccionada) {
        return;
    }

    const datos = obtenerDatosDia(fechaSeleccionada);

    if (!datos || !datos.cabanas) {
        return;
    }

    lista.innerHTML = "";

    let cantidad = 0;

    Object.entries(datos.cabanas).forEach(([numeroCabana, cabana]) => {

    const estado = cabana.estado || "";

    const ingresa =
        estado === "libre-ingresa" ||
        estado === "sale-ingresa";

    if (!ingresa) {
        return;
    }

    cantidad++;

    const titular =
        cabana.titular ||
        cabana.nombre ||
        cabana.huesped ||
        "Sin titular";

    const abonoTexto =
    cabana.abono ||
    cabana.montoAbono ||
    "0";

const abono = Number(
    String(abonoTexto).replace(/\D/g, "")
);

    const tarjeta = document.createElement("div");
tarjeta.className = "pago-checkin-item";

tarjeta.innerHTML = `
    <div class="pago-checkin-contenido">

        <div class="pago-checkin-titulo">
            <strong>CAB ${numeroCabana}</strong>
            <span> · ${titular}</span>
        </div>

        <div class="pago-checkin-resumen">
            <label>
                <span>Total:</span>
                <div class="pago-checkin-total-wrap">
                    <span>$</span>
                    <input
                        type="number"
                        class="pago-checkin-total"
                        data-pago-checkin-total="${numeroCabana}"
                        placeholder="300000"
                    >
                </div>
            </label>

            <div class="pago-checkin-saldo-bloque">
                <span>Saldo:</span>
                <strong class="pago-checkin-saldo">$0</strong>
            </div>
        </div>

        <div class="pago-checkin-fila pago-checkin-fila-medio">
            <label>
                <span>Medio:</span>
                <select data-pago-checkin-medio="${numeroCabana}">
    <option value="">Seleccionar...</option>
    <option value="WebPay Débito">WebPay Débito</option>
    <option value="WebPay Crédito">WebPay Crédito</option>
    <option value="Tarjeta Débito">Tarjeta Débito</option>
    <option value="Tarjeta Crédito">Tarjeta Crédito</option>
    <option value="Transferencia">Transferencia</option>
    <option value="Efectivo">Efectivo</option>
</select>
            </label>

            <input
                type="checkbox"
                class="pago-checkin-check"
                data-pago-checkin-cobrado="${numeroCabana}"
            >
        </div>

        <div class="pago-checkin-fila">
            <label>
                <span>Folio:</span>
                <input
                    type="text"
                    data-pago-checkin-folio="${numeroCabana}"
                    placeholder="Rellenar"
                >
            </label>

            <label>
                <span>CodAut:</span>
                <input
                    type="text"
                    data-pago-checkin-codaut="${numeroCabana}"
                    placeholder="Rellenar"
                >
            </label>
        </div>

        <div class="pago-checkin-fila">
            <label>
                <span>Bove:</span>
                <input
                    type="text"
                    data-pago-checkin-bove="${numeroCabana}"
                    placeholder="Rellenar"
                >
            </label>

            <label class="pago-checkin-manager">
                <span>Manager:</span>
                <input
                    type="checkbox"
                    data-pago-checkin-manager="${numeroCabana}"
                >
            </label>
        </div>

    </div>
`;

lista.appendChild(tarjeta);

const inputTotal = tarjeta.querySelector(".pago-checkin-total");
const saldoTexto = tarjeta.querySelector(".pago-checkin-saldo");
const selectMedio = tarjeta.querySelector(
    `[data-pago-checkin-medio="${numeroCabana}"]`
);

const checkCobrado = tarjeta.querySelector(
    `[data-pago-checkin-cobrado="${numeroCabana}"]`
);

const inputFolio = tarjeta.querySelector(
    `[data-pago-checkin-folio="${numeroCabana}"]`
);

const inputCodAut = tarjeta.querySelector(
    `[data-pago-checkin-codaut="${numeroCabana}"]`
);

const inputBove = tarjeta.querySelector(
    `[data-pago-checkin-bove="${numeroCabana}"]`
);

const checkManager = tarjeta.querySelector(
    `[data-pago-checkin-manager="${numeroCabana}"]`
);

function actualizarEstadoCompleto() {
    const completo =
        Number(inputTotal.value) > 0 &&
        selectMedio.value !== "" &&
        checkCobrado.checked &&
        inputFolio.value.trim() !== "" &&
        inputCodAut.value.trim() !== "" &&
        inputBove.value.trim() !== "" &&
        checkManager.checked;

    tarjeta.classList.toggle("pago-checkin-completo", completo);


const pendientes = lista.querySelectorAll(
    ".pago-checkin-item:not(.pago-checkin-completo)"
).length;

contador.textContent = pendientes;

}

// Recuperar valores guardados
selectMedio.value = cabana.checkinMedio || "";
checkCobrado.checked = cabana.checkinCobrado === true;

// Recuperar datos administrativos guardados
inputFolio.value = cabana.checkinFolio || "";
inputCodAut.value = cabana.checkinCodAut || "";
inputBove.value = cabana.checkinBove || "";
checkManager.checked = cabana.checkinManager === true;

// Guardar medio de pago
selectMedio.addEventListener("change", () => {
    cabana.checkinMedio = selectMedio.value;
    guardarDatos();
});

// Guardar ticket de cobro
checkCobrado.addEventListener("change", () => {
    cabana.checkinCobrado = checkCobrado.checked;
    guardarDatos();
});

// Guardar Folio
inputFolio.addEventListener("input", () => {
    cabana.checkinFolio = inputFolio.value;
    guardarDatos();
});

// Guardar Código de Autorización
inputCodAut.addEventListener("input", () => {
    cabana.checkinCodAut = inputCodAut.value;
    guardarDatos();
});

// Guardar Bove
inputBove.addEventListener("input", () => {
    cabana.checkinBove = inputBove.value;
    guardarDatos();
});

// Guardar Manager
checkManager.addEventListener("change", () => {
    cabana.checkinManager = checkManager.checked;
    guardarDatos();
});

[
    inputTotal,
    selectMedio,
    checkCobrado,
    inputFolio,
    inputCodAut,
    inputBove,
    checkManager
].forEach(elemento => {
    elemento.addEventListener("input", actualizarEstadoCompleto);
    elemento.addEventListener("change", actualizarEstadoCompleto);
});

inputTotal.value = cabana.totalReserva || "";

function actualizarSaldo() {

    const total = Number(inputTotal.value) || 0;

    const saldo = Math.max(total - abono, 0);

    saldoTexto.textContent =
        "$" + saldo.toLocaleString("es-CL");
}

inputTotal.addEventListener("input", () => {

    cabana.totalReserva = inputTotal.value;

    guardarDatos();

    actualizarSaldo();
});

actualizarSaldo();
actualizarEstadoCompleto();

});

const pendientes = lista.querySelectorAll(
    ".pago-checkin-item:not(.pago-checkin-completo)"
).length;

contador.textContent = pendientes;

}

// ========================================
// ABONO VERIFICADO - CAMBIO VISUAL
// ========================================

document.addEventListener("change", (evento) => {

    const check = evento.target.closest("[data-pago-abono]");

    if (!check) {
        return;
    }

    const tarjeta = check.closest(".pago-abono-item");

    if (!tarjeta) {
        return;
    }

    tarjeta.classList.toggle(
        "abono-verificado",
        check.checked
    );

});

// ========================================
// GUARDAR DATOS DEL ABONO
// ========================================

document.addEventListener("change", (evento) => {

    if (!fechaSeleccionada) {
        return;
    }

    const monto = evento.target.closest(".pago-abono-monto");
    const medio = evento.target.closest(".pago-abono-medio");
    const verificado = evento.target.closest("[data-pago-abono]");

    if (!monto && !medio && !verificado) {
        return;
    }

    const numeroCabana =
        monto?.dataset.pagoCabana ||
        medio?.dataset.pagoCabana ||
        verificado?.dataset.pagoAbono;

    if (!numeroCabana) {
        return;
    }

    const datos = obtenerDatosDia(fechaSeleccionada);

    if (!datos.cabanas[numeroCabana]) {
        datos.cabanas[numeroCabana] = {};
    }

    const cabana = datos.cabanas[numeroCabana];

    if (monto) {
        cabana.abono = monto.value;
    }

    if (medio) {
        cabana.medioPago = medio.value;
    }

    if (verificado) {
    cabana.abonoVerificado = verificado.checked;
}

guardarDatos();
cargarAbonosPagos();
});