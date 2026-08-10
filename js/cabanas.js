// ========================================
// GESTIÓN DE CABAÑAS
// ========================================

const filasCabanas = document.querySelectorAll("[data-cabana]");


// ========================================
// GUARDAR CAMPO DE CABAÑA
// ========================================

function guardarCampoCabana(elemento) {

    const fila = elemento.closest("[data-cabana]");

    if (!fila) {
        return;
    }

    const numeroCabana = fila.dataset.cabana;
    const campo = elemento.dataset.campo;

    if (!fechaSeleccionada) {
        return;
    }

    const datos = obtenerDatosDia(fechaSeleccionada);


    // Crear cabaña si todavía no existe

    if (!datos.cabanas[numeroCabana]) {
        datos.cabanas[numeroCabana] = {};
    }


    // Checkbox usa true / false
    // Los demás usan su valor normal

    const valor =
        elemento.type === "checkbox"
            ? elemento.checked
            : elemento.value;


datos.cabanas[numeroCabana][campo] = valor;

guardarDatos();

actualizarResumenDia(fechaSeleccionada);
}


// ========================================
// ESCUCHAR CAMBIOS
// ========================================

filasCabanas.forEach(fila => {

    const campos = fila.querySelectorAll(".campo-cabana");

    campos.forEach(campo => {

        campo.addEventListener("input", () => {
            guardarCampoCabana(campo);
        });

        campo.addEventListener("change", () => {
            guardarCampoCabana(campo);
        });

    });

});

// ========================================
// CARGAR CABAÑAS DEL DÍA
// ========================================

function cargarCabanasDia(fecha) {

    const datos = obtenerDatosDia(fecha);

    filasCabanas.forEach(fila => {

        const numeroCabana = fila.dataset.cabana;

        const datosCabana =
            datos.cabanas[numeroCabana] || {};

        const campos =
            fila.querySelectorAll(".campo-cabana");


        campos.forEach(campo => {

            const nombreCampo = campo.dataset.campo;
            const valor = datosCabana[nombreCampo];


            if (campo.type === "checkbox") {

                campo.checked = valor === true;

            } else {

                campo.value = valor || "";

            }

        });

    });

    actualizarResumenDia(fecha);

}

cargarCabanasDia(fechaSeleccionada);

// ========================================
// ACTUALIZAR TARJETAS DEL RESUMEN
// ========================================

function actualizarResumenDia(fecha) {

    if (!fecha) {
        return;
    }

    const datos = obtenerDatosDia(fecha);

    let ingresan = 0;
    let salen = 0;
    let continuan = 0;
    let servicios = 0;

    Object.values(datos.cabanas).forEach(cabana => {

        const estado = cabana.estado || "";

        // INGRESAN
        if (
            estado === "libre-ingresa" ||
            estado === "sale-ingresa"
        ) {
            ingresan++;
        }

        // SALEN
        if (
            estado === "sale-libre" ||
            estado === "sale-ingresa"
        ) {
            salen++;
        }

        // CONTINÚAN
        if (estado === "continua") {
            continuan++;
        }

        // SERVICIOS
        if (
            cabana.servicio &&
            cabana.servicio.trim() !== ""
        ) {
            servicios++;
        }

    });

    document.getElementById("contador-ingresan").textContent =
        ingresan;

    document.getElementById("contador-salen").textContent =
        salen;

    document.getElementById("contador-continuan").textContent =
        continuan;

    document.getElementById("contador-servicios").textContent =
        servicios;
}