// ========================================
// NAVEGACIÓN PRINCIPAL
// ========================================

const botonesMenu = document.querySelectorAll(".menu-item[data-seccion]");
const seccionesApp = document.querySelectorAll(".seccion-app");

// ========================================
// PANEL AGREGAR NOTA
// ========================================

const botonAgregarNota =
    document.getElementById("agregar-nota");

const panelAgregarNota =
    document.getElementById("panel-agregar-nota");

botonesMenu.forEach(boton => {

    boton.addEventListener("click", () => {

        const seccionDestino = boton.dataset.seccion;

                // Si volvemos a Aseo desde Revisión Aseo Express,
        // restaurar el listado principal de Aseo
        if (seccionDestino === "aseo") {

            const panelAseo =
                document.querySelector("#seccion-aseo .aseo-panel");

            const revisionExpress =
                document.getElementById("aseo-express-individual");

            if (revisionExpress) {
                revisionExpress.classList.remove("activa");
            }

            if (panelAseo) {
                panelAseo.style.display = "";
            }

        }

        // ========================================
        // RECORDAR SECCIÓN ACTUAL
        // ========================================

        localStorage.setItem(
        "haikuSeccionActual",
        seccionDestino
        );

        // Ocultar todas las secciones
        seccionesApp.forEach(seccion => {
            seccion.classList.remove("activa");
        });

        // Quitar estado activo de los botones
        botonesMenu.forEach(item => {
            item.classList.remove("activo");
        });

        // Mostrar sección seleccionada
        const nuevaSeccion =
            document.getElementById(`seccion-${seccionDestino}`);

        if (nuevaSeccion) {
            nuevaSeccion.classList.add("activa");
            boton.classList.add("activo");
        }

        // Actualizar Pagos al entrar a la sección
        if (seccionDestino === "pagos") {
        cargarAbonosPagos();
        cargarSaldosCheckin();
        }

    });

});

// ========================================
// RESTAURAR SECCIÓN AL RECARGAR
// ========================================

const seccionGuardada =
    localStorage.getItem("haikuSeccionActual");

if (seccionGuardada) {

    // Ocultar todas las secciones

    seccionesApp.forEach(seccion => {
        seccion.classList.remove("activa");
    });


    // Quitar activo de todos los botones

    botonesMenu.forEach(boton => {
        boton.classList.remove("activo");
    });


    // Recuperar sección guardada

    const seccionRestaurada =
        document.getElementById(
            `seccion-${seccionGuardada}`
        );


    const botonRestaurado =
        document.querySelector(
            `.menu-item[data-seccion="${seccionGuardada}"]`
        );


    if (seccionRestaurada) {
        seccionRestaurada.classList.add("activa");
    }


    if (botonRestaurado) {
        botonRestaurado.classList.add("activo");
    }

}

// ========================================
// DATOS OPERATIVOS POR FECHA
// ========================================

const notasDia = document.getElementById("notas-dia");

notasDia.addEventListener("input", () => {
    if (!fechaSeleccionada) return;

    const datos = obtenerDatosDia(fechaSeleccionada);

    datos.notas = notasDia.value;

    guardarDatos();

    generarResumenOperativo(fechaSeleccionada);
});

const resumenMantencion =
    document.getElementById("resumen-mantencion");

const resumenLavanderia =
    document.getElementById("resumen-lavanderia");

// Recuperar información guardada en este navegador
let datosPorFecha =
    JSON.parse(localStorage.getItem("haikuDatos")) || {};


// ========================================
// OBTENER / CREAR DÍA
// ========================================

function obtenerDatosDia(fecha) {

    if (!datosPorFecha[fecha]) {

        datosPorFecha[fecha] = {
            encargado: "",
            notas: "",
            notasOperativas: [],
            cabanas: {},
            servicios: [],
            pagos: [],
            mantencion: [],
            lavanderia: []
        };

    }

    if (!datosPorFecha[fecha].notasOperativas) {
         datosPorFecha[fecha].notasOperativas = [];
    
    }

    if (!datosPorFecha[fecha].mantencion) {
    datosPorFecha[fecha].mantencion = [];
    }

    if (!datosPorFecha[fecha].lavanderia) {
    datosPorFecha[fecha].lavanderia = [];
    }

    return datosPorFecha[fecha];
}

// ===============================
// GENERAR ID ÚNICO DE RESERVA
// ===============================

function generarReservaId(fecha, numeroCabana) {

    const fechaLimpia = String(fecha).replaceAll("-", "");

    let contador = 1;
    let reservaId = "";

    do {

        reservaId = `R-${fechaLimpia}-${numeroCabana}-${contador}`;
        contador++;

    } while (existeReservaId(reservaId));

    return reservaId;
}


// ===============================
// COMPROBAR SI EXISTE RESERVA ID
// ===============================

function existeReservaId(reservaId) {

    return Object.values(datosPorFecha).some(dia => {

        if (!dia.cabanas) return false;

        return Object.values(dia.cabanas).some(cabana =>
            cabana?.reservaId === reservaId
        );

    });
}

// =============================
// SUMAR DÍAS A UNA FECHA
// =============================

