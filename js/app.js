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

    // Recordar de qué tipo de ingreso nació la reserva
const estadoIngresoReserva =
    cabanaInicio.estadoIngresoReserva ||
    (
        cabanaInicio.estado === "libre-ingresa" ||
        cabanaInicio.estado === "sale-ingresa"
            ? cabanaInicio.estado
            : ""
    );

if (estadoIngresoReserva) {
    cabanaInicio.estadoIngresoReserva =
        estadoIngresoReserva;
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

// Heredar el tipo de ingreso original de la reserva
destino.estadoIngresoReserva =
    estadoIngresoReserva;

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
generarResumenOperativo(fechaSeleccionada);

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

// ========================================
// BUSCADOR GLOBAL POR PALABRA CLAVE
// ========================================

const buscadorPalabra =
    document.getElementById("busqueda-palabra");

const contadorBusquedaPalabra =
    document.getElementById(
        "contador-busqueda-palabra"
    );

const botonBusquedaAnterior =
    document.getElementById(
        "busqueda-palabra-anterior"
    );

const botonBusquedaSiguiente =
    document.getElementById(
        "busqueda-palabra-siguiente"
    );

let indiceBusquedaPalabra = -1;


// Quitar resaltados anteriores
function limpiarBusquedaPalabra() {

    document
        .querySelectorAll("mark.busqueda-palabra-marca")
        .forEach(marca => {

            const padre =
                marca.parentNode;

            const texto =
                document.createTextNode(
                    marca.textContent
                );

            marca.replaceWith(texto);

            // Volver a unir los fragmentos de texto
            if (padre) {
                padre.normalize();
            }

        });

}


// Buscar dentro de la sección visible
function buscarPalabraEnSeccion() {

    if (!buscadorPalabra) {
        return;
    }

    // Primero quitamos resultados anteriores
    limpiarBusquedaPalabra();

    indiceBusquedaPalabra = -1;


    const termino =
        buscadorPalabra.value.trim();

    if (termino.length < 1) {
    return;
}


    // Buscar la sección actualmente visible
    const seccionActiva =
        Array.from(
            document.querySelectorAll(".seccion-app")
        ).find(seccion => {

            return (
                !seccion.hidden &&
                getComputedStyle(seccion).display !== "none"
            );

        });


    if (!seccionActiva) {
        return;
    }


    const terminoSeguro =
    termino.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

    const expresion =
    new RegExp(
        `(${terminoSeguro})`,
        "gi"
    );


    const walker =
        document.createTreeWalker(
            seccionActiva,
            NodeFilter.SHOW_TEXT
        );


    const nodosTexto = [];

    let nodo;

    while (
        nodo = walker.nextNode()
    ) {

        const padre =
            nodo.parentElement;

        if (!padre) {
            continue;
        }


        // No tocar controles ni elementos delicados
        if (
            padre.closest(
                "input, textarea, select, option, script, style, button"
            )
        ) {
            continue;
        }


        if (
            nodo.textContent &&
            expresion.test(nodo.textContent)
        ) {
            nodosTexto.push(nodo);
        }

        expresion.lastIndex = 0;
    }


    // Reemplazar coincidencias por MARK
    nodosTexto.forEach(nodoTexto => {

        const fragmento =
            document.createDocumentFragment();

        const partes =
            nodoTexto.textContent.split(expresion);


        partes.forEach(parte => {

            if (
                parte.toLowerCase() ===
                termino.toLowerCase()
            ) {

                const marca =
                    document.createElement("mark");

                marca.className =
                    "busqueda-palabra-marca";

                marca.textContent =
                    parte;

                fragmento.appendChild(
                    marca
                );

            } else {

                fragmento.appendChild(
                    document.createTextNode(parte)
                );

            }

        });


        nodoTexto.replaceWith(
            fragmento
        );

    });


    // Llevarnos a la primera coincidencia
    const coincidencias =
    seccionActiva.querySelectorAll(
        ".busqueda-palabra-marca"
    );

if (contadorBusquedaPalabra) {

    if (coincidencias.length > 0) {

        contadorBusquedaPalabra.textContent =
            `0/${coincidencias.length}`;

        contadorBusquedaPalabra.hidden =
            false;

    if (botonBusquedaAnterior) {
        botonBusquedaAnterior.hidden = false;
}

    if (botonBusquedaSiguiente) {
        botonBusquedaSiguiente.hidden = false;
}

    } else {

        contadorBusquedaPalabra.textContent =
            "0/0";

        contadorBusquedaPalabra.hidden =
            termino.length === 0;

        if (botonBusquedaAnterior) {
        botonBusquedaAnterior.hidden = true;
}

        if (botonBusquedaSiguiente) {
        botonBusquedaSiguiente.hidden = true;
}
    }
}

}


// Mientras escribimos
if (buscadorPalabra) {

    buscadorPalabra.addEventListener(
        "input",
        buscarPalabraEnSeccion
    );

buscadorPalabra.addEventListener(
    "keydown",
    evento => {

        if (evento.key !== "Enter") {
            return;
        }

        evento.preventDefault();

        const seccionActiva =
            Array.from(
                document.querySelectorAll(
                    ".seccion-app"
                )
            ).find(seccion => {

                return (
                    !seccion.hidden &&
                    getComputedStyle(seccion).display !== "none"
                );

            });

        if (!seccionActiva) {
            return;
        }

        const coincidencias =
            Array.from(
                seccionActiva.querySelectorAll(
                    ".busqueda-palabra-marca"
                )
            );

        if (coincidencias.length === 0) {
            return;
        }


        // Pasar a la siguiente coincidencia
        indiceBusquedaPalabra++;

        // Si llegamos al final, volver a la primera
        if (
            indiceBusquedaPalabra >=
            coincidencias.length
        ) {
            indiceBusquedaPalabra = 0;
        }


        // Quitar selección anterior
        coincidencias.forEach(
            marca => {
                marca.classList.remove(
                    "busqueda-palabra-activa"
                );
            }
        );


        const actual =
            coincidencias[indiceBusquedaPalabra];

        actual.classList.add(
            "busqueda-palabra-activa"
        );


        actual.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });


        if (contadorBusquedaPalabra) {

            contadorBusquedaPalabra.textContent =
                `${indiceBusquedaPalabra + 1}/${coincidencias.length}`;

            contadorBusquedaPalabra.hidden =
                false;
        }

    }
);

