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


// Ahora que todos los días existen,
// dibujamos las reservas encima.
dibujarReservasCalendario();

}

// ========================================
// DIBUJAR RESERVAS EN CALENDARIO
// ========================================

function dibujarReservasCalendario() {

    // Capa independiente para las reservas.
// Así las barras NO alteran la cuadrícula de los días.
const capaReservas =
    document.createElement("div");

capaReservas.className =
    "calendario-reservas-capa";

calendarioGrid.appendChild(
    capaReservas
);

    const datosCalendario =
        JSON.parse(
            localStorage.getItem("haikuDatos")
        ) || {};


    const reservasUnicas =
        new Map();


    // ========================================
    // REUNIR UNA SOLA VEZ CADA RESERVA
    // ========================================

    Object.entries(
        datosCalendario
    ).forEach(
        ([fecha, datosDia]) => {

            if (!datosDia?.cabanas) {
                return;
            }

            Object.entries(
                datosDia.cabanas
            ).forEach(
                ([numeroCabana, cabana]) => {

                    if (
                        !cabana ||
                        !cabana.reservaId ||
                        !cabana.titular
                    ) {
                        return;
                    }


                    // Preferimos el registro ORIGINAL
                    // y no una continuidad automática.
                    if (
                        cabana.continuidadAutomatica === true
                    ) {
                        return;
                    }


                    if (
                        reservasUnicas.has(
                            cabana.reservaId
                        )
                    ) {
                        return;
                    }


                    const noches =
                        Number(
                            cabana.noches
                        ) || 0;


                    if (noches < 1) {
                        return;
                    }


                    reservasUnicas.set(
                        cabana.reservaId,
                        {
                            reservaId:
                                cabana.reservaId,

                            numeroCabana,

                            titular:
                                cabana.titular,

                            fechaIngreso:
                                cabana.fechaOrigenReserva ||
                                fecha,

                            noches,

                            estado:
                                cabana.estado || ""
                        }
                    );
                }
            );
        }
    );

    // ========================================
// ESTADO VISUAL REAL DE CADA RESERVA
// ========================================

reservasUnicas.forEach(reserva => {

    let tieneCheckin = false;
    let tieneCheckout = false;

    Object.values(datosCalendario).forEach(datosDia => {

        if (!datosDia?.cabanas) {
            return;
        }

        Object.values(datosDia.cabanas).forEach(cabana => {

            if (
                String(cabana?.reservaId || "") !==
                String(reserva.reservaId)
            ) {
                return;
            }

            if (cabana.checkinRealizado === true) {
                tieneCheckin = true;
            }

            if (cabana.checkout === true) {
                tieneCheckout = true;
            }
        });
    });

    reserva.tieneCheckin = tieneCheckin;
    reserva.tieneCheckout = tieneCheckout;
});

 // ========================================
// DIBUJAR RESERVAS COMO BARRAS REALES
// ========================================

// ========================================
// ORDEN DE FILAS POR NÚMERO DE CABAÑA
// ========================================

// CAB 1 siempre tiene prioridad sobre CAB 2,
// CAB 2 sobre CAB 3, etc.
// Si es la misma cabaña, ordenamos por fecha.
const reservasOrdenadas =
    Array.from(reservasUnicas.values())
        .sort((a, b) => {

            const diferenciaCabana =
                Number(a.numeroCabana) -
                Number(b.numeroCabana);

            if (diferenciaCabana !== 0) {
                return diferenciaCabana;
            }

            return a.fechaIngreso.localeCompare(
                b.fechaIngreso
            );
        });


const filasReserva = new Map();


// Cada fila guarda las reservas que ya utiliza.
// Así una fila puede reutilizarse cuando
// las fechas NO se cruzan.
const ocupacionFilas = [];


reservasOrdenadas.forEach(reserva => {

    const fechaInicio =
        reserva.fechaIngreso;

    const fechaSalida =
        sumarDiasCalendario(
            reserva.fechaIngreso,
            Number(reserva.noches) || 1
        );


    let filaEncontrada = -1;


    // Buscar la primera fila donde
    // esta reserva no choque con ninguna existente.
    for (
        let fila = 0;
        fila < ocupacionFilas.length;
        fila++
    ) {

        const hayCruce =
            ocupacionFilas[fila].some(
                existente => {

                    return (
                        fechaInicio <
                            existente.fechaSalida &&
                        fechaSalida >
                            existente.fechaInicio
                    );
                }
            );


        if (!hayCruce) {
            filaEncontrada = fila;
            break;
        }
    }


    // Si todas las filas están ocupadas,
    // crear una nueva.
    if (filaEncontrada === -1) {

        filaEncontrada =
            ocupacionFilas.length;

        ocupacionFilas.push([]);
    }


    ocupacionFilas[
        filaEncontrada
    ].push({
        fechaInicio,
        fechaSalida
    });


    filasReserva.set(
        reserva.reservaId,
        filaEncontrada
    );
});


// Datos del mes actualmente visible
const anioCalendario =
    fechaCalendario.getFullYear();

const mesCalendario =
    fechaCalendario.getMonth();

const primerDiaMes =
    new Date(
        anioCalendario,
        mesCalendario,
        1
    );

let posicionPrimerDia =
    primerDiaMes.getDay() - 1;

if (posicionPrimerDia === -1) {
    posicionPrimerDia = 6;
}


reservasOrdenadas.forEach(reserva => {

    const totalNoches =
        Number(reserva.noches) || 0;

    if (totalNoches < 1) {
        return;
    }


    // ========================================
    // OBTENER LAS NOCHES VISIBLES DE LA RESERVA
    // ========================================

    const nochesVisibles = [];

    for (
        let indice = 0;
        indice < totalNoches;
        indice++
    ) {

        const fechaNoche =
            sumarDiasCalendario(
                reserva.fechaIngreso,
                indice
            );

        const [
            anioNoche,
            mesNoche,
            diaNoche
        ] =
            fechaNoche
                .split("-")
                .map(Number);


        // Solo dibujamos noches
        // pertenecientes al mes visible
        if (
            anioNoche !== anioCalendario ||
            mesNoche - 1 !== mesCalendario
        ) {
            continue;
        }


        const indiceCelda =
            posicionPrimerDia +
            diaNoche - 1;


        const filaSemana =
            Math.floor(
                indiceCelda / 7
            ) + 1;


        const columna =
            (indiceCelda % 7) + 1;


        nochesVisibles.push({
            fecha: fechaNoche,
            filaSemana,
            columna
        });
    }


    if (nochesVisibles.length === 0) {
        return;
    }


    // ========================================
    // DIVIDIR SI LA RESERVA CRUZA DE SEMANA
    // ========================================

    const segmentos = [];

    nochesVisibles.forEach(noche => {

        const ultimo =
            segmentos[
                segmentos.length - 1
            ];


        if (
            ultimo &&
            ultimo.filaSemana ===
                noche.filaSemana &&
            noche.columna ===
                ultimo.columnaFin + 1
        ) {

            ultimo.columnaFin =
                noche.columna;

        } else {

            segmentos.push({
                filaSemana:
                    noche.filaSemana,

                columnaInicio:
                    noche.columna,

                columnaFin:
                    noche.columna
            });
        }
    });


    // ========================================
    // CREAR UNA BARRA POR TRAMO SEMANAL
    // ========================================

    segmentos.forEach(
        (segmento, indiceSegmento) => {

            const barra =
                document.createElement(
                    "button"
                );

            barra.type = "button";

            barra.className =
                "calendario-reserva-barra";

            let claseColor = "";

if (reserva.tieneCheckout) {

    claseColor = "cal-reserva-checkout";

} else if (reserva.tieneCheckin) {

    claseColor = "cal-reserva-checkin";

} else {

    const clasesEstado = {
        "libre-libre": "cal-reserva-libre",
        "libre-ingresa": "cal-reserva-ingresa",
        "sale-libre": "cal-reserva-sale",
        "sale-ingresa": "cal-reserva-ingresa",
        "continua": "cal-reserva-continua",
        "bloqueada": "cal-reserva-bloqueada",
        "fullday": "cal-reserva-fullday"
    };

    claseColor =
        clasesEstado[reserva.estado] || "";
}

if (claseColor) {
    barra.classList.add(claseColor);
}


            barra.style.gridColumn =
                `${segmento.columnaInicio} / ${segmento.columnaFin + 1}`;

            barra.style.gridRow =
                `${segmento.filaSemana}`;


            barra.style.setProperty(
                "--fila-reserva",
                filasReserva.get(
                    reserva.reservaId
                )
            );


            // El nombre aparece solo
            // en el primer tramo visible
            barra.textContent =
                indiceSegmento === 0
                    ? `CAB ${reserva.numeroCabana} · ${reserva.titular}`
                    : "";


            barra.dataset.cabana =
                reserva.numeroCabana;

            barra.dataset.reservaId =
                reserva.reservaId || "";


            barra.addEventListener(
                "click",
                evento => {

                    evento.stopPropagation();

                    console.log(
                        "RESERVA CALENDARIO:",
                        reserva.reservaId,
                        "CAB",
                        reserva.numeroCabana
                    );
                }
            );


            capaReservas.appendChild(
    barra
);
        }
    );
});

}


