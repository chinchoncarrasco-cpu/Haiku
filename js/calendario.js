const fechaActual = document.getElementById("fecha-actual");

const hoy = new Date();

const formatoFecha = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
});

let fechaFormateada = formatoFecha.format(hoy);

fechaFormateada =
    fechaFormateada.charAt(0).toUpperCase() +
    fechaFormateada.slice(1);

fechaActual.textContent = fechaFormateada;

// ========================================
// CALENDARIO MENSUAL
// ========================================

const calendarioGrid = document.getElementById("calendario-grid");
const tituloMes = document.getElementById("titulo-mes");

const botonAnterior = document.getElementById("mes-anterior");
const botonSiguiente = document.getElementById("mes-siguiente");

let fechaCalendario = new Date();


function generarCalendario() {

    calendarioGrid.innerHTML = "";

    const año = fechaCalendario.getFullYear();
    const mes = fechaCalendario.getMonth();

    // Título del mes
    const nombreMes = new Intl.DateTimeFormat("es-CL", {
        month: "long",
        year: "numeric"
    }).format(fechaCalendario);

    tituloMes.textContent =
        nombreMes.charAt(0).toUpperCase() +
        nombreMes.slice(1);


    // Primer día del mes
    const primerDia = new Date(año, mes, 1);

    // Cantidad de días
    const cantidadDias = new Date(
        año,
        mes + 1,
        0
    ).getDate();


    // JS: Domingo = 0
    // Nosotros: Lunes = 0

    let posicionPrimerDia = primerDia.getDay() - 1;

    if (posicionPrimerDia === -1) {
        posicionPrimerDia = 6;
    }


    // Espacios antes del día 1

    for (let i = 0; i < posicionPrimerDia; i++) {

        const espacio = document.createElement("div");

        espacio.classList.add(
            "dia-calendario",
            "dia-vacio"
        );

        calendarioGrid.appendChild(espacio);
    }


    // Crear días

    for (let dia = 1; dia <= cantidadDias; dia++) {

        const elementoDia = document.createElement("div");

        elementoDia.classList.add("dia-calendario");


        const numero = document.createElement("span");

        numero.classList.add("numero-dia");

        numero.textContent = dia;

        elementoDia.appendChild(numero);


        // Comprobar si es hoy

        const esHoy =
            dia === hoy.getDate() &&
            mes === hoy.getMonth() &&
            año === hoy.getFullYear();


        if (esHoy) {
            elementoDia.classList.add("hoy");
        }


        // Guardamos la fecha dentro del elemento

        const fechaDia =
            `${año}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

        elementoDia.dataset.fecha = fechaDia;


        // CLICK EN UN DÍA

elementoDia.addEventListener("click", () => {

    seleccionarDia(
        año,
        mes,
        dia,
        elementoDia.dataset.fecha
    );

});


        calendarioGrid.appendChild(elementoDia);
    }

}


// ========================================
// CAMBIAR DE MES
// ========================================

botonAnterior.addEventListener("click", () => {

    fechaCalendario.setMonth(
        fechaCalendario.getMonth() - 1
    );

    generarCalendario();

});


botonSiguiente.addEventListener("click", () => {

    fechaCalendario.setMonth(
        fechaCalendario.getMonth() + 1
    );

    generarCalendario();

});


// Generar calendario al cargar
generarCalendario();

// ========================================
// SELECCIONAR DÍA OPERATIVO
// ========================================

let fechaSeleccionada =
    `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

function seleccionarDia(año, mes, dia, fechaISO) {

    fechaSeleccionada = fechaISO;

    cargarDatosDia(fechaSeleccionada);
    cargarCabanasDia(fechaSeleccionada);

    const fechaElegida = new Date(
        año,
        mes,
        dia
    );

    // Formatear fecha
    let textoFecha = new Intl.DateTimeFormat("es-CL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(fechaElegida);

    textoFecha =
        textoFecha.charAt(0).toUpperCase() +
        textoFecha.slice(1);


    // Cambiar fecha del Resumen
    fechaActual.textContent = textoFecha;


    // Quitar selección anterior
    document
        .querySelectorAll(".dia-calendario.seleccionado")
        .forEach(elemento => {
            elemento.classList.remove("seleccionado");
        });


    // Marcar día seleccionado
    const diaSeleccionado = document.querySelector(
        `.dia-calendario[data-fecha="${fechaISO}"]`
    );

    if (diaSeleccionado) {
        diaSeleccionado.classList.add("seleccionado");
    }


    // Abrir Resumen
    document
        .querySelectorAll(".seccion-app")
        .forEach(seccion => {
            seccion.classList.remove("activa");
        });

    document
        .getElementById("seccion-resumen")
        .classList.add("activa");


    // Cambiar botón activo
    document
        .querySelectorAll(".menu-item")
        .forEach(boton => {
            boton.classList.remove("activo");
        });

    const botonResumen = document.querySelector(
        '.menu-item[data-seccion="resumen"]'
    );

    botonResumen.classList.add("activo");

}