if (botonBusquedaSiguiente) {
    botonBusquedaSiguiente.addEventListener(
        "click",
        () => {
            buscadorPalabra.dispatchEvent(
                new KeyboardEvent(
                    "keydown",
                    {
                        key: "Enter",
                        bubbles: true
                    }
                )
            );
        }
    );
}

if (botonBusquedaAnterior) {

    botonBusquedaAnterior.addEventListener(
        "click",
        () => {

            const seccionActiva =
                Array.from(
                    document.querySelectorAll(
                        ".seccion-app"
                    )
                ).find(seccion =>
                    !seccion.hidden &&
                    getComputedStyle(seccion).display !== "none"
                );

            if (!seccionActiva) return;

            const coincidencias =
                Array.from(
                    seccionActiva.querySelectorAll(
                        ".busqueda-palabra-marca"
                    )
                );

            if (coincidencias.length === 0) return;

            indiceBusquedaPalabra--;

            if (indiceBusquedaPalabra < 0) {
                indiceBusquedaPalabra =
                    coincidencias.length - 1;
            }

            coincidencias.forEach(marca => {
                marca.classList.remove(
                    "busqueda-palabra-activa"
                );
            });

            const actual =
                coincidencias[indiceBusquedaPalabra];

            actual.classList.add(
                "busqueda-palabra-activa"
            );

            actual.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            if (contadorBusquedaPalabra) {
                contadorBusquedaPalabra.textContent =
                    `${indiceBusquedaPalabra + 1}/${coincidencias.length}`;
            }
        }
    );
}

}


// Si cambiamos de sección,
// repetir la búsqueda en la nueva sección
document.addEventListener(
    "click",
    evento => {

        const botonSeccion =
            evento.target.closest(
                "[data-seccion]"
            );

        if (!botonSeccion) {
            return;
        }

        setTimeout(
            buscarPalabraEnSeccion,
            50
        );

    }
);

// ========================================
// PANEL DE NOTIFICACIONES
// ========================================

const botonNotificaciones =
    document.getElementById(
        "boton-notificaciones"
    );

const panelNotificaciones =
    document.getElementById(
        "panel-notificaciones"
    );

const cerrarNotificaciones =
    document.getElementById(
        "cerrar-notificaciones"
    );

const contenidoNotificaciones =
    document.getElementById(
        "notificaciones-contenido"
    );

// ========================================
// CHECK-IN PENDIENTES REALES
// ========================================

function obtenerCheckinsPendientes() {

    if (!fechaSeleccionada) {
        return [];
    }

    const datos =
        datosPorFecha[fechaSeleccionada];

    if (!datos?.cabanas) {
        return [];
    }

    return Object.entries(datos.cabanas)
        .filter(([numeroCabana, cabana]) => {

            if (!cabana) {
                return false;
            }

            const ingresaHoy =
                cabana.estado === "libre-ingresa" ||
                cabana.estado === "sale-ingresa";

            const faltaCheckin =
                cabana.checkinRealizado !== true;

            return (
                ingresaHoy &&
                faltaCheckin
            );
        })
        .map(([numeroCabana, cabana]) => ({
            numeroCabana,
            reservaId:
                cabana.reservaId || "",
            titular:
                cabana.titular || "Sin titular",
            hora:
                cabana.ingreso || ""
        }));
}