// ========================================
// SUMAR DÍAS SIN DEPENDER DE app.js
// ========================================

function sumarDiasCalendario(
    fecha,
    cantidad
) {

    const [
        anio,
        mes,
        dia
    ] =
        fecha
            .split("-")
            .map(Number);


    const resultado =
        new Date(
            anio,
            mes - 1,
            dia
        );


    resultado.setDate(
        resultado.getDate() +
        cantidad
    );


    return [
        resultado.getFullYear(),

        String(
            resultado.getMonth() + 1
        ).padStart(2, "0"),

        String(
            resultado.getDate()
        ).padStart(2, "0")

    ].join("-");
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

const fechaHoy =
`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

// ========================================
// FECHA OPERATIVA AL INICIAR
// ========================================

// Al abrir Haiku, siempre comenzamos en el día actual.
// Los días anteriores siguen guardados y pueden
// consultarse manualmente desde el calendario.

let fechaSeleccionada = fechaHoy;

localStorage.setItem(
    "haikuFechaSeleccionada",
    fechaSeleccionada
);

function seleccionarDia(año, mes, dia, fechaISO) {

    fechaSeleccionada = fechaISO;

    localStorage.setItem(
        "haikuFechaSeleccionada",
        fechaSeleccionada
    );

    cargarDatosDia(fechaSeleccionada);
cargarCabanasDia(fechaSeleccionada);

if (typeof renderizarAgendaServicios === "function") {
    renderizarAgendaServicios();
}

// Actualizar pagos del día seleccionado
if (typeof cargarAbonosPagos === "function") {
    cargarAbonosPagos();
}

// Cargar cierre correspondiente al día seleccionado
if (typeof cargarCierreDia === "function") {
    cargarCierreDia(fechaSeleccionada);
}

if (typeof actualizarCierreTurno === "function") {
    actualizarCierreTurno();
}

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