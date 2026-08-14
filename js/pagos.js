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

            <label>
                <strong>Abono:</strong>
                <span class="pago-abono-monto">
                    ${montoAbono ? "$" + montoAbono : "$_____"}
                </span>
            </label>

            <span class="pago-abono-separador">·</span>

            <span>
                <strong>Medio:</strong> ${medioPago}
            </span>

            <span class="pago-abono-separador">·</span>

            <label class="pago-abono-check">
                <input
                    type="checkbox"
                    data-pago-abono="${numeroCabana}"
                >
                <strong>Verificado</strong>
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