// ========================================
// SERVICIOS PRÓXIMOS REALES
// ========================================

// ========================================
// HORARIO INTELIGENTE DE SERVICIOS
// ========================================

function obtenerFechaLocalISO() {

    const ahora = new Date();

    const anio = ahora.getFullYear();

    const mes =
        String(
            ahora.getMonth() + 1
        ).padStart(2, "0");

    const dia =
        String(
            ahora.getDate()
        ).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}


function obtenerEstadoHorarioServicio(
    fechaServicio,
    horaServicio,
    duracionMinutos = 0
) {

    if (!fechaServicio || !horaServicio) {
        return null;
    }

    const hoy =
        obtenerFechaLocalISO();

    if (fechaServicio !== hoy) {

        return {
            tipo: "programado",
            texto: horaServicio,
            minutos: null
        };
    }


    const [hora, minutos] =
        horaServicio
            .split(":")
            .map(Number);

    if (
        Number.isNaN(hora) ||
        Number.isNaN(minutos)
    ) {
        return null;
    }


    const ahora =
        new Date();

    const inicioServicio =
        new Date();

    inicioServicio.setHours(
        hora,
        minutos,
        0,
        0
    );


    const finServicio =
        new Date(
            inicioServicio.getTime() +
            duracionMinutos * 60000
        );


    const minutosParaInicio =
        Math.round(
            (
                inicioServicio.getTime() -
                ahora.getTime()
            ) / 60000
        );


    const minutosParaFin =
        Math.round(
            (
                finServicio.getTime() -
                ahora.getTime()
            ) / 60000
        );


    // TODAVÍA NO EMPIEZA
    if (minutosParaInicio > 60) {

        return {
            tipo: "programado",
            texto: horaServicio
        };
    }


    if (minutosParaInicio > 30) {

        return {
            tipo: "proximo",
            texto:
                `En ${minutosParaInicio} min`
        };
    }


    if (minutosParaInicio > 15) {

        return {
            tipo: "atencion",
            texto:
                `En ${minutosParaInicio} min`
        };
    }


    if (minutosParaInicio > 0) {

        return {
            tipo: "urgente",
            texto:
                `En ${minutosParaInicio} min`
        };
    }


    // SERVICIO EN CURSO
    if (
        duracionMinutos > 0 &&
        minutosParaFin > 15
    ) {

        return {
            tipo: "en-curso",
            texto:
                `En curso · termina ${
                    String(
                        finServicio.getHours()
                    ).padStart(2, "0")
                }:${
                    String(
                        finServicio.getMinutes()
                    ).padStart(2, "0")
                }`
        };
    }


    // ÚLTIMOS 15 MIN
    if (
        duracionMinutos > 0 &&
        minutosParaFin > 0
    ) {

        return {
            tipo: "finalizando",
            texto:
                `Termina en ${minutosParaFin} min`
        };
    }


    // JUSTO AL TERMINAR
    if (
        duracionMinutos > 0 &&
        minutosParaFin >= -5
    ) {

        return {
            tipo: "ahora",
            texto:
                "Finaliza ahora"
        };
    }


    // YA TERMINÓ
    if (duracionMinutos > 0) {

        return {
            tipo: "atrasado",
            texto:
                `Terminó hace ${Math.abs(
                    minutosParaFin
                )} min`
        };
    }


    return {
        tipo: "atrasado",
        texto: "Hora del servicio"
    };
}

function obtenerServiciosProximos() {

    if (!fechaSeleccionada) {
        return [];
    }

    const servicios =
        JSON.parse(
            localStorage.getItem("haikuServicios")
        ) || [];

    return servicios
    .filter(servicio => {

        const esDelDia =
            servicio.fechaServicio ===
            fechaSeleccionada;

        const siguePendiente =
            servicio.estadoServicio !==
            "realizado";

        return (
            esDelDia &&
            siguePendiente
        );
    })
    .map(servicio => {

        let duracionMinutos = 0;

        const nombre =
            String(
                servicio.nombre || ""
            ).toLowerCase();

        const tipo =
            String(
                servicio.tipoServicio || ""
            ).toLowerCase();


        // ================================
        // TINAJAS
        // ================================

        if (
            tipo.includes("tinaja") ||
            nombre.includes("tinaja") ||
            nombre.includes("jacuzzi")
        ) {

            duracionMinutos = 60;
        }


        // ================================
        // MASAJES 30 MIN
        // ================================

        else if (
            nombre.includes("30 min") ||
            nombre.includes("30 minutos")
        ) {

            duracionMinutos = 30;
        }


        // ================================
        // MASAJES 60 MIN
        // ================================

        else if (
            nombre.includes("60 min") ||
            nombre.includes("60 minutos")
        ) {

            duracionMinutos = 60;
        }


        const horario =
            obtenerEstadoHorarioServicio(
                servicio.fechaServicio,
                servicio.hora,
                duracionMinutos
            );


        return {
            ...servicio,
            duracionMinutos,
            horario
        };
    })
    .sort((a, b) =>
        (a.hora || "")
            .localeCompare(b.hora || "")
    );
}