function sumarDiasFecha(fecha, cantidadDias) {

    const [anio, mes, dia] = fecha.split("-").map(Number);

    const fechaBase = new Date(anio, mes - 1, dia);

    fechaBase.setDate(fechaBase.getDate() + cantidadDias);

    const nuevoAnio = fechaBase.getFullYear();
    const nuevoMes = String(fechaBase.getMonth() + 1).padStart(2, "0");
    const nuevoDia = String(fechaBase.getDate()).padStart(2, "0");

    return `${nuevoAnio}-${nuevoMes}-${nuevoDia}`;
}

// =============================
// SINCRONIZAR DATOS DE RESERVA
// =============================

function sincronizarDatosReserva(reservaId, numeroCabana, campo, valor) {

    if (!reservaId) {
        return;
    }

    Object.values(datosPorFecha).forEach(dia => {

        if (!dia.cabanas) {
            return;
        }

        const cabana = dia.cabanas[numeroCabana];

        if (!cabana) {
            return;
        }

        // Solo modificar días pertenecientes a la misma reserva
        if (cabana.reservaId !== reservaId) {
            return;
        }

        cabana[campo] = valor;

    });

    guardarDatos();
}

// =============================
// CREAR CONTINUIDADES DE RESERVA
// =============================

function crearContinuidadesReserva(fechaInicio, numeroCabana, noches) {

    const datosInicio = obtenerDatosDia(fechaInicio);
    const cabanaInicio = datosInicio.cabanas?.[numeroCabana];

    if (!cabanaInicio || noches < 1) {
    return;
}

    const reservaId = cabanaInicio.reservaId;

    if (!reservaId) {
        return;
    }

    for (let i = 1; i <= noches; i++) {

        const fechaContinuidad = sumarDiasFecha(fechaInicio, i);
        const datosContinuidad = obtenerDatosDia(fechaContinuidad);

        if (!datosContinuidad.cabanas) {
            datosContinuidad.cabanas = {};
        }

        // Si la cabaña todavía no existe ese día, crearla
        if (!datosContinuidad.cabanas[numeroCabana]) {
            datosContinuidad.cabanas[numeroCabana] = {};
        }

        const destino = datosContinuidad.cabanas[numeroCabana];

// ¿Ya existe otra reserva REAL en esta cabaña para este día?
const hayOtraReserva =
    destino.reservaId &&
    destino.reservaId !== reservaId &&
    destino.titular;

if (hayOtraReserva) {

    // Si este es el día de salida de la reserva anterior,
    // y ya comienza otra reserva en la misma cabaña,
    // la nueva reserva pasa a SALE / INGRESA.
    if (i === noches) {
        destino.estado = "sale-ingresa";
    }

    // IMPORTANTE:
    // No modificar titular, pasajeros, noches ni reservaId
    // de la reserva que ya existe.
    continue;
}

// Identificador de la misma reserva
destino.reservaId = reservaId;

// Datos que heredamos
destino.titular = cabanaInicio.titular || "";
destino.adultos = cabanaInicio.adultos || "";
destino.ninos = cabanaInicio.ninos || "";
destino.mascotas = cabanaInicio.mascotas || "";

        // Estado según el día de la reserva
        if (i < noches) {
        destino.estado = "continua";
        } else {
        destino.estado = "sale-libre";
        }

        // Información de estadía
        destino.noches = noches;

        // Marcamos que esta fila fue creada automáticamente
        destino.continuidadAutomatica = true;
        destino.fechaOrigenReserva = fechaInicio;
    }

    guardarDatos();
}

// ========================================
// GUARDAR TODO
// ========================================

function guardarDatos() {

    localStorage.setItem(
        "haikuDatos",
        JSON.stringify(datosPorFecha)
    );

}


// ========================================
// CARGAR UN DÍA
// ========================================

function cargarDatosDia(fecha) {

    const datos = obtenerDatosDia(fecha);

    notasDia.value = datos.notas || "";

    resumenMantencion.value = datos.mantencion || "";
    resumenLavanderia.value = datos.lavanderia || "";

    // cargarCabanasDia(fecha);

    mostrarNotasOperativas(fecha);

    // Actualizar pagos para la fecha seleccionada
    if (typeof cargarAbonosPagos === "function") {
        cargarAbonosPagos();
    }

    if (typeof cargarSaldosCheckin === "function") {
        cargarSaldosCheckin();
    }
}


// ========================================
// GUARDAR NOTAS AUTOMÁTICAMENTE
// ========================================

notasDia.addEventListener("input", () => {

    if (!fechaSeleccionada) {
        return;
    }

    const datos = obtenerDatosDia(fechaSeleccionada);

    datos.notas = notasDia.value;

    guardarDatos();

});

resumenMantencion.addEventListener("input", () => {

    if (!fechaSeleccionada) {
        return;
    }

    const datos = obtenerDatosDia(fechaSeleccionada);

    datos.mantencion = resumenMantencion.value;

    guardarDatos();
});


resumenLavanderia.addEventListener("input", () => {

    if (!fechaSeleccionada) {
        return;
    }

    const datos = obtenerDatosDia(fechaSeleccionada);

    datos.lavanderia = resumenLavanderia.value;

    guardarDatos();
});

