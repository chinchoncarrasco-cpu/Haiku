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

        cantidad++;

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

const medioPago =
    cabana.medioPago ||
    "Transferencia/WebPay";

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
            <option value="">Seleccionar...</option>

            <option value="Transferencia"
                ${medioPago === "Transferencia" ? "selected" : ""}>
                Transferencia
            </option>

            <option value="WebPay Crédito"
                ${medioPago === "WebPay Crédito" ? "selected" : ""}>
                WebPay Crédito
            </option>

            <option value="WebPay Débito"
                ${medioPago === "WebPay Débito" ? "selected" : ""}>
                WebPay Débito
            </option>

            <option value="Efectivo"
                ${medioPago === "Efectivo" ? "selected" : ""}>
                Efectivo
            </option>
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

    if (cantidad === 0) {
        lista.innerHTML = `
            <div class="pago-vacio">
                No hay abonos por verificar.
            </div>
        `;
    }
}


// ========================================
// CARGA INICIAL DE PAGOS
// ========================================

cargarAbonosPagos();

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
});