// ========================================
// PAGOS PENDIENTES REALES
// ========================================

function obtenerPagosPendientes() {

    if (!fechaSeleccionada) {
        return [];
    }

    const pendientes = [];

    const datos =
        obtenerDatosDia(fechaSeleccionada);

    const cabanas =
        datos?.cabanas || {};


    // ====================================
    // PAGOS DE RESERVAS
    // ====================================

    Object.entries(cabanas)
        .forEach(([numeroCabana, cabana]) => {

            if (!cabana) {
                return;
            }

            const estado =
                cabana.estado || "";

            const ingresaHoy =
                estado === "libre-ingresa" ||
                estado === "sale-ingresa";

            if (!ingresaHoy) {
                return;
            }


            const titular =
                cabana.titular ||
                cabana.nombre ||
                cabana.huesped ||
                "Sin titular";


            const abonoTexto =
                cabana.abono ||
                cabana.montoAbono ||
                "0";

            const abono =
                Number(
                    String(abonoTexto)
                        .replace(/\D/g, "")
                ) || 0;


            const total =
                Number(cabana.totalReserva) || 0;


            // --------------------------------
            // ABONO SIN VERIFICAR
            // --------------------------------

            if (
                cabana.abonoVerificado !== true
            ) {

                pendientes.push({
                    tipo: "abono",

                    numeroCabana,
                    reservaId:
                        cabana.reservaId || "",

                    titular,

                    titulo:
                        "Abono por verificar",

                    monto: abono
                });
            }


            // --------------------------------
            // COBRO CHECK-IN INCOMPLETO
            // --------------------------------

            const checkinCompleto =
                total > 0 &&
                cabana.checkinMedio !== "" &&
                cabana.checkinCobrado === true &&
                String(
                    cabana.checkinFolio || ""
                ).trim() !== "" &&
                String(
                    cabana.checkinCodAut || ""
                ).trim() !== "" &&
                String(
                    cabana.checkinBove || ""
                ).trim() !== "" &&
                cabana.checkinManager === true;


            if (!checkinCompleto) {

                const saldo =
                    Math.max(
                        total - abono,
                        0
                    );

                pendientes.push({
                    tipo: "checkin",

                    numeroCabana,
                    reservaId:
                        cabana.reservaId || "",

                    titular,

                    titulo:
                        "Cobro check-in pendiente",

                    monto: saldo
                });
            }

        });


    // ====================================
    // SERVICIOS PENDIENTES DE PAGO
    // ====================================

    const servicios =
        JSON.parse(
            localStorage.getItem(
                "haikuServicios"
            )
        ) || [];


    servicios
        .filter(servicio =>
            servicio.estadoPago ===
                "pendiente" &&
            servicio.fechaServicio ===
                fechaSeleccionada
        )
        .forEach(servicio => {

            pendientes.push({

                tipo: "servicio",

                numeroCabana:
                    servicio.numeroCabana,

                reservaId:
                    servicio.reservaId || "",

                titular:
                    servicio.titular ||
                    "Sin titular",

                titulo:
                    servicio.nombre ||
                    "Servicio",

                monto:
                    Number(
                        servicio.total
                    ) || 0
            });

        });


    return pendientes;
}