// ========================================
// CARGAR DÍA ACTUAL AL INICIAR
// ========================================

cargarDatosDia(fechaSeleccionada);

// ========================================
// ABRIR PANEL AGREGAR NOTA
// ========================================

botonAgregarNota.addEventListener("click", () => {

    panelAgregarNota.classList.add("activo");

});

// ========================================
// CERRAR PANEL AGREGAR NOTA
// ========================================

const botonCerrarNota =
    document.getElementById("cerrar-panel-nota");

const botonCancelarNota =
    document.getElementById("cancelar-nota");

const botonGuardarNota =
    document.getElementById("guardar-nota");

const selectorNotaCabana =
    document.getElementById("nota-cabana");

const textoNota =
    document.getElementById("nota-texto");


function cerrarPanelNota() {

    panelAgregarNota.classList.remove("activo");

}


botonCerrarNota.addEventListener("click", () => {

    cerrarPanelNota();

});


botonCancelarNota.addEventListener("click", () => {

    cerrarPanelNota();

});

// ========================================
// MOSTRAR NOTAS OPERATIVAS EN LA TABLA
// ========================================

function mostrarNotasOperativas(fecha) {

    const datos = obtenerDatosDia(fecha);

    // Recorrer CAB 1 hasta CAB 11
    for (let numeroCabana = 1; numeroCabana <= 11; numeroCabana++) {

        const cajaNota =
            document.querySelector(
                `[data-nota-cabana="${numeroCabana}"]`
            );

        if (!cajaNota) {
            continue;
        }

        const notasCabana =
            datos.notasOperativas.filter(nota => {
                return String(nota.cabana) === String(numeroCabana);
            });

        if (notasCabana.length === 0) {
            cajaNota.textContent = "";
            continue;
        }

        cajaNota.innerHTML = notasCabana
    .map(nota => `
        <span class="nota-operativa-item">
            ${nota.texto}
            <button
                type="button"
                class="nota-eliminar"
                data-cabana="${numeroCabana}"
                data-texto="${nota.texto}"
                title="Eliminar nota"
            >×</button>
        </span>
    `)
    .join(" ");
    }
}

// =====================================
// ELIMINAR NOTA OPERATIVA
// =====================================

document.addEventListener("click", (evento) => {

    const boton = evento.target.closest(".nota-eliminar");

    if (!boton || !fechaSeleccionada) {
        return;
    }

    const numeroCabana = boton.dataset.cabana;
    const textoNota = boton.dataset.texto;

    const datos = obtenerDatosDia(fechaSeleccionada);

    const indice = datos.notasOperativas.findIndex(nota =>
        String(nota.cabana) === String(numeroCabana) &&
        nota.texto === textoNota
    );

    if (indice === -1) {
        return;
    }

    datos.notasOperativas.splice(indice, 1);

    guardarDatos();

mostrarNotasOperativas(fechaSeleccionada);

// Actualizar automáticamente las otras secciones
actualizarTarjetasRevision(fechaSeleccionada);
actualizarResumenAseo(fechaSeleccionada);

textoNota.value = "";
selectorNotaCabana.value = "";

cerrarPanelNota();
});

// ========================================
// GUARDAR NOTA OPERATIVA
// ========================================

botonGuardarNota.addEventListener("click", () => {

    if (!fechaSeleccionada) {
        return;
    }

    const nota = textoNota.value.trim();

    if (!nota) {
        return;
    }

    const datos = obtenerDatosDia(fechaSeleccionada);

    datos.notasOperativas.push({
        cabana: selectorNotaCabana.value,
        texto: nota
    });

    guardarDatos();

mostrarNotasOperativas(fechaSeleccionada);

// Sincronizar Cabañas y Aseo inmediatamente
actualizarTarjetasRevision(fechaSeleccionada);
actualizarResumenAseo(fechaSeleccionada);
generarResumenOperativo(fechaSeleccionada);

textoNota.value = "";
selectorNotaCabana.value = "";

cerrarPanelNota();

});

// =====================================================
// ESTADO FINAL · TEXTO COMPACTO EN CELULAR
// =====================================================

function actualizarTextoEstadoFinalResponsive() {

    const esMovil = window.innerWidth <= 700;

    document.querySelectorAll('.estado-final-select').forEach(select => {

        Array.from(select.options).forEach(option => {

            // Guardamos el texto original una sola vez
            if (!option.dataset.textoOriginal) {
                option.dataset.textoOriginal = option.textContent;
            }

            if (esMovil) {

                if (option.value === 'Pendiente') {
                    option.textContent = 'PEND.';
                }

                else if (option.value === 'LISTA') {
                    option.textContent = 'LISTA';
                }

                else if (option.value === 'CON DETALLES') {
                    option.textContent = 'DET.';
                }

            } else {

                // En computador vuelve al texto normal
                option.textContent = option.dataset.textoOriginal;

            }

        });

    });

}

actualizarTextoEstadoFinalResponsive();

window.addEventListener('resize', actualizarTextoEstadoFinalResponsive);