function actualizarNotificaciones() {

    if (!contenidoNotificaciones) {
        return;
    }

    const checkinsPendientes =
        obtenerCheckinsPendientes();

    const serviciosProximos =
        obtenerServiciosProximos();

    const pagosPendientes =
    obtenerPagosPendientes();

    contenidoNotificaciones.innerHTML = "";


    // =====================================
    // TODO AL DÍA
    // =====================================

    if (
    checkinsPendientes.length === 0 &&
    serviciosProximos.length === 0 &&
    pagosPendientes.length === 0
) {

        contenidoNotificaciones.innerHTML = `
            <div class="notificaciones-vacias">
                <span>✓</span>
                <strong>Todo al día</strong>
                <small>No hay pendientes por ahora.</small>
            </div>
        `;

        return;
    }


    // =====================================
    // SECCIÓN AHORA
    // =====================================

    const seccion =
        document.createElement("div");

    seccion.className =
        "notificaciones-seccion";


    const titulo =
        document.createElement("div");

    titulo.className =
        "notificaciones-seccion-titulo";

    titulo.textContent = "Ahora";

    seccion.appendChild(titulo);


    // =====================================
    // SERVICIOS PRÓXIMOS
    // =====================================

    if (serviciosProximos.length > 0) {

        const resumenServicios =
            document.createElement("button");

        resumenServicios.type = "button";

        resumenServicios.className =
            "notificacion-item";

        resumenServicios.innerHTML = `
            <span class="notificacion-icono">
                ⏰
            </span>

            <span class="notificacion-contenido">
                <strong>
                    ${serviciosProximos.length}
                    ${
                        serviciosProximos.length === 1
                            ? "servicio próximo"
                            : "servicios próximos"
                    }
                </strong>

                <small>Ver servicios</small>
            </span>

            <span class="notificacion-flecha">
                ›
            </span>
        `;


        const detalleServicios =
            document.createElement("div");

        detalleServicios.className =
            "notificacion-detalle";

        detalleServicios.hidden = true;


        serviciosProximos.forEach(servicio => {

            const item =
                document.createElement("button");

            item.type = "button";

            item.className =
                "notificacion-reserva";

            item.dataset.cabana =
                servicio.numeroCabana || "";

            item.dataset.fecha =
                servicio.fechaServicio || "";

            item.innerHTML = `
    <strong>
        ${servicio.hora || "--:--"}
        ·
        ${servicio.nombre || "Servicio"}
    </strong>

    <span>
        CAB ${servicio.numeroCabana}
        ${
            servicio.titular
                ? ` · ${servicio.titular}`
                : ""
        }
    </span>

    ${
        servicio.horario
            ? `
                <span
                    class="
                        notificacion-servicio-tiempo
                        servicio-${servicio.horario.tipo}
                    "
                >
                    ${servicio.horario.texto}
                </span>
            `
            : ""
    }
`;

            detalleServicios.appendChild(item);
        });


        resumenServicios.addEventListener(
            "click",
            () => {

                detalleServicios.hidden =
                    !detalleServicios.hidden;

                const flecha =
                    resumenServicios.querySelector(
                        ".notificacion-flecha"
                    );

                if (flecha) {
                    flecha.textContent =
                        detalleServicios.hidden
                            ? "›"
                            : "⌄";
                }
            }
        );


        detalleServicios.addEventListener(
            "click",
            evento => {

                const servicio =
                    evento.target.closest(
                        ".notificacion-reserva"
                    );

                if (!servicio) {
                    return;
                }

                const numeroCabana =
                    servicio.dataset.cabana;

                const fechaServicio =
                    servicio.dataset.fecha;


                const fechaAnterior =
                    fechaSeleccionada;

                if (fechaServicio) {
                    fechaSeleccionada =
                        fechaServicio;
                }


                const botonCabana =
                    document.querySelector(
                        `[data-ficha-cabana="${numeroCabana}"]`
                    );


                if (botonCabana) {

                    cerrarPanelNotificaciones();

                    botonCabana.click();
                }


                fechaSeleccionada =
                    fechaAnterior;
            }
        );


        seccion.appendChild(
            resumenServicios
        );

        seccion.appendChild(
            detalleServicios
        );
    }


    // =====================================
    // CHECK-IN PENDIENTES
    // =====================================

    if (checkinsPendientes.length > 0) {

        const resumen =
            document.createElement("button");

        resumen.type = "button";

        resumen.className =
            "notificacion-item";

        resumen.innerHTML = `
            <span class="notificacion-icono">
                ⚠️
            </span>

            <span class="notificacion-contenido">
                <strong>
                    ${checkinsPendientes.length}
                    ${
                        checkinsPendientes.length === 1
                            ? "check-in pendiente"
                            : "check-in pendientes"
                    }
                </strong>

                <small>Ver reservas</small>
            </span>

            <span class="notificacion-flecha">
                ›
            </span>
        `;


        const detalle =
            document.createElement("div");

        detalle.className =
            "notificacion-detalle";

        detalle.hidden = true;


        checkinsPendientes.forEach(reserva => {

            const item =
                document.createElement("button");

            item.type = "button";

            item.className =
                "notificacion-reserva";

            item.dataset.cabana =
                reserva.numeroCabana;

            item.innerHTML = `
                <strong>
                    CAB ${reserva.numeroCabana}
                    ·
                    ${reserva.titular}
                </strong>

                <span>
                    ${
                        reserva.hora
                            ? `Ingreso ${reserva.hora}`
                            : "Check-in pendiente"
                    }
                </span>
            `;

            detalle.appendChild(item);
        });


        resumen.addEventListener(
            "click",
            () => {

                detalle.hidden =
                    !detalle.hidden;

                const flecha =
                    resumen.querySelector(
                        ".notificacion-flecha"
                    );

                if (flecha) {
                    flecha.textContent =
                        detalle.hidden
                            ? "›"
                            : "⌄";
                }
            }
        );


        detalle.addEventListener(
            "click",
            evento => {

                const reserva =
                    evento.target.closest(
                        ".notificacion-reserva"
                    );

                if (!reserva) {
                    return;
                }

                const numeroCabana =
                    reserva.dataset.cabana;

                const botonCabana =
                    document.querySelector(
                        `[data-ficha-cabana="${numeroCabana}"]`
                    );

                if (botonCabana) {

                    cerrarPanelNotificaciones();

                    botonCabana.click();
                }
            }
        );


        seccion.appendChild(resumen);
        seccion.appendChild(detalle);
    }

    // =====================================
// PAGOS PENDIENTES
// =====================================

if (pagosPendientes.length > 0) {

    const resumenPagos =
        document.createElement("button");

    resumenPagos.type = "button";

    resumenPagos.className =
        "notificacion-item";

    resumenPagos.innerHTML = `
        <span class="notificacion-icono">
            💳
        </span>

        <span class="notificacion-contenido">
            <strong>
                ${pagosPendientes.length}
                ${
                    pagosPendientes.length === 1
                        ? "pago pendiente"
                        : "pagos pendientes"
                }
            </strong>

            <small>
                Ver pendientes
            </small>
        </span>

        <span class="notificacion-flecha">
            ›
        </span>
    `;


    const detallePagos =
        document.createElement("div");

    detallePagos.className =
        "notificacion-detalle";

    detallePagos.hidden = true;


    pagosPendientes.forEach(pago => {

        const item =
            document.createElement("button");

        item.type = "button";

        item.className =
            "notificacion-reserva";

        item.dataset.cabana =
            pago.numeroCabana;


        const montoTexto =
            Number(pago.monto) > 0
                ? `$${Number(
                    pago.monto
                ).toLocaleString("es-CL")}`
                : "";


        item.innerHTML = `
            <strong>
                CAB ${pago.numeroCabana}
                ·
                ${pago.titular}
            </strong>

            <span>
                ${pago.titulo}
                ${
                    montoTexto
                        ? ` · ${montoTexto}`
                        : ""
                }
            </span>
        `;

        detallePagos.appendChild(item);
    });


    resumenPagos.addEventListener(
        "click",
        () => {

            detallePagos.hidden =
                !detallePagos.hidden;

            const flecha =
                resumenPagos.querySelector(
                    ".notificacion-flecha"
                );

            if (flecha) {

                flecha.textContent =
                    detallePagos.hidden
                        ? "›"
                        : "⌄";
            }
        }
    );


    detallePagos.addEventListener(
        "click",
        evento => {

            const pago =
                evento.target.closest(
                    ".notificacion-reserva"
                );

            if (!pago) {
                return;
            }

            const numeroCabana =
                pago.dataset.cabana;

            const botonCabana =
                document.querySelector(
                    `[data-ficha-cabana="${numeroCabana}"]`
                );

            if (botonCabana) {

                cerrarPanelNotificaciones();

                botonCabana.click();
            }
        }
    );


    seccion.appendChild(
        resumenPagos
    );

    seccion.appendChild(
        detallePagos
    );
}


    contenidoNotificaciones.appendChild(
        seccion
    );
}


function abrirPanelNotificaciones() {

    if (!panelNotificaciones) {
        return;
    }

    actualizarNotificaciones();

    panelNotificaciones.hidden = false;
}


function cerrarPanelNotificaciones() {

    if (!panelNotificaciones) {
        return;
    }

    panelNotificaciones.hidden = true;
}


if (botonNotificaciones) {

    botonNotificaciones.addEventListener(
        "click",
        evento => {

            evento.stopPropagation();

            if (!panelNotificaciones) {
                return;
            }


            if (panelNotificaciones.hidden) {

                actualizarNotificaciones();

                panelNotificaciones.hidden = false;

            } else {

                panelNotificaciones.hidden = true;
            }

        }
    );
}
        


if (cerrarNotificaciones) {

    cerrarNotificaciones.addEventListener(
        "click",
        cerrarPanelNotificaciones
    );
}


// Cerrar al tocar fuera
document.addEventListener(
    "click",
    evento => {

        if (
            !panelNotificaciones ||
            panelNotificaciones.hidden
        ) {
            return;
        }

        if (
            evento.target.closest(
                "#panel-notificaciones"
            )
        ) {
            return;
        }

        if (
            evento.target.closest(
                "#boton-notificaciones"
            )
        ) {
            return;
        }

        cerrarPanelNotificaciones();
    }
);

// ========================================
// NUEVA RESERVA · ABRIR / CERRAR MODAL
// ========================================

const botonNuevaReserva =
    document.getElementById("boton-nueva-reserva");

const modalNuevaReserva =
    document.getElementById("modal-nueva-reserva");

const cerrarNuevaReserva =
    document.getElementById("cerrar-nueva-reserva");

const cancelarNuevaReserva =
    document.getElementById("cancelar-nueva-reserva");


function abrirModalNuevaReserva() {
    if (!modalNuevaReserva) return;

    modalNuevaReserva.hidden = false;

    fechaLlegadaReserva = "";
fechaSalidaReserva = "";

fechaLlegadaTexto.textContent = "Seleccionar";
fechaSalidaTexto.textContent = "Seleccionar";

continuarFechasReserva.disabled = true;

    renderizarCalendarioNuevaReserva();

    document.body.style.overflow = "hidden";
}


function cerrarModalNuevaReserva() {
    if (!modalNuevaReserva) return;

    modalNuevaReserva.hidden = true;

    document.body.style.overflow = "";
}


if (botonNuevaReserva) {
    botonNuevaReserva.addEventListener(
        "click",
        abrirModalNuevaReserva
    );
}


if (cerrarNuevaReserva) {
    cerrarNuevaReserva.addEventListener(
        "click",
        cerrarModalNuevaReserva
    );
}


if (cancelarNuevaReserva) {
    cancelarNuevaReserva.addEventListener(
        "click",
        cerrarModalNuevaReserva
    );
}


// Cerrar tocando fuera de la tarjeta
if (modalNuevaReserva) {
    modalNuevaReserva.addEventListener("click", evento => {

        if (evento.target === modalNuevaReserva) {
            cerrarModalNuevaReserva();
        }

    });
}

// ========================================
// NUEVA RESERVA · CALENDARIO DE FECHAS
// ========================================

const reservaCalendario =
    document.getElementById("reserva-calendario");

const fechaLlegadaTexto =
    document.getElementById("reserva-fecha-llegada");

const fechaSalidaTexto =
    document.getElementById("reserva-fecha-salida");

const continuarFechasReserva =
    document.getElementById("continuar-fechas-reserva");


let mesReservaBase = new Date();
mesReservaBase.setDate(1);

let fechaLlegadaReserva = "";
let fechaSalidaReserva = "";


function nombreMesReserva(fecha) {
    return fecha.toLocaleDateString("es-CL", {
        month: "long",
        year: "numeric"
    });
}

function sumarDiasNuevaReserva(fechaISO, cantidad) {
    const [anio, mes, dia] =
        fechaISO.split("-").map(Number);

    const fecha =
        new Date(anio, mes - 1, dia);

    fecha.setDate(
        fecha.getDate() + cantidad
    );

    return [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, "0"),
        String(fecha.getDate()).padStart(2, "0")
    ].join("-");
}


function cabanaOcupadaEnNoche(numeroCabana, fechaISO) {

    let ocupada = false;

    Object.entries(datosPorFecha).forEach(
        ([fechaDia, datosDia]) => {

            if (ocupada) return;
            if (!datosDia?.cabanas) return;

            const cabana =
                datosDia.cabanas[numeroCabana];

            if (!cabana) return;


            // BLOQUEO operativo
            if (
                fechaDia === fechaISO &&
                cabana.estado === "bloqueada"
            ) {
                ocupada = true;
                return;
            }


            // No hay reserva real
            if (!cabana.reservaId) return;


            const fechaIngreso =
                cabana.fechaOrigenReserva ||
                cabana.fechaIngresoReserva ||
                fechaDia;

            const noches =
                Number(cabana.noches) || 0;

            if (noches <= 0) return;


            const fechaSalida =
                sumarDiasNuevaReserva(
                    fechaIngreso,
                    noches
                );


            // Una reserva ocupa las NOCHES:
            // ingreso incluido
            // salida excluida
            if (
                fechaISO >= fechaIngreso &&
                fechaISO < fechaSalida
            ) {
                ocupada = true;
            }
        }
    );

    return ocupada;
}


function fechaTieneDisponibilidad(fechaISO) {

    for (
        let numeroCabana = 1;
        numeroCabana <= 11;
        numeroCabana++
    ) {

        const ocupada =
            cabanaOcupadaEnNoche(
                String(numeroCabana),
                fechaISO
            );

        if (!ocupada) {
            return true;
        }
    }

    return false;
}


function crearMesReserva(fechaMes) {

    const contenedorMes = document.createElement("div");
    contenedorMes.className = "reserva-mes";

    const titulo = document.createElement("strong");
    titulo.className = "reserva-mes-titulo";

    const nombreMes = nombreMesReserva(fechaMes);

    titulo.textContent =
        nombreMes.charAt(0).toUpperCase() +
        nombreMes.slice(1);

    contenedorMes.appendChild(titulo);


    const diasSemana = document.createElement("div");
    diasSemana.className = "reserva-dias-semana";

    ["L", "M", "M", "J", "V", "S", "D"].forEach(dia => {

        const span = document.createElement("span");
        span.textContent = dia;

        diasSemana.appendChild(span);
    });

    contenedorMes.appendChild(diasSemana);


    const grilla = document.createElement("div");
    grilla.className = "reserva-mes-grilla";


    const año = fechaMes.getFullYear();
    const mes = fechaMes.getMonth();

    const primerDia = new Date(año, mes, 1);

    // JS: domingo = 0
    // Nosotros: lunes = primera columna
    const desplazamiento =
        (primerDia.getDay() + 6) % 7;


    for (let i = 0; i < desplazamiento; i++) {

        const vacio = document.createElement("span");
        vacio.className = "reserva-dia-vacio";

        grilla.appendChild(vacio);
    }


    const totalDias =
        new Date(año, mes + 1, 0).getDate();


    for (let dia = 1; dia <= totalDias; dia++) {

        const botonDia = document.createElement("button");

        botonDia.type = "button";
        botonDia.className = "reserva-dia";

        botonDia.textContent = dia;

        const fecha =
            `${año}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

botonDia.dataset.fecha = fecha;

const disponible =
    fechaTieneDisponibilidad(fecha);

if (!disponible) {

    botonDia.classList.add("ocupado");
    botonDia.disabled = true;

}

if (!botonDia.disabled) {
    botonDia.addEventListener("click", () => {
        seleccionarFechaNuevaReserva(fecha);
    });
}

grilla.appendChild(botonDia);
    }


    contenedorMes.appendChild(grilla);

    return contenedorMes;
}

function formatearFechaReserva(fechaISO) {
    const [anio, mes, dia] = fechaISO.split("-");

    return `${dia}-${mes}-${anio}`;
}


function obtenerCabanasDisponiblesEnRango(fechaInicio, fechaFin) {

    const disponibles = [];

    for (let numeroCabana = 1; numeroCabana <= 11; numeroCabana++) {

        let disponibleTodoElRango = true;

        let fechaActual = fechaInicio;

        while (fechaActual < fechaFin) {

            if (
                cabanaOcupadaEnNoche(
                    String(numeroCabana),
                    fechaActual
                )
            ) {
                disponibleTodoElRango = false;
                break;
            }

            fechaActual =
                sumarDiasNuevaReserva(
                    fechaActual,
                    1
                );
        }

        if (disponibleTodoElRango) {
            disponibles.push(
                String(numeroCabana)
            );
        }
    }

    return disponibles;
}


function seleccionarFechaNuevaReserva(fecha) {

    // Sin llegada todavía
    if (!fechaLlegadaReserva) {

        fechaLlegadaReserva = fecha;
        fechaSalidaReserva = "";

    }

    // Ya había rango completo → comenzar nuevamente
    else if (fechaLlegadaReserva && fechaSalidaReserva) {

        fechaLlegadaReserva = fecha;
        fechaSalidaReserva = "";

    }

    // Elegir salida
    else {

        // Si toca una fecha anterior o igual,
        // esa fecha pasa a ser la nueva llegada
        if (fecha <= fechaLlegadaReserva) {

            fechaLlegadaReserva = fecha;
            fechaSalidaReserva = "";

        } else {

            const cabanasDisponibles =
                obtenerCabanasDisponiblesEnRango(
                    fechaLlegadaReserva,
                    fecha
                );

            // El rango completo no sirve
            if (cabanasDisponibles.length === 0) {

                alert(
                    "No hay una misma cabaña disponible durante todo ese rango."
                );

                fechaSalidaReserva = "";

            } else {

                fechaSalidaReserva = fecha;
            }
        }
    }

    actualizarSeleccionCalendarioReserva();
}

function actualizarSeleccionCalendarioReserva() {

    const botones =
        reservaCalendario.querySelectorAll(
            ".reserva-dia"
        );


    botones.forEach(boton => {

        boton.classList.remove(
            "seleccionado",
            "en-rango"
        );

        const fecha =
            boton.dataset.fecha;


        if (
            fecha === fechaLlegadaReserva ||
            fecha === fechaSalidaReserva
        ) {
            boton.classList.add(
                "seleccionado"
            );
        }


        if (
            fechaLlegadaReserva &&
            fechaSalidaReserva &&
            fecha > fechaLlegadaReserva &&
            fecha < fechaSalidaReserva
        ) {
            boton.classList.add(
                "en-rango"
            );
        }
    });


    fechaLlegadaTexto.textContent =
        fechaLlegadaReserva
            ? formatearFechaReserva(fechaLlegadaReserva)
            : "Seleccionar";


    fechaSalidaTexto.textContent =
        fechaSalidaReserva
            ? formatearFechaReserva(fechaSalidaReserva)
            : "Seleccionar";


    continuarFechasReserva.disabled =
        !(
            fechaLlegadaReserva &&
            fechaSalidaReserva
        );
}


function renderizarCalendarioNuevaReserva() {

    if (!reservaCalendario) return;

    reservaCalendario.innerHTML = "";


    const meses = document.createElement("div");
    meses.className = "reserva-calendario-meses";


    const primerMes =
        new Date(
            mesReservaBase.getFullYear(),
            mesReservaBase.getMonth(),
            1
        );

    const segundoMes =
        new Date(
            mesReservaBase.getFullYear(),
            mesReservaBase.getMonth() + 1,
            1
        );


    meses.appendChild(
        crearMesReserva(primerMes)
    );

    meses.appendChild(
        crearMesReserva(segundoMes)
    );


    reservaCalendario.appendChild(meses);
}