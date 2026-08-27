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

// Recordar si el CHECK-IN fue marcado manualmente
if (campo === "checkinRealizado") {
    datos.cabanas[numeroCabana].checkinManual = valor;
}

// CONTINÚA solo hereda CHECK-IN si esta reserva
// tuvo un check-in marcado manualmente
if (
    campo === "estado" &&
    valor === "continua"
) {

    const reservaId =
        datos.cabanas[numeroCabana].reservaId;

    const tieneCheckinManual =
        reservaTieneCheckinManual(reservaId);

    datos.cabanas[numeroCabana].checkinRealizado =
        tieneCheckinManual;

    const checkin =
        fila.querySelector(
            '[data-campo="checkinRealizado"]'
        );

    if (checkin) {
        checkin.checked = tieneCheckinManual;
    }
}

// Sincronizar ocupación en todos los días de la misma reserva
const reservaIdActual = datos.cabanas[numeroCabana].reservaId;

if (
    reservaIdActual &&
    ["adultos", "ninos", "mascotas"].includes(campo)
) {
    sincronizarDatosReserva(
        reservaIdActual,
        numeroCabana,
        campo,
        valor
    );
}

// Si una continuidad automática recibe un nuevo titular manualmente,
// pasa a ser una reserva independiente
if (
    campo === "titular" &&
    datos.cabanas[numeroCabana].continuidadAutomatica === true
) {
    datos.cabanas[numeroCabana].reservaId =
        generarReservaId(fechaSeleccionada, numeroCabana);

    datos.cabanas[numeroCabana].continuidadAutomatica = false;
    datos.cabanas[numeroCabana].fechaOrigenReserva = fechaSeleccionada;
}

// Marcar que este día/cabaña fue editado manualmente
datos.cabanas[numeroCabana].editadoManual = true;

// ========================================
// SINCRONIZAR ESTADO FINAL -> REVISIÓN
// ========================================

if (campo === "estadoFinal") {

    let estadoRevision = "pendiente";

    if (valor === "LISTA") {
        estadoRevision = "lista";
    }

    else if (valor === "CON DETALLES") {
        estadoRevision = "con-detalles";
    }

    datos.cabanas[numeroCabana].estadoRevision =
        estadoRevision;
}

guardarDatos();

actualizarResumenDia(fechaSeleccionada);
actualizarTarjetasRevision(fechaSeleccionada);
actualizarResumenAseo(fechaSeleccionada);
generarResumenOperativo(fechaSeleccionada);
}

// ============================================
// COLOR OPERATIVO DE CADA CABAÑA
// ============================================

function reservaTieneCheckinManual(reservaId) {

    if (!reservaId) {
        return false;
    }

    return Object.values(datosPorFecha).some(dia => {

        if (!dia.cabanas) {
            return false;
        }

        return Object.values(dia.cabanas).some(cabana =>

            String(cabana?.reservaId || "") ===
            String(reservaId) &&

            cabana.checkinManual === true

        );

    });
}

function actualizarColorCabana(fila) {

    if (!fila || !fechaSeleccionada) {
        return;
    }

    const numeroCabana = fila.dataset.cabana;
    const datos = obtenerDatosDia(fechaSeleccionada);

    const datosCabana =
        datos.cabanas[numeroCabana] || {};

    // Limpiar estados anteriores
    fila.classList.remove(
    "cabana-checkout",
    "cabana-checkin",
    "cabana-libre",
    "cabana-ingresa",
    "cabana-bloqueada"
);

    // PRIORIDAD 1: CHECK-IN REALIZADO → VERDE
    if (datosCabana.checkinRealizado === true) {
        fila.classList.add("cabana-checkin");
        return;
    }

    // PRIORIDAD 2: CHECK-OUT REALIZADO → AZUL
    if (datosCabana.checkout) {
        fila.classList.add("cabana-checkout");
        return;
    }

    // PRIORIDAD 3: BLOQUEADA → ROJO
if (datosCabana.estado === "bloqueada") {
    fila.classList.add("cabana-bloqueada");
    return;
}

    // PRIORIDAD 4: ESTADOS CON INGRESO → GRIS MÁS OSCURO
if (
    datosCabana.estado === "libre-ingresa" ||
    datosCabana.estado === "sale-ingresa"
) {
    fila.classList.add("cabana-ingresa");
    return;
}

// PRIORIDAD 5: RESTO DE ESTADOS OPERATIVOS → GRIS CLARO
if (
    datosCabana.estado === "libre-libre" ||
    datosCabana.estado === "sale-libre" ||
    datosCabana.estado === "continua" ||
    datosCabana.estado === "fullday"
) {
    fila.classList.add("cabana-libre");
}

}

// ========================================
// ESCUCHAR CAMBIOS
// ========================================

filasCabanas.forEach(fila => {

    const campos = fila.querySelectorAll(".campo-cabana");

    campos.forEach(campo => {

    campo.addEventListener("input", () => {
        guardarCampoCabana(campo);
        actualizarColorCabana(fila);
    });

    campo.addEventListener("change", () => {
        guardarCampoCabana(campo);
        actualizarColorCabana(fila);
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

// CONTINÚA solo aparece con CHECK-IN si
// esta misma reserva tuvo IN manual
if (datosCabana.estado === "continua") {

    const tieneCheckinManual =
        reservaTieneCheckinManual(
            datosCabana.reservaId
        );

    datosCabana.checkinRealizado =
        tieneCheckinManual;
}

    // ========================================
    // SERVICIOS DEL DÍA POR CABAÑA
    // ========================================

    const serviciosRegistradosCabana = JSON.parse(
    localStorage.getItem("haikuServicios")
    ) || [];

    const serviciosCabanaDia =
    serviciosRegistradosCabana.filter(servicio =>
        servicio.fechaServicio === fecha &&
        String(servicio.numeroCabana) === String(numeroCabana)
    );

    const campoServicio =
    fila.querySelector('[data-campo="servicio"]');

    if (campoServicio) {

    campoServicio.value = serviciosCabanaDia
        .map(servicio => {

            const hora = servicio.hora
                ? `${servicio.hora} `
                : "";

            const cortesia =
                servicio.cortesia ||
                servicio.tipoCobro === "cortesia"
                    ? " 🎁"
                    : "";

            return `${hora}${servicio.nombre}${cortesia}`;

        })
        .join(" · ");
}

        const titularCabana = fila.querySelector(
    `[data-titular-cabana="${numeroCabana}"]`
);

if (titularCabana) {
    titularCabana.textContent =
        datosCabana.titular && datosCabana.titular.trim() !== ""
            ? datosCabana.titular
            : "Sin titular";
}

const valorNoches = fila.querySelector(
    `[data-valor-noches="${numeroCabana}"]`
);

if (valorNoches) {
    valorNoches.textContent = datosCabana.noches || "";
}

        const campos =
            fila.querySelectorAll(".campo-cabana");


        campos.forEach(campo => {

            const nombreCampo = campo.dataset.campo;

            if (nombreCampo === "servicio") {
            return;
            }
            const valor = datosCabana[nombreCampo];


            if (campo.type === "checkbox") {

                campo.checked = valor === true;

            } else {

                campo.value = valor || "";

            }

        });

            actualizarColorCabana(fila);

    });

    actualizarResumenDia(fecha);
    actualizarTarjetasRevision(fecha);
    actualizarResumenAseo(fecha);
    generarResumenOperativo(fecha);

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
    estado === "sale-ingresa" ||
    estado === "fullday"
) {
    ingresan++;
}

        // SALEN
if (
    estado === "sale-libre" ||
    estado === "sale-ingresa" ||
    estado === "fullday"
) {
    salen++;
}

        // CONTINÚAN
        if (estado === "continua") {
            continuan++;
        }


    });

    // ========================================
    // SERVICIOS DEL DÍA
    // Lee directamente el módulo Servicios
    // ========================================

    const serviciosRegistradosResumen = JSON.parse(
    localStorage.getItem("haikuServicios")
    ) || [];

    servicios = serviciosRegistradosResumen.filter(servicio =>
    servicio.fechaServicio === fecha
    ).length;

    document.getElementById("contador-ingresan").textContent =
        ingresan;

    document.getElementById("contador-salen").textContent =
        salen;

    document.getElementById("contador-continuan").textContent =
        continuan;

    document.getElementById("contador-servicios").textContent =
        servicios;
}

// ====================================
// RESUMEN OPERATIVO DEL DÍA
// ====================================

function generarResumenOperativo(fecha) {

    if (!fecha) {
        return;
    }

    const datos = obtenerDatosDia(fecha);

    const ingresan = [];
    const salen = [];
    const continuan = [];

    Object.entries(datos.cabanas).forEach(([numeroCabana, cabana]) => {

    const estado = cabana.estado || "";

    if (
    estado === "libre-ingresa" ||
    estado === "sale-ingresa" ||
    estado === "fullday"
) {
    ingresan.push(numeroCabana);
}

if (
    estado === "sale-libre" ||
    estado === "sale-ingresa" ||
    estado === "fullday"
) {
    salen.push(numeroCabana);
}

    if (estado === "continua") {
        continuan.push(numeroCabana);
    }

});

const lineas = [];

const [anio, mes, dia] = fecha.split("-");

const fechaResumen =
    `${dia}.${mes}.${anio.slice(-2)}`;

lineas.push(`RESUMEN DEL DÍA ${fechaResumen}`);

if (ingresan.length > 0) {
    lineas.push("");
    lineas.push("INGRESAN");
    ingresan.forEach(numeroCabana => {

    const cabana = datos.cabanas[numeroCabana] || {};

    const adultos = Number(cabana.adultos) || 0;
    const ninos = Number(cabana.ninos) || 0;
    const mascotas = Number(cabana.mascotas) || 0;

    let detalles = [];

    if (adultos > 0) {
        detalles.push(`${adultos} ADL`);
    }

    if (ninos > 0) {
        detalles.push(`${ninos} KID`);
    }

    if (mascotas > 0) {
        detalles.push(`${mascotas} PET`);
    }

    const esFullDay = cabana.estado === "fullday";
const etiquetaFullDay = esFullDay ? " (FullDay)" : "";

if (detalles.length > 0) {
    lineas.push(`CAB ${numeroCabana} × ${detalles.join(" + ")}${etiquetaFullDay}`);
} else {
    lineas.push(`CAB ${numeroCabana}${etiquetaFullDay}`);
}

});
}

if (salen.length > 0) {
    lineas.push("");
    lineas.push("SALEN");
    salen.forEach(numeroCabana => {
        lineas.push(`CAB ${numeroCabana}`);
    });
}

if (continuan.length > 0) {
    lineas.push("");
    lineas.push("CONTINÚAN");
    continuan.forEach(numeroCabana => {
        lineas.push(`CAB ${numeroCabana}`);
    });
}

// ========================================
// SERVICIOS DEL DÍA
// ========================================

const serviciosRegistradosResumen = JSON.parse(
    localStorage.getItem("haikuServicios")
) || [];

const serviciosDelDia = serviciosRegistradosResumen
    .filter(servicio =>
        servicio.fechaServicio === fecha
    )
    .sort((a, b) =>
        (a.hora || "").localeCompare(b.hora || "")
    );

if (serviciosDelDia.length > 0) {

    lineas.push("");
    lineas.push("SERVICIOS");

    serviciosDelDia.forEach(servicio => {

        const cabana =
            servicio.numeroCabana
                ? `CAB ${servicio.numeroCabana}`
                : "";

        const hora =
            servicio.hora
                ? `${servicio.hora}`
                : "";

        const nombre =
            servicio.nombre || "Servicio";

        const cortesia =
            servicio.cortesia ||
            servicio.tipoCobro === "cortesia"
                ? " 🎁 CORTESÍA"
                : "";

        lineas.push(
            `${cabana} · ${hora} · ${nombre}${cortesia}`
        );
    });
}

// NOTAS DE CABAÑAS
if (
    Array.isArray(datos.notasOperativas) &&
    datos.notasOperativas.length > 0
) {
    lineas.push("");
    lineas.push("NOTAS");

    datos.notasOperativas.forEach(nota => {
        const numeroCabana = nota.cabana;
        const textoNota = nota.texto || nota.nota || "";

        if (textoNota.trim() !== "") {
            lineas.push(`CAB ${numeroCabana} — ${textoNota.trim()}`);
        }
    });
}

// HORARIOS DE INGRESO
const horariosIngreso = [];

Object.entries(datos.cabanas).forEach(([numeroCabana, cabana]) => {
    const horaIngreso = cabana.ingreso || "";

    if (horaIngreso.trim() !== "") {
        horariosIngreso.push({
            cabana: numeroCabana,
            hora: horaIngreso.trim()
        });
    }
});

// Ordenar desde el ingreso más temprano al más tarde
horariosIngreso.sort((a, b) => {
    return a.hora.localeCompare(b.hora);
});

if (horariosIngreso.length > 0) {
    lineas.push("");
    lineas.push("INGRESO");

    horariosIngreso.forEach(item => {
        lineas.push(`CAB ${item.cabana} — ${item.hora}`);
    });
}

// NOTAS IMPORTANTES
const notas = document.getElementById("notas-dia");

if (notas && notas.value.trim() !== "") {
    lineas.push("");
    lineas.push("IMPORTANTE:");
    lineas.push(notas.value.trim());
}

const resumenTexto = document.getElementById("resumen-dia-texto");

if (resumenTexto) {
    resumenTexto.textContent = lineas.join("\n");
}

    console.log("CABANAS RESUMEN:", datos.cabanas);
}

// ========================================
// TARJETAS DE REVISIÓN DE CABAÑAS
// ========================================

function actualizarTarjetasRevision(fecha) {

    if (!fecha) {
        return;
    }

    const datos = obtenerDatosDia(fecha);

    const tarjetas =
        document.querySelectorAll(".cabana-revision");

    tarjetas.forEach(tarjeta => {

        const numeroCabana =
            tarjeta.dataset.revisionCabana;

        const datosCabana =
            datos.cabanas[numeroCabana] || {};

        // -------------------------
// TITULAR DE LA RESERVA
// -------------------------

const titularCabana = tarjeta.querySelector(
    `[data-titular-cabana="${numeroCabana}"]`
);

if (titularCabana) {
    titularCabana.textContent =
        datosCabana.titular && datosCabana.titular.trim() !== ""
            ? datosCabana.titular
            : "Sin titular";
} 


        // ----------------------------
        // HUÉSPEDES
        // ----------------------------

        const huespedes =
            tarjeta.querySelector(".cabana-huespedes");

        if (huespedes) {

            const partes = [];

            if (datosCabana.adultos) {
                partes.push(`${datosCabana.adultos} ADL`);
            }

            if (datosCabana.ninos) {
                partes.push(`${datosCabana.ninos} KID`);
            }

            if (datosCabana.mascotas) {
                partes.push(`${datosCabana.mascotas} PET`);
            }

            huespedes.textContent =
                partes.length > 0
                    ? partes.join(" · ")
                    : "Sin huéspedes registrados";
        }

// -------------------------
// ESTADO OPERATIVO
// -------------------------

const estadoOperativo =
    tarjeta.querySelector(".cabana-estado-operativo");

if (estadoOperativo) {

    const nombresEstadoOperativo = {
        "libre-libre": "L/L",
        "libre-ingresa": "L/IN",
        "sale-libre": "S/L",
        "sale-ingresa": "S/IN",
        "continua": "CONT",
        "bloqueada": "BLQ",
        "fullday": "F/D"
    };

    estadoOperativo.textContent =
        nombresEstadoOperativo[datosCabana.estado] || "";
}

        // -------------------------
// ESTADO DE REVISIÓN
// -------------------------

const estado =
    tarjeta.querySelector(".cabana-estado");

if (estado) {

    const nombresEstadoRevision = {
        "pendiente": "PENDIENTE",
        "con-detalles": "C/DETALLE",
        "lista": "LISTA"
    };

    const estadoRevision =
        datosCabana.estadoRevision || "pendiente";

    estado.textContent =
        nombresEstadoRevision[estadoRevision] || "PENDIENTE";

    estado.dataset.estado = estadoRevision;

    // Color de la tarjeta según estado de revisión
tarjeta.classList.remove(
    "revision-pendiente",
    "revision-con-detalles",
    "revision-lista"
);

tarjeta.classList.add(`revision-${estadoRevision}`);

}

// ---------------------------
// CHECK IN
// ---------------------------

const checkin =
    tarjeta.querySelector(".cabana-in");

if (checkin) {
    checkin.textContent =
        datosCabana.ingreso
            ? `IN ${datosCabana.ingreso}`
            : "";
}


        // ----------------------------
        // CHECK OUT
        // ----------------------------

        const checkout =
            tarjeta.querySelector(".cabana-out");

        if (checkout) {
            checkout.textContent =
                datosCabana.checkout
                    ? `OUT ${datosCabana.checkout}`
                    : "";
        }


        // ----------------------------
        // ASEO
        // ----------------------------

        const aseo =
            tarjeta.querySelector(".cabana-aseo");

        if (aseo) {
            aseo.textContent =
                datosCabana.aseo || "";
        }

        // -------------------------
// NOTA OPERATIVA
// -------------------------

const notaOperativa =
    tarjeta.querySelector(".cabana-nota-operativa");

if (notaOperativa) {

    const notasCabana = datos.notasOperativas.filter(
    nota => String(nota.cabana) === String(numeroCabana)
);

notaOperativa.textContent = notasCabana.length
    ? notasCabana.map(nota => nota.texto).join(" · ")
    : "";
}

    });
}



// ========================================
// ABRIR REVISIÓN INDIVIDUAL
// ========================================

const listaRevisionCabanas =
    document.querySelector(".lista-revision-cabanas");

const revisionIndividual =
    document.getElementById("revision-individual");

const botonVolverCabanas =
    document.getElementById("volver-cabanas");

const revisionTitulo =
    document.getElementById("revision-titulo");

const revisionFecha =
    document.getElementById("revision-fecha");

const revisionSolicitudAseo =
    document.getElementById("revision-solicitud-aseo");    

const revisionInfoOperativa =
    document.getElementById("revision-info-operativa");

const revisionEstado =
    document.getElementById("revision-estado");

const revisionDetalles =
    document.getElementById("revision-detalles");

const revisionNotaOperativa =
    document.getElementById("revision-nota-operativa");

document
    .querySelectorAll(".cabana-revision")
    .forEach(boton => {

        boton.addEventListener("click", () => {

            const numeroCabana =
                boton.dataset.revisionCabana;

            abrirRevisionCabana(numeroCabana);

        });

    });


function abrirRevisionCabana(numeroCabana) {

    // ========================================
    // RECORDAR REVISIÓN ABIERTA
    // ========================================

    localStorage.setItem(
    "haikuRevisionCabana",
    numeroCabana
    );

    if (!fechaSeleccionada) {
        return;
    }

    const datos =
        obtenerDatosDia(fechaSeleccionada);

    const datosCabana =
        datos.cabanas[numeroCabana] || {};

    const solicitudAseo =
    datosCabana.solicitudAseoExpress || "";

if (revisionSolicitudAseo) {

    if (solicitudAseo) {
        revisionSolicitudAseo.textContent = `📌 ${solicitudAseo}`;
        revisionSolicitudAseo.style.display = "";
    } else {
        revisionSolicitudAseo.textContent = "";
        revisionSolicitudAseo.style.display = "none";
    }

}    

    revisionEstado.value =
        datosCabana.estadoRevision || "pendiente";

    revisionDetalles.value =
    datosCabana.detallesRevision || "";

    // ========================================
    // NOTA OPERATIVA DE LA CABAÑA
    // ========================================

const notasCabana =
    (datos.notasOperativas || []).filter(nota => {
        return String(nota.cabana) === String(numeroCabana);
    });

if (notasCabana.length > 0) {

    revisionNotaOperativa.innerHTML = `
        <strong>📝 Nota operativa</strong>
        <span>
            ${notasCabana.map(nota => nota.texto).join(" · ")}
        </span>
    `;

    revisionNotaOperativa.style.display = "";

} else {

    revisionNotaOperativa.innerHTML = "";
    revisionNotaOperativa.style.display = "none";
}


    // Título

    revisionTitulo.textContent =
        `CAB ${numeroCabana}`;

    // ========================================
    // FECHA DE LA REVISIÓN
    // ========================================

    const fechaRevision =
        new Date(`${fechaSeleccionada}T12:00:00`);

    revisionFecha.textContent =
        fechaRevision.toLocaleDateString(
        "es-CL",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );


    // Ocupación

    const adultos =
        Number(datosCabana.adultos) || 0;

    const ninos =
        Number(datosCabana.ninos) || 0;

    const mascotas =
        Number(datosCabana.mascotas) || 0;


    const ocupacion = [];

    if (adultos > 0) {
        ocupacion.push(`${adultos} ADL`);
    }

    if (ninos > 0) {
        ocupacion.push(`${ninos} KID`);
    }

    if (mascotas > 0) {
        ocupacion.push(`${mascotas} PET`);
    }


    // Estado

    const nombresEstado = {
        "libre-libre": "LIBRE / LIBRE",
        "libre-ingresa": "LIBRE / INGRESA",
        "sale-libre": "SALE / LIBRE",
        "sale-ingresa": "SALE / INGRESA",
        "continua": "CONTINÚA",
        "bloqueada": "BLOQUEADA"
    };


    const info = [];

    if (ocupacion.length > 0) {
        info.push(ocupacion.join(" · "));
    }

    if (datosCabana.estado) {

        info.push(
            nombresEstado[datosCabana.estado] ||
            datosCabana.estado
        );

    }

    if (datosCabana.checkout) {
        info.push(`OUT ${datosCabana.checkout}`);
    }

    if (datosCabana.aseo) {
        info.push(`🧹 ${datosCabana.aseo}`);
    }


    revisionInfoOperativa.textContent =
        info.join("   ·   ");

    // Mostrar checklist correspondiente

    mostrarChecklistCabana(numeroCabana);    

    // Ocultar listado

    listaRevisionCabanas.style.display =
        "none";


    // Mostrar revisión

    revisionIndividual.classList.add(
        "activa"
    );

}

// ========================================
// GUARDAR ESTADO DE REVISIÓN
// ========================================

revisionDetalles.addEventListener("input", () => {

    if (!fechaSeleccionada) {
        return;
    }

    const numeroCabana =
        localStorage.getItem("haikuRevisionCabana");

    if (!numeroCabana) {
        return;
    }

    const datos =
        obtenerDatosDia(fechaSeleccionada);

    if (!datos.cabanas[numeroCabana]) {
        datos.cabanas[numeroCabana] = {};
    }

    datos.cabanas[numeroCabana].detallesRevision =
        revisionDetalles.value;

    guardarDatos();
});

revisionEstado.addEventListener("change", () => {

    if (!fechaSeleccionada) {
        return;
    }

    const numeroCabana =
        localStorage.getItem("haikuRevisionCabana");

    if (!numeroCabana) {
        return;
    }

    const datos =
        obtenerDatosDia(fechaSeleccionada);

    if (!datos.cabanas[numeroCabana]) {
        datos.cabanas[numeroCabana] = {};
    }

    datos.cabanas[numeroCabana].estadoRevision =
    revisionEstado.value;

    guardarDatos();

// Sincronizar ESTADO DE REVISIÓN -> ESTADO FINAL del resumen
const filaCabana = document.querySelector(
    `tr[data-cabana="${numeroCabana}"]`
);

if (filaCabana) {

    const selectorResumen = filaCabana.querySelector(
        '[data-campo="estadoFinal"]'
    );

    if (selectorResumen) {

        if (revisionEstado.value === "lista") {
            selectorResumen.value = "LISTA";
        }

        else if (revisionEstado.value === "con-detalles") {
            selectorResumen.value = "CON DETALLES";
        }

        else {
            selectorResumen.value = "";
        }

        // Guardar también estadoFinal
        datos.cabanas[numeroCabana].estadoFinal =
            selectorResumen.value;

        guardarDatos();
    }
}

actualizarTarjetasRevision(fechaSeleccionada);
actualizarResumenAseo(fechaSeleccionada);
});

// ========================================
// VOLVER AL LISTADO DE CABAÑAS
// ========================================

function volverListadoCabanas() {

    // ========================================
    // BORRAR REVISIÓN ABIERTA
    // ========================================

    localStorage.removeItem("haikuRevisionCabana");

    revisionIndividual.classList.remove("activa");

    listaRevisionCabanas.style.display = "";

}


botonVolverCabanas.addEventListener("click", () => {

    volverListadoCabanas();

});

// ========================================
// VOLVER DESDE EL MENÚ LATERAL
// ========================================

const botonMenuCabanas =
    document.querySelector('.menu-item[data-seccion="cabanas"]');


if (botonMenuCabanas) {

    botonMenuCabanas.addEventListener("click", () => {

        volverListadoCabanas();

    });

}

// ========================================
// FICHA RÁPIDA DE RESERVA
// ABRIR / CERRAR MODAL
// ========================================

const fichaReservaModal =
    document.getElementById("ficha-reserva-modal");

const fichaReservaCerrar =
    document.getElementById("ficha-reserva-cerrar");


// ========================================
// FORMATEAR FECHA PARA LA FICHA
// ========================================

function formatearFechaFicha(fecha) {

    if (!fecha) return "—";

    const partes = fecha.split("-");

    if (partes.length !== 3) {
        return fecha;
    }

    const [anio, mes, dia] = partes;

    return `${dia}-${mes}-${anio.slice(-2)}`;
}


// ========================================
// CALCULAR FECHA DE SALIDA
// ========================================

function calcularSalidaReserva(fechaIngreso, noches) {

    if (!fechaIngreso || !noches) {
        return "";
    }

    const [anio, mes, dia] =
        fechaIngreso.split("-").map(Number);

    const fecha =
        new Date(anio, mes - 1, dia);

    fecha.setDate(
        fecha.getDate() + Number(noches)
    );

    const salidaAnio =
        fecha.getFullYear();

    const salidaMes =
        String(fecha.getMonth() + 1).padStart(2, "0");

    const salidaDia =
        String(fecha.getDate()).padStart(2, "0");

    return `${salidaAnio}-${salidaMes}-${salidaDia}`;
}

// ========================================
// SERVICIOS DE LA FICHA POR RESERVA ID
// ========================================

function cargarServiciosFichaReserva(reservaId) {

    const contProgramados =
        document.getElementById(
            "ficha-servicios-programados"
        );

    const contRealizados =
        document.getElementById(
            "ficha-servicios-realizados"
        );

    const contPendientes =
        document.getElementById(
            "ficha-servicios-pendientes"
        );


    const contadorProgramados =
        document.getElementById(
            "ficha-servicios-programados-contador"
        );

    const contadorRealizados =
        document.getElementById(
            "ficha-servicios-realizados-contador"
        );

    const contadorPendientes =
        document.getElementById(
            "ficha-servicios-pendientes-contador"
        );


    if (
        !contProgramados ||
        !contRealizados ||
        !contPendientes
    ) {
        return;
    }


    // Limpiar contenido anterior
    contProgramados.innerHTML = "";
    contRealizados.innerHTML = "";
    contPendientes.innerHTML = "";


    // Si no hay reserva, dejamos todo en cero
    if (!reservaId) {

        contadorProgramados.textContent = "0";
        contadorRealizados.textContent = "0";
        contadorPendientes.textContent = "0";

        return;
    }


    const servicios =
        JSON.parse(
            localStorage.getItem("haikuServicios")
        ) || [];


    // SOLO servicios pertenecientes a esta reserva
    const serviciosReserva =
        servicios.filter(servicio =>
            String(servicio.reservaId || "") ===
            String(reservaId)
        );


    // ====================================
    // CLASIFICAR
    // ====================================

    const programados =
        serviciosReserva.filter(servicio =>
            servicio.estadoServicio !== "realizado"
        );


    const realizados =
        serviciosReserva.filter(servicio =>
            servicio.estadoServicio === "realizado"
        );


    const pendientes =
        serviciosReserva.filter(servicio =>
            servicio.estadoPago === "pendiente" &&
            servicio.tipoCobro !== "cortesia" &&
            servicio.cortesia !== true
        );


    // ====================================
    // CONTADORES
    // ====================================

    contadorProgramados.textContent =
        programados.length;

    contadorRealizados.textContent =
        realizados.length;

    contadorPendientes.textContent =
        pendientes.length;


    // ====================================
    // CREAR FILA DE SERVICIO
    // ====================================

    function crearItemServicio(servicio, mostrarFecha = false) {

    const item =
        document.createElement("div");

    item.className =
        "ficha-servicio-item";


    const izquierda =
        document.createElement("span");


    const fecha =
        mostrarFecha && servicio.fechaServicio
            ? `${formatearFechaFicha(servicio.fechaServicio)} · `
            : "";


    const hora =
        servicio.hora
            ? `${servicio.hora} · `
            : "";


    izquierda.textContent =
        `${fecha}${hora}${servicio.nombre || "Servicio"}`;


    const derecha =
        document.createElement("span");


    if (
        servicio.cortesia === true ||
        servicio.tipoCobro === "cortesia"
    ) {

        derecha.textContent = "🎁";

    } else {

        const total =
            Number(servicio.total) || 0;

        derecha.textContent =
            total > 0
                ? `$${total.toLocaleString("es-CL")}`
                : "";
    }


    item.appendChild(izquierda);
    item.appendChild(derecha);

    return item;
}


    // ====================================
    // MOSTRAR PROGRAMADOS
    // ====================================

    programados
        .sort((a, b) =>
            `${a.fechaServicio || ""} ${a.hora || ""}`
                .localeCompare(
                    `${b.fechaServicio || ""} ${b.hora || ""}`
                )
        )
        .forEach(servicio => {

            contProgramados.appendChild(
    crearItemServicio(servicio, true)
);

        });


    // ====================================
    // MOSTRAR REALIZADOS
    // ====================================

    realizados
        .sort((a, b) =>
            `${a.fechaServicio || ""} ${a.hora || ""}`
                .localeCompare(
                    `${b.fechaServicio || ""} ${b.hora || ""}`
                )
        )
        .forEach(servicio => {

            contRealizados.appendChild(
                crearItemServicio(servicio)
            );

        });


    // ====================================
    // MOSTRAR PENDIENTES DE PAGO
    // ====================================

    pendientes
        .sort((a, b) =>
            `${a.fechaServicio || ""} ${a.hora || ""}`
                .localeCompare(
                    `${b.fechaServicio || ""} ${b.hora || ""}`
                )
        )
        .forEach(servicio => {

            contPendientes.appendChild(
                crearItemServicio(servicio)
            );

        });

}

// ========================================
// PAGOS DE LA FICHA POR RESERVA ID
// ========================================

function buscarDatosReservaPorId(reservaId) {

    if (!reservaId) {
        return null;
    }

    let encontrado = null;

    Object.entries(datosPorFecha).some(([fecha, datosDia]) => {

        if (!datosDia?.cabanas) {
            return false;
        }

        return Object.entries(datosDia.cabanas).some(
            ([numeroCabana, cabana]) => {

                if (
                    String(cabana?.reservaId || "") !==
                    String(reservaId)
                ) {
                    return false;
                }

                // Preferimos el registro original de la reserva,
                // porque ahí están los datos administrativos.
                if (
                    cabana.fechaOrigenReserva === fecha ||
                    cabana.continuidadAutomatica !== true
                ) {

                    encontrado = {
                        fecha,
                        numeroCabana,
                        cabana
                    };

                    return true;
                }

                // Respaldo por si encontramos primero una continuidad
                if (!encontrado) {

                    encontrado = {
                        fecha,
                        numeroCabana,
                        cabana
                    };
                }

                return false;
            }
        );

    });

    return encontrado;
}


function cargarPagosFichaReserva(reservaId) {

    const campoTotal =
        document.getElementById(
            "ficha-pago-total"
        );

    const campoAbono =
        document.getElementById(
            "ficha-pago-abono"
        );

    const campoSaldo =
        document.getElementById(
            "ficha-pago-saldo"
        );

    const campoServicios =
        document.getElementById(
            "ficha-pago-servicios"
        );


    if (
        !campoTotal ||
        !campoAbono ||
        !campoSaldo ||
        !campoServicios
    ) {
        return;
    }


    // ====================================
    // DATOS DE LA RESERVA
    // ====================================

    const registroReserva =
        buscarDatosReservaPorId(reservaId);

    const cabanaReserva =
        registroReserva?.cabana || {};


    const totalReserva =
        Number(cabanaReserva.totalReserva) || 0;

    const abono =
        Number(cabanaReserva.abono) || 0;

    const saldoCalculado =
    Math.max(
        totalReserva - abono,
        0
    );

    const saldo =
    cabanaReserva.checkinCompleto === true
        ? 0
        : saldoCalculado;


    // ====================================
    // SERVICIOS PENDIENTES DE PAGO
    // ====================================

    const servicios =
        JSON.parse(
            localStorage.getItem("haikuServicios")
        ) || [];


    const serviciosPendientes =
        servicios.filter(servicio =>

            String(servicio.reservaId || "") ===
            String(reservaId) &&

            servicio.estadoPago === "pendiente" &&

            servicio.tipoCobro !== "cortesia" &&

            servicio.cortesia !== true
        );


    const totalServiciosPendientes =
        serviciosPendientes.reduce(
            (acumulado, servicio) => {

                return (
                    acumulado +
                    (Number(servicio.total) || 0)
                );

            },
            0
        );


    // ====================================
    // MOSTRAR
    // ====================================

    campoTotal.textContent =
        `$${totalReserva.toLocaleString("es-CL")}`;

    campoAbono.textContent =
        `$${abono.toLocaleString("es-CL")}`;

    campoSaldo.textContent =
        `$${saldo.toLocaleString("es-CL")}`;

    campoServicios.textContent =
        `$${totalServiciosPendientes.toLocaleString("es-CL")}`;

}

// ========================================
// SOLICITUDES DE LA FICHA POR RESERVA ID
// ========================================

function cargarSolicitudesFichaReserva(reservaId) {

    const contenedor =
        document.getElementById(
            "ficha-reserva-solicitudes"
        );

    const contador =
        document.getElementById(
            "ficha-solicitudes-contador"
        );

    if (!contenedor || !contador) {
        return;
    }


    const solicitudes = [];


    Object.entries(datosPorFecha).forEach(
        ([fecha, datosDia]) => {

            if (!datosDia?.cabanas) {
                return;
            }


            Object.entries(datosDia.cabanas).forEach(
                ([numeroCabana, cabana]) => {

                    if (
                        String(cabana?.reservaId || "") !==
                        String(reservaId)
                    ) {
                        return;
                    }


                    const solicitud =
                        String(
                            cabana.solicitudAseoExpress || ""
                        ).trim();


                    if (!solicitud) {
                        return;
                    }


                    solicitudes.push({
                        fecha,
                        texto: solicitud
                    });

                }
            );

        }
    );


    // Evitar repetir exactamente la misma solicitud
    const solicitudesUnicas =
        solicitudes.filter(
            (solicitud, indice, array) =>

                array.findIndex(item =>
                    item.fecha === solicitud.fecha &&
                    item.texto === solicitud.texto
                ) === indice
        );


    contador.textContent =
        `${solicitudesUnicas.length} pendientes`;


    contenedor.innerHTML = "";


    if (solicitudesUnicas.length === 0) {

        contenedor.textContent =
            "Sin solicitudes pendientes.";

        return;
    }


    solicitudesUnicas.forEach(solicitud => {

        const fila =
            document.createElement("div");

        fila.className =
            "ficha-solicitud-item";


        const fecha =
            document.createElement("strong");

        fecha.textContent =
    `${formatearFechaFicha(solicitud.fecha)} ·`;


        const texto =
            document.createElement("span");

        texto.textContent =
            solicitud.texto;


        fila.appendChild(fecha);
        fila.appendChild(texto);

        contenedor.appendChild(fila);

    });

}



// ========================================
// NOTAS DE LA FICHA POR RESERVA ID
// ========================================

function cargarNotasFichaReserva(reservaId) {

    const contenedor =
        document.getElementById(
            "ficha-reserva-notas"
        );

    if (!contenedor) {
        return;
    }


    const notasReserva = [];


    Object.entries(datosPorFecha).forEach(
        ([fecha, datosDia]) => {

            if (
                !datosDia?.cabanas ||
                !Array.isArray(datosDia.notasOperativas)
            ) {
                return;
            }


            Object.entries(datosDia.cabanas).forEach(
                ([numeroCabana, cabana]) => {

                    if (
                        String(cabana?.reservaId || "") !==
                        String(reservaId)
                    ) {
                        return;
                    }


                    datosDia.notasOperativas.forEach(
                        nota => {

                            if (
                                String(nota.cabana) !==
                                String(numeroCabana)
                            ) {
                                return;
                            }


                            const texto =
                                String(
                                    nota.texto ||
                                    nota.nota ||
                                    ""
                                ).trim();


                            if (!texto) {
                                return;
                            }


                            notasReserva.push({
                                fecha,
                                texto
                            });

                        }
                    );

                }
            );

        }
    );


    // Evitar duplicados
    const notasUnicas =
        notasReserva.filter(
            (nota, indice, array) =>

                array.findIndex(item =>
                    item.fecha === nota.fecha &&
                    item.texto === nota.texto
                ) === indice
        );


    contenedor.innerHTML = "";


    if (notasUnicas.length === 0) {

        contenedor.textContent =
            "Sin notas registradas.";

        return;
    }


    notasUnicas.forEach(nota => {

        const fila =
            document.createElement("div");

        fila.className =
            "ficha-nota-item";


        const fecha =
            document.createElement("strong");

        fecha.textContent =
    `${formatearFechaFicha(nota.fecha)} ·`;


        const texto =
            document.createElement("span");

        texto.textContent =
            nota.texto;


        fila.appendChild(fecha);
        fila.appendChild(texto);

        contenedor.appendChild(fila);

    });

}

// ========================================
// BUSCADOR GLOBAL DE RESERVAS
// ========================================

const buscadorReservas =
    document.getElementById("busqueda-reservas");

const resultadosBusquedaReservas =
    document.getElementById(
        "resultados-busqueda-reservas"
    );


// Normaliza texto para que la búsqueda sea más flexible
function normalizarBusqueda(texto) {

    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}


// ========================================
// OBTENER RESERVAS ÚNICAS
// ========================================

function obtenerReservasParaBusqueda() {

    const reservas = new Map();

    const fichas =
        JSON.parse(
            localStorage.getItem("haikuFichaReservas")
        ) || {};


    Object.entries(datosPorFecha).forEach(
        ([fecha, datosDia]) => {

            if (!datosDia?.cabanas) {
                return;
            }

            Object.entries(datosDia.cabanas).forEach(
                ([numeroCabana, cabana]) => {

                    if (!cabana?.reservaId) {
                        return;
                    }


                    const reservaId =
                        String(cabana.reservaId);

                    const ficha =
                        fichas[reservaId] || {};


                    const fechaIngreso =
                        cabana.fechaOrigenReserva ||
                        fecha;


                    // Evitamos repetir la misma reserva
                    if (!reservas.has(reservaId)) {

                        reservas.set(
                            reservaId,
                            {
                                reservaId,
                                numeroCabana,
                                fechaIngreso,

                                titular:
                                    cabana.titular ||
                                    "Sin titular",

                                rut:
                                    ficha.rut ||
                                    cabana.rut ||
                                    "",

                                telefono:
                                    ficha.telefono ||
                                    cabana.telefono ||
                                    "",

                                correo:
                                    ficha.correo ||
                                    cabana.correo ||
                                    cabana.email ||
                                    "",

                                acompanantes: [
                                    ficha.acompanante1,
                                    ficha.acompanante2,
                                    ficha.acompanante3,
                                    ficha.acompanante4,
                                    ficha.acompanante5
                                ]
                                .filter(Boolean)
                                .join(" ")
                            }
                        );
                    }

                }
            );
        }
    );


    return Array.from(
        reservas.values()
    );
}


// ========================================
// MOSTRAR RESULTADOS
// ========================================

function buscarReservas(texto) {

    if (
        !resultadosBusquedaReservas ||
        !buscadorReservas
    ) {
        return;
    }


    const termino =
        normalizarBusqueda(texto);


    resultadosBusquedaReservas.innerHTML = "";


    if (termino.length < 2) {

        resultadosBusquedaReservas.hidden = true;
        return;
    }


    const reservas =
        obtenerReservasParaBusqueda();


    const coincidencias =
        reservas.filter(reserva => {

            const textoBusqueda =
                normalizarBusqueda(
                    [
                        reserva.titular,
                        reserva.reservaId,
                        reserva.rut,
                        reserva.telefono,
                        reserva.correo,
                        reserva.acompanantes
                    ].join(" ")
                );


            return textoBusqueda.includes(
                termino
            );

        });


    if (coincidencias.length === 0) {

        resultadosBusquedaReservas.innerHTML = `
            <div class="busqueda-reserva-vacia">
                Sin reservas encontradas
            </div>
        `;

        resultadosBusquedaReservas.hidden = false;

        return;
    }


    coincidencias
        .slice(0, 8)
        .forEach(reserva => {

            const boton =
                document.createElement("button");

            boton.type = "button";

            boton.className =
                "resultado-reserva-item";

            boton.dataset.reservaId =
                reserva.reservaId;

            boton.dataset.cabana =
                reserva.numeroCabana;

            boton.dataset.fecha =
                reserva.fechaIngreso;


            boton.innerHTML = `
                <strong>
                    ${reserva.titular}
                </strong>

                <span>
                    CAB ${reserva.numeroCabana}
                    ·
                    ${reserva.reservaId}
                </span>

                ${
                    reserva.rut ||
                    reserva.telefono
                        ? `
                        <small>
                            ${reserva.rut || ""}
                            ${
                                reserva.rut &&
                                reserva.telefono
                                    ? " · "
                                    : ""
                            }
                            ${reserva.telefono || ""}
                        </small>
                        `
                        : ""
                }
            `;


            resultadosBusquedaReservas.appendChild(
                boton
            );

        });


    resultadosBusquedaReservas.hidden = false;
}


// ========================================
// ESCRIBIR EN BUSCADOR
// ========================================

if (buscadorReservas) {

    buscadorReservas.addEventListener(
        "input",
        () => {

            buscarReservas(
                buscadorReservas.value
            );

        }
    );
}


// ========================================
// CLICK EN UNA RESERVA ENCONTRADA
// ========================================

if (resultadosBusquedaReservas) {

    resultadosBusquedaReservas.addEventListener(
        "click",
        evento => {

            const resultado =
                evento.target.closest(
                    ".resultado-reserva-item"
                );

            if (!resultado) {
                return;
            }


            const numeroCabana =
                resultado.dataset.cabana;

            const fechaReserva =
                resultado.dataset.fecha;


            const fechaAnterior =
                fechaSeleccionada;


            // El modal actual busca la reserva
            // usando fechaSeleccionada.
            fechaSeleccionada =
                fechaReserva;


            const botonCabana =
                document.querySelector(
                    `[data-ficha-cabana="${numeroCabana}"]`
                );


            if (botonCabana) {

                botonCabana.click();

            }


            // Dejamos al usuario en el día
            // que estaba mirando originalmente.
            fechaSeleccionada =
                fechaAnterior;


            resultadosBusquedaReservas.hidden =
                true;

            buscadorReservas.value = "";

        }
    );
}

// ========================================
// CERRAR BUSCADOR AL HACER CLICK AFUERA
// ========================================

document.addEventListener("click", (evento) => {

    const dentroDelBuscador =
        evento.target.closest(".busqueda-reservas-wrap");

    if (dentroDelBuscador) {
        return;
    }

    if (resultadosBusquedaReservas) {
        resultadosBusquedaReservas.hidden = true;
    }

});

// ========================================
// ABRIR FICHA DE RESERVA
// ========================================

document.addEventListener("click", (evento) => {

    const cabanaBoton =
        evento.target.closest("[data-ficha-cabana]");

    if (!cabanaBoton) return;
    if (!fichaReservaModal) return;
    if (!fechaSeleccionada) return;


    const numeroCabana =
        cabanaBoton.dataset.fichaCabana;


    const datosDia =
        obtenerDatosDia(fechaSeleccionada);


    const cabana =
        datosDia.cabanas[numeroCabana] || {};

        // ====================================
// CANTIDAD AUTOMÁTICA DE ACOMPAÑANTES
// ====================================

const adultos =
    Number(cabana.adultos) || 0;

const ninos =
    Number(cabana.ninos) || 0;

const totalHuespedes =
    adultos + ninos;

const cantidadAcompanantes =
    Math.max(0, totalHuespedes - 1);


document
    .querySelectorAll(".ficha-acompanante-fila")
    .forEach(fila => {

        const numero =
            Number(fila.dataset.acompananteFila);

        if (numero <= cantidadAcompanantes) {

            fila.style.display = "";

        } else {

            fila.style.display = "none";

        }

    });


    // ====================================
    // IDENTIDAD DE LA RESERVA
    // ====================================

    const reservaId =
        cabana.reservaId || "";

    const titular =
        cabana.titular &&
        cabana.titular.trim() !== ""
            ? cabana.titular
            : "Sin titular";

    const noches =
        Number(cabana.noches) || 0;

    const fechaIngreso =
        cabana.fechaOrigenReserva ||
        fechaSeleccionada;

    const fechaSalida =
        calcularSalidaReserva(
            fechaIngreso,
            noches
        );


    // Guardamos temporalmente qué reserva está abierta
    fichaReservaModal.dataset.numeroCabana =
        numeroCabana;

    fichaReservaModal.dataset.reservaId =
        reservaId;


    // ====================================
    // CABECERA
    // ====================================

    const campoCabana =
        document.getElementById(
            "ficha-reserva-cabana"
        );

    const campoTitular =
        document.getElementById(
            "ficha-reserva-titular"
        );

    if (campoCabana) {
        campoCabana.textContent =
            `CAB ${numeroCabana}`;
    }

    if (campoTitular) {
        campoTitular.textContent =
            titular;
    }


    // El acompañante ya aparecerá en HUÉSPEDES,
    // por lo que evitamos duplicarlo arriba.
    const acompananteSuperior =
    document.getElementById(
        "ficha-reserva-acompanante-principal"
    );

if (acompananteSuperior) {

    const fichas =
        obtenerFichasReservas();

    const fichaReserva =
        fichas[reservaId] || {};

    const acompanantePrincipal =
        fichaReserva.acompanante1 || "";

    if (acompanantePrincipal) {

        acompananteSuperior.textContent =
            `Acompañante principal: ${acompanantePrincipal}`;

        acompananteSuperior.hidden = false;

    } else {

        acompananteSuperior.textContent = "";
        acompananteSuperior.hidden = true;

    }
}


    // ====================================
    // DATOS DE ESTANCIA
    // ====================================

    const campoReservaId =
        document.getElementById(
            "ficha-reserva-id"
        );

    const campoIngreso =
        document.getElementById(
            "ficha-reserva-ingreso"
        );

    const campoSalida =
        document.getElementById(
            "ficha-reserva-salida"
        );

    const campoNoches =
        document.getElementById(
            "ficha-reserva-noches"
        );


    if (campoReservaId) {
        campoReservaId.textContent =
            reservaId || "Sin ID";
    }

    if (campoIngreso) {
        campoIngreso.textContent =
            formatearFechaFicha(fechaIngreso);
    }

    if (campoSalida) {
        campoSalida.textContent =
            fechaSalida
                ? formatearFechaFicha(fechaSalida)
                : "—";
    }

    if (campoNoches) {

    const cantidadNoches =
        noches || 0;

    campoNoches.textContent =
        cantidadNoches === 1
            ? `◷ 1 noche`
            : `◷ ${cantidadNoches} noches`;
}


    // ====================================
    // TITULAR EN HUÉSPEDES
    // ====================================

    const huespedTitular =
        document.getElementById(
            "ficha-huesped-titular"
        );

    if (huespedTitular) {
        huespedTitular.textContent =
            titular;
    }


    // ====================================
    // DATOS EDITABLES
    // ====================================

    const fichas =
    obtenerFichasReservas();

    const acompanantes =
    fichas[reservaId] || {};

    for (let i = 1; i <= 5; i++) {

        const campo =
            document.getElementById(
                `ficha-acompanante-${i}`
            );

        if (campo) {
            campo.value =
                acompanantes[`acompanante${i}`] || "";
        }
    }


    const campoRut =
        document.getElementById(
            "ficha-reserva-rut"
        );

    const campoTelefono =
        document.getElementById(
            "ficha-reserva-telefono"
        );


    if (campoRut) {
        campoRut.value =
            acompanantes.rut || "";
    }

    if (campoTelefono) {
        campoTelefono.value =
            acompanantes.telefono || "";
    }

    // ====================================
// ESTADO DE LA RESERVA
// ====================================

const campoEstado =
    document.getElementById(
        "ficha-reserva-estado"
    );

if (campoEstado) {

    let tieneCheckin = false;
    let tieneCheckout = false;

    Object.values(datosPorFecha).forEach(dia => {

        if (!dia?.cabanas) return;

        Object.values(dia.cabanas).forEach(cabanaDia => {

            if (
                String(cabanaDia?.reservaId || "") !==
                String(reservaId)
            ) {
                return;
            }

            if (cabanaDia.checkinRealizado === true) {
                tieneCheckin = true;
            }

            if (cabanaDia.checkout) {
                tieneCheckout = true;
            }

        });

    });

    campoEstado.classList.remove(
        "ficha-estado-hospedado",
        "ficha-estado-checkout",
        "ficha-estado-pendiente"
    );

    if (tieneCheckout) {

        campoEstado.textContent =
            "● Checked Out";

        campoEstado.classList.add(
            "ficha-estado-checkout"
        );

    } else if (tieneCheckin) {

        campoEstado.textContent =
            "● Hospedado";

        campoEstado.classList.add(
            "ficha-estado-hospedado"
        );

    } else {

        campoEstado.textContent =
            "● Pendiente";

        campoEstado.classList.add(
            "ficha-estado-pendiente"
        );

    }
}

    // ====================================
    // SERVICIOS DE LA RESERVA
    // ====================================

    cargarServiciosFichaReserva(reservaId);

    // ====================================
    // PAGOS DE LA RESERVA
    // ====================================
    cargarPagosFichaReserva(reservaId);

    // ====================================
    // SOLICITUDES Y NOTAS
    // ====================================

    cargarSolicitudesFichaReserva(reservaId);
    cargarNotasFichaReserva(reservaId);


    // ====================================
    // MOSTRAR
    // ====================================

    fichaReservaModal.hidden = false;

});

// ========================================
// GUARDAR DATOS EDITABLES DE LA FICHA
// ========================================

function obtenerFichasReservas() {

    return JSON.parse(
        localStorage.getItem("haikuFichaReservas")
    ) || {};

}


function guardarFichasReservas(fichas) {

    localStorage.setItem(
        "haikuFichaReservas",
        JSON.stringify(fichas)
    );

}


function guardarDatosEditablesFicha() {

    if (!fichaReservaModal) return;

    const reservaId =
        fichaReservaModal.dataset.reservaId;

    if (!reservaId) return;


    const fichas =
        obtenerFichasReservas();


    if (!fichas[reservaId]) {
        fichas[reservaId] = {};
    }


    const ficha =
        fichas[reservaId];


    for (let i = 1; i <= 5; i++) {

        const campo =
            document.getElementById(
                `ficha-acompanante-${i}`
            );

        ficha[`acompanante${i}`] =
            campo
                ? campo.value.trim()
                : "";
    }


    const campoRut =
        document.getElementById(
            "ficha-reserva-rut"
        );

    const campoTelefono =
        document.getElementById(
            "ficha-reserva-telefono"
        );


    ficha.rut =
        campoRut
            ? campoRut.value.trim()
            : "";

    ficha.telefono =
        campoTelefono
            ? campoTelefono.value.trim()
            : "";


    guardarFichasReservas(fichas);

}

document.addEventListener("change", (evento) => {

    if (
        !evento.target.closest(
            ".ficha-dato-editable"
        )
    ) {
        return;
    }

    guardarDatosEditablesFicha();

});


// CERRAR CON X
if (fichaReservaCerrar) {

    fichaReservaCerrar.addEventListener("click", () => {

        fichaReservaModal.hidden = true;

    });

}


// CERRAR TOCANDO EL FONDO OSCURO
if (fichaReservaModal) {

    fichaReservaModal.addEventListener("click", (evento) => {

        if (evento.target !== fichaReservaModal) return;

        fichaReservaModal.hidden = true;

    });

}

// ========================================
// MODAL SERVICIO DESDE RESUMEN
// ========================================

// ========================================
// ELEMENTOS MODAL SERVICIOS RESUMEN
// ========================================

const campoProducto =
    document.getElementById("resumen-servicio-producto");

const campoCantidad =
    document.getElementById("resumen-servicio-cantidad");

const campoFecha =
    document.getElementById("resumen-servicio-fecha");

const campoHora =
    document.getElementById("resumen-servicio-hora");

const bloqueProgramacion =
    document.getElementById("resumen-servicio-programacion");

const textoTotal =
    document.getElementById("resumen-servicio-total");

const bloquePrecioManual =
    document.getElementById("resumen-servicio-precio-manual-wrap");

const campoPrecioManual =
    document.getElementById("resumen-servicio-precio-manual");

document.addEventListener("click", (e) => {

    const boton =
        e.target.closest("[data-agregar-servicio]");

    if (!boton) return;

    const numeroCabana =
        boton.dataset.agregarServicio;

    const modal =
        document.getElementById("resumen-servicio-modal");

    const titulo =
        document.getElementById("resumen-servicio-titulo");

    const campoCabana =
        document.getElementById("resumen-servicio-cabana");

    
    if (!modal) return;

    // CAB correspondiente
    if (campoCabana) {
        campoCabana.value = `Cabaña ${numeroCabana}`;
        campoCabana.dataset.numeroCabana = numeroCabana;
    }

    // Título
    if (titulo) {
        titulo.textContent =
            `Agregar servicio · CAB ${numeroCabana}`;
    }

    // Valores iniciales
    if (campoCantidad) {
        campoCantidad.value = 1;
    }

    // Cargar catálogo real de Servicios
if (campoProducto) {

    campoProducto.innerHTML =
        '<option value="">Seleccionar servicio</option>';

    Object.entries(CATALOGO_SERVICIOS).forEach(
        ([idServicio, servicio]) => {

            const option =
                document.createElement("option");

            option.value = idServicio;
            option.textContent = servicio.nombre;

            campoProducto.appendChild(option);
        }
    );
}

    if (campoFecha) {
        campoFecha.value = fechaSeleccionada;
    }

    // Abrir modal
    modal.hidden = false;

});

function actualizarModalServicioResumen() {

    const idServicio = campoProducto.value;
    const cantidad = Number(campoCantidad.value) || 1;

    const servicio = CATALOGO_SERVICIOS[idServicio];

    if (!servicio) {
        textoTotal.textContent = "$0";
        bloqueProgramacion.hidden = true;
        return;
    }

    // PRECIO
    // ========================================
// PRECIO
// ========================================

const esJacuzzi =
    idServicio === "tinajaJacuzzi";

bloquePrecioManual.hidden = !esJacuzzi;

let precioUnitario = servicio.precio || 0;

if (esJacuzzi) {

    // Si todavía no hay precio manual, usar precio base
    if (!campoPrecioManual.value) {
        campoPrecioManual.value = precioUnitario;
    }

    precioUnitario =
        Number(campoPrecioManual.value) || 0;

} else {

    campoPrecioManual.value = "";

}

const total =
    precioUnitario * cantidad;

textoTotal.textContent =
    `$${total.toLocaleString("es-CL")}`;


    // FECHA Y HORA
    const requiereProgramacion =
        servicio.categoria === "tinaja" ||
        servicio.categoria === "masaje" ||
        servicio.categoria === "checkout";

    bloqueProgramacion.hidden = !requiereProgramacion;

    if (requiereProgramacion) {

        if (!campoFecha.value) {
            campoFecha.value = fechaSeleccionada;
        }

    } else {

        campoFecha.value = "";
        campoHora.value = "";

    }
}

campoProducto.addEventListener(
    "change",
    actualizarModalServicioResumen
);

campoCantidad.addEventListener(
    "input",
    actualizarModalServicioResumen
);

campoPrecioManual.addEventListener(
    "input",
    actualizarModalServicioResumen
);

// ========================================
// GUARDAR SERVICIO DESDE RESUMEN
// ========================================

const btnGuardarServicioResumen =
    document.getElementById("resumen-servicio-guardar");

if (btnGuardarServicioResumen) {

    btnGuardarServicioResumen.addEventListener("click", () => {

        const campoCabana =
            document.getElementById("resumen-servicio-cabana");

        const numeroCabana =
            campoCabana?.dataset.numeroCabana;

        const idServicio =
            campoProducto.value;

        const cantidad =
            Number(campoCantidad.value) || 1;

        const tipoCobro =
            document.querySelector(
                'input[name="resumen-servicio-tipo-cobro"]:checked'
            )?.value || "normal";

        const servicio =
            CATALOGO_SERVICIOS[idServicio];

        if (!numeroCabana || !idServicio || !servicio) {
            alert("Selecciona un servicio.");
            return;
        }

        const requiereProgramacion =
            servicio.categoria === "tinaja" ||
            servicio.categoria === "masaje" ||
            servicio.categoria === "checkout";

        const fechaServicio =
            requiereProgramacion
                ? campoFecha.value
                : "";

        const horaServicio =
            requiereProgramacion
                ? campoHora.value
                : "";

        if (
            requiereProgramacion &&
            (!fechaServicio || !horaServicio)
        ) {
            alert("Selecciona fecha y hora.");
            return;
        }

        // Datos actuales de la cabaña
        const datosDia =
            obtenerDatosDia(fechaSeleccionada);

        const datosCabana =
            datosDia.cabanas[numeroCabana] || {};

        // Registrar usando EL MISMO sistema de Servicios
        const nuevoServicio = registrarServicio({

            fecha: fechaSeleccionada,

            numeroCabana: numeroCabana,

            reservaId:
                datosCabana.reservaId || "",

            titular:
                datosCabana.titular || "",

            tipoServicio:
                idServicio,

            cantidad:
                cantidad,

            personas:
                cantidad,

            tipoCobro:
                tipoCobro,

            fechaServicio:
                fechaServicio,

            hora:
                horaServicio

        });

        if (!nuevoServicio) return;

        console.log(
            "SERVICIO GUARDADO DESDE RESUMEN:",
            nuevoServicio
        );

        // Actualizar Resumen
        cargarCabanasDia(fechaSeleccionada);
        actualizarResumenDia(fechaSeleccionada);
        generarResumenOperativo(fechaSeleccionada);

        // Cerrar modal
        cerrarModalServicioResumen();

    });

}

// ========================================
// CERRAR MODAL SERVICIO
// ========================================

function cerrarModalServicioResumen() {

    const modal =
        document.getElementById("resumen-servicio-modal");

    if (modal) {
        modal.hidden = true;
    }
}


const btnCerrarServicioResumen =
    document.getElementById("resumen-servicio-cerrar");

const btnCancelarServicioResumen =
    document.getElementById("resumen-servicio-cancelar");


if (btnCerrarServicioResumen) {

    btnCerrarServicioResumen.addEventListener(
        "click",
        cerrarModalServicioResumen
    );

}


if (btnCancelarServicioResumen) {

    btnCancelarServicioResumen.addEventListener(
        "click",
        cerrarModalServicioResumen
    );

}

// ========================================
// RESTAURAR REVISIÓN ABIERTA AL RECARGAR
// ========================================

const revisionCabanaGuardada =
    localStorage.getItem("haikuRevisionCabana");

if (revisionCabanaGuardada) {

    abrirRevisionCabana(
        revisionCabanaGuardada
    );

}

// ========================================
// RESUMEN DE ASEO
// ========================================

function actualizarResumenAseo(fecha) {

    const contenedor =
        document.getElementById("aseo-resumen");

    if (!contenedor || !fecha) {
        return;
    }

    const datos = obtenerDatosDia(fecha);

    contenedor.innerHTML = "";

    for (let numeroCabana = 1; numeroCabana <= 11; numeroCabana++) {

        const cabana =
            datos.cabanas[numeroCabana] || {};

        const solicitudAseo =
              cabana.solicitudAseoExpress || "";

        console.log(
    "CAB",
    numeroCabana,
    "SOLICITUD:",
    cabana.solicitudAseoExpress
);      

        const encargado =
            cabana.aseo || "Sin asignar";

        const horaIn =
            cabana.aseoIn || "--:--";

        const horaOut =
            cabana.aseoOut || "--:--";

        const notasCabana = datos.notasOperativas.filter(
    nota => String(nota.cabana) === String(numeroCabana)
);

const notaAseo = notasCabana.length
    ? notasCabana.map(nota => nota.texto).join(" · ")
    : "";
        
        const estadoFinal =
              cabana.estadoRevision === "lista"
            ? "LISTA"
            : cabana.estadoRevision === "con-detalles"
            ? "CON DETALLES"
            : "Pendiente";

        let claseEstado = "aseo-pendiente";

        if (estadoFinal === "LISTA") {
            claseEstado = "aseo-lista";
        }

        if (estadoFinal === "CON DETALLES") {
            claseEstado = "aseo-detalles";
        }

        const tarjeta =
            document.createElement("div");

        tarjeta.className =
            `aseo-resumen-cabana ${claseEstado}`;

            const nombreHuesped =
  cabana.titular ||
  cabana.nombre ||
  cabana.huesped ||
  "";

        tarjeta.innerHTML = `
            <div class="aseo-resumen-cabecera">

            <div class="aseo-resumen-numero">
            CAB ${numeroCabana}${nombreHuesped ? ` · ${nombreHuesped}` : ""}
            </div>

            <select
    class="aseo-estado aseo-estado-select"
    data-estado-revision="${numeroCabana}"
>
    <option value="pendiente"
        ${cabana.estadoRevision === "pendiente" || !cabana.estadoRevision ? "selected" : ""}>
        Pendiente
    </option>

    <option value="con-detalles"
        ${cabana.estadoRevision === "con-detalles" ? "selected" : ""}>
        Con detalles
    </option>

    <option value="lista"
        ${cabana.estadoRevision === "lista" ? "selected" : ""}>
        Lista
    </option>
</select>

</div>

            <div class="aseo-resumen-datos">

                <div class="aseo-resumen-personal">

    <div class="aseo-resumen-encargado">
    <span>Encargado</span>

    <input
        type="text"
        class="aseo-encargado-input"
        data-aseo-encargado="${numeroCabana}"
        placeholder="Sin asignar"
        value="${cabana.aseo || ""}"
    >
</div>

    <div class="aseo-resumen-revision">
        <span>Revisión</span>
        <input
    type="text"
    class="aseo-revision-input"
    data-revision-cabana="${numeroCabana}"
    placeholder="Nombre"
    value="${cabana.revisionAseo || ""}"
>
    </div>

</div>

                <div class="aseo-resumen-horario">
    <div>
        <span>IN</span>
        <input
            type="time"
            class="aseo-hora-input"
            data-aseo-hora="aseoIn"
            data-cabana="${numeroCabana}"
            value="${cabana.aseoIn || ""}"
        >
    </div>

    <div>
        <span>OUT</span>
        <input
            type="time"
            class="aseo-hora-input"
            data-aseo-hora="aseoOut"
            data-cabana="${numeroCabana}"
            value="${cabana.aseoOut || ""}"
        >
    </div>
</div>

${notaAseo ? `
    <div class="aseo-resumen-nota">
        📝 ${notaAseo}
    </div>
` : ""}

${solicitudAseo ? `
    <div class="aseo-resumen-solicita">
        <span>📌 ${solicitudAseo}</span>

        <button
            type="button"
            class="aseo-solicita-eliminar"
            data-eliminar-solicita="${numeroCabana}"
            aria-label="Eliminar solicitud"
        >
            ×
        </button>
    </div>
` : ""}

            </div>
        `;

        tarjeta.dataset.aseoExpressCabana = numeroCabana;

        contenedor.appendChild(tarjeta);
    }

    document.querySelectorAll(".aseo-revision-input").forEach(input => {

    input.addEventListener("input", () => {

        const numeroCabana = input.dataset.revisionCabana;

        const datos = obtenerDatosDia(fecha);

        if (!datos.cabanas[numeroCabana]) {
            datos.cabanas[numeroCabana] = {};
        }

        datos.cabanas[numeroCabana].revisionAseo = input.value;

        guardarDatos();

    });

});

// ======================================
// CAMBIAR ENCARGADO DESDE ASEO
// ======================================

document.querySelectorAll(".aseo-encargado-input").forEach(input => {

    input.addEventListener("change", () => {

        const numeroCabana = input.dataset.aseoEncargado;
        const datos = obtenerDatosDia(fecha);

        if (!datos.cabanas[numeroCabana]) {
            datos.cabanas[numeroCabana] = {};
        }

        // Guardar encargado
        datos.cabanas[numeroCabana].aseo = input.value.trim();

        guardarDatos();

        // Refrescar Estado de cabañas
        cargarCabanasDia(fecha);
    });

});

// ELIMINAR SOLICITUD DE ASEO
document.querySelectorAll(".aseo-solicita-eliminar").forEach(boton => {

    boton.addEventListener("click", (evento) => {
        evento.stopPropagation();

        const numeroCabana = boton.dataset.eliminarSolicita;
        const datos = obtenerDatosDia(fecha);

        if (!datos.cabanas[numeroCabana]) {
            return;
        }

        // Borrar solicitud
        datos.cabanas[numeroCabana].solicitudAseoExpress = "";

        // Guardar cambio
        guardarDatos();

        // Actualizar las tarjetas inmediatamente
        actualizarResumenAseo(fecha);
    });

});

}

// ========================================
// ABRIR REVISIÓN ASEO EXPRESS
// ========================================

document.addEventListener("click", (evento) => {

    const tarjeta = evento.target.closest(
        "[data-aseo-express-cabana]"
    );

    if (!tarjeta || !fechaSeleccionada) {
        return;
    }

    // No abrir la revisión si estamos usando
    // un select, input o botón de la tarjeta
    if (evento.target.closest("select, input, button")) {
        return;
    }

    const numeroCabana =
        tarjeta.dataset.aseoExpressCabana;

    abrirRevisionAseoExpress(numeroCabana);

});

function abrirRevisionAseoExpress(numeroCabana) {

    const panelAseo =
        document.querySelector("#seccion-aseo .aseo-panel");

    const revisionExpress =
        document.getElementById("aseo-express-individual");

    const titulo =
        document.getElementById("aseo-express-titulo");

    const fecha =
        document.getElementById("aseo-express-fecha");

    if (
        !panelAseo ||
        !revisionExpress ||
        !titulo ||
        !fecha
    ) {
        return;
    }

    titulo.textContent = `CAB ${numeroCabana}`;

    const fechaRevision =
        new Date(`${fechaSeleccionada}T12:00:00`);

    fecha.textContent =
        fechaRevision.toLocaleDateString(
            "es-CL",
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

    localStorage.setItem(
        "haikuAseoExpressCabana",
        numeroCabana
    );

        // ========================================
    // CARGAR CHECKLIST ASEO EXPRESS
    // ========================================

    const datos =
        obtenerDatosDia(fechaSeleccionada);

    const datosCabana =
        datos.cabanas[numeroCabana] || {};

    const solicitudAseoExpress =
    document.getElementById("aseo-express-solicitud");

if (solicitudAseoExpress) {

    const solicitud =
        datosCabana.solicitudAseoExpress || "";

    if (solicitud) {
        solicitudAseoExpress.textContent =
            `📌 ${solicitud}`;

        solicitudAseoExpress.style.display = "";
    } else {
        solicitudAseoExpress.textContent = "";
        solicitudAseoExpress.style.display = "none";
    }
}    

    const checklistExpress =
        datosCabana.checklistAseoExpress || {};

    document
        .querySelectorAll("[data-aseo-express-item]")
        .forEach(check => {

            const item =
                check.dataset.aseoExpressItem;

            check.checked =
                checklistExpress[item] === true;

        });

            // ========================================
    // CARGAR DETALLES Y ESTADO
    // ========================================

    const detallesExpress =
        document.getElementById("aseo-express-detalles");

    const estadoExpress =
        document.getElementById("aseo-express-estado");

    if (detallesExpress) {
        detallesExpress.value =
            datosCabana.detallesAseoExpress || "";
    }

    if (estadoExpress) {
        estadoExpress.value =
            datosCabana.estadoRevision || "pendiente";
    }

    panelAseo.style.display = "none";

    revisionExpress.classList.add("activa");

}

// ========================================
// GUARDAR CHECKLIST ASEO EXPRESS
// ========================================

document.addEventListener("change", (evento) => {

    const check =
        evento.target.closest("[data-aseo-express-item]");

    if (!check || !fechaSeleccionada) {
        return;
    }

    const numeroCabana =
        localStorage.getItem("haikuAseoExpressCabana");

    if (!numeroCabana) {
        return;
    }

    const datos =
        obtenerDatosDia(fechaSeleccionada);

    if (!datos.cabanas[numeroCabana]) {
        datos.cabanas[numeroCabana] = {};
    }

    if (!datos.cabanas[numeroCabana].checklistAseoExpress) {
        datos.cabanas[numeroCabana].checklistAseoExpress = {};
    }

    const item =
        check.dataset.aseoExpressItem;

    datos.cabanas[numeroCabana]
        .checklistAseoExpress[item] =
        check.checked;

    guardarDatos();

});

const botonVolverAseo =
    document.getElementById("volver-aseo");

if (botonVolverAseo) {

    botonVolverAseo.addEventListener("click", () => {

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

    });

}

// ========================================
// GUARDAR DETALLES ASEO EXPRESS
// ========================================

const detallesAseoExpress =
    document.getElementById("aseo-express-detalles");

if (detallesAseoExpress) {

    detallesAseoExpress.addEventListener("input", () => {

        if (!fechaSeleccionada) {
            return;
        }

        const numeroCabana =
            localStorage.getItem("haikuAseoExpressCabana");

        if (!numeroCabana) {
            return;
        }

        const datos =
            obtenerDatosDia(fechaSeleccionada);

        if (!datos.cabanas[numeroCabana]) {
            datos.cabanas[numeroCabana] = {};
        }

        datos.cabanas[numeroCabana].detallesAseoExpress =
            detallesAseoExpress.value;

        guardarDatos();

    });

}

// ========================================
// CAMBIAR ESTADO DESDE REVISIÓN ASEO EXPRESS
// ========================================

const estadoAseoExpress =
    document.getElementById("aseo-express-estado");

if (estadoAseoExpress) {

    estadoAseoExpress.addEventListener("change", () => {

        if (!fechaSeleccionada) {
            return;
        }

        const numeroCabana =
            localStorage.getItem("haikuAseoExpressCabana");

        if (!numeroCabana) {
            return;
        }

        const datos =
            obtenerDatosDia(fechaSeleccionada);

        if (!datos.cabanas[numeroCabana]) {
            datos.cabanas[numeroCabana] = {};
        }

        // Estado compartido
        datos.cabanas[numeroCabana].estadoRevision =
            estadoAseoExpress.value;

        // Sincronizar Estado Final
        if (estadoAseoExpress.value === "lista") {

            datos.cabanas[numeroCabana].estadoFinal =
                "LISTA";

        } else if (
            estadoAseoExpress.value === "con-detalles"
        ) {

            datos.cabanas[numeroCabana].estadoFinal =
                "CON DETALLES";

        } else {

            datos.cabanas[numeroCabana].estadoFinal = "";

        }

        guardarDatos();

        // Actualizar todas las vistas conectadas
        cargarCabanasDia(fechaSeleccionada);

        // Mantener sincronizado el selector
        // de la revisión normal de Cabañas
        if (revisionEstado) {
            revisionEstado.value =
                estadoAseoExpress.value;
        }

    });

}

// ========================================
// MODAL SOLICITA - ASEO EXPRESS
// ========================================

const botonAgregarSolicita =
    document.getElementById("agregar-solicita");

const panelAgregarSolicita =
    document.getElementById("panel-agregar-solicita");

const botonCerrarSolicita =
    document.getElementById("cerrar-solicita");

const botonCancelarSolicita =
    document.getElementById("cancelar-solicita");


// ABRIR MODAL
if (botonAgregarSolicita && panelAgregarSolicita) {

    botonAgregarSolicita.addEventListener("click", () => {

        panelAgregarSolicita.classList.add("activo");

    });

}


// CERRAR CON X
if (botonCerrarSolicita && panelAgregarSolicita) {

    botonCerrarSolicita.addEventListener("click", () => {

        panelAgregarSolicita.classList.remove("activo");

    });

}


// CERRAR CON CANCELAR
if (botonCancelarSolicita && panelAgregarSolicita) {

    botonCancelarSolicita.addEventListener("click", () => {

        panelAgregarSolicita.classList.remove("activo");

    });

}

// ========================================
// GUARDAR SOLICITA - ASEO EXPRESS
// ========================================

const botonGuardarSolicita =
    document.getElementById("guardar-solicita");

const selectCabanaSolicita =
    document.getElementById("solicita-cabana");

const textoSolicita =
    document.getElementById("solicita-texto");

if (
    botonGuardarSolicita &&
    selectCabanaSolicita &&
    textoSolicita
) {

    botonGuardarSolicita.addEventListener("click", () => {

        if (!fechaSeleccionada) {
            return;
        }

        const numeroCabana = selectCabanaSolicita.value;
        const solicitud = textoSolicita.value.trim();

        if (!numeroCabana || !solicitud) {
            return;
        }

        const datos = obtenerDatosDia(fechaSeleccionada);

        if (!datos.cabanas[numeroCabana]) {
            datos.cabanas[numeroCabana] = {};
        }

        // Guardamos la solicitud dentro de ESA fecha y ESA cabaña
        datos.cabanas[numeroCabana].solicitudAseoExpress = solicitud;

        guardarDatos();

        // Limpiar campo
        textoSolicita.value = "";

        // Cerrar modal
        panelAgregarSolicita.classList.remove("activo");

        // Actualizar Aseo
        actualizarResumenAseo(fechaSeleccionada);

        const reservaIdAbierta =
        fichaReservaModal?.dataset.reservaId || "";

        if (reservaIdAbierta) {
        cargarSolicitudesFichaReserva(reservaIdAbierta);
        }

    });

}

// ========================================
// CAMBIAR ESTADO DESDE ASEO
// ========================================

document.addEventListener("change", (evento) => {

    const selector = evento.target.closest("[data-estado-revision]");

    if (!selector || !fechaSeleccionada) {
        return;
    }

    const numeroCabana = selector.dataset.estadoRevision;
    const datos = obtenerDatosDia(fechaSeleccionada);

    if (!datos.cabanas[numeroCabana]) {
        datos.cabanas[numeroCabana] = {};
    }

    // Guardar estado para Revisión
datos.cabanas[numeroCabana].estadoRevision = selector.value;

// Convertir el estado de Aseo al formato que usa Resumen
let estadoFinalResumen = "";

if (selector.value === "lista") {
    estadoFinalResumen = "LISTA";
} else if (selector.value === "con-detalles") {
    estadoFinalResumen = "CON DETALLES";
}

// Guardar estado para Resumen
datos.cabanas[numeroCabana].estadoFinal = estadoFinalResumen;

    guardarDatos();

// Actualizar tabla Estado de cabañas
cargarCabanasDia(fechaSeleccionada);

// Actualizar las demás vistas
actualizarResumenDia(fechaSeleccionada);
actualizarResumenAseo(fechaSeleccionada);
actualizarTarjetasRevision(fechaSeleccionada);

    // Si está abierta esa misma cabaña, actualizar su selector
    const cabanaAbierta = localStorage.getItem("haikuRevisionCabana");

    if (
        cabanaAbierta === String(numeroCabana) &&
        revisionEstado
    ) {
        revisionEstado.value = selector.value;
    }

});

// ========================================
// CAMBIAR HORARIOS IN / OUT DESDE ASEO
// ========================================

document.addEventListener("change", (evento) => {

    const inputHora = evento.target.closest(".aseo-hora-input");

    if (!inputHora || !fechaSeleccionada) {
        return;
    }

    const numeroCabana = inputHora.dataset.cabana;
    const campoHora = inputHora.dataset.aseoHora;

    const datos = obtenerDatosDia(fechaSeleccionada);

    if (!datos.cabanas[numeroCabana]) {
        datos.cabanas[numeroCabana] = {};
    }

    // Guardar en el mismo campo que utiliza Resumen
    datos.cabanas[numeroCabana][campoHora] = inputHora.value;

    guardarDatos();

    // Actualizar Resumen y Aseo
    cargarCabanasDia(fechaSeleccionada);
    actualizarResumenAseo(fechaSeleccionada);
});

// ========================================
// ESTADOS COMPACTOS EN CELULAR
// ========================================

const nombresEstadoDesktop = {
    "libre-libre": "LIBRE / LIBRE",
    "libre-ingresa": "LIBRE / INGRESA",
    "sale-libre": "SALE / LIBRE",
    "sale-ingresa": "SALE / INGRESA",
    "continua": "CONTINÚA",
    "bloqueada": "BLOQUEADA",
    "fullday": "FULLDAY"
};

const nombresEstadoMovil = {
    "libre-libre": "L/L",
    "libre-ingresa": "L/IN",
    "sale-libre": "S/L",
    "sale-ingresa": "S/IN",
    "continua": "CONT",
    "bloqueada": "BLQ",
    "fullday": "F/D"
};


function actualizarNombresEstadosResponsive() {

    const esMovil = window.innerWidth <= 768;

    document
        .querySelectorAll('[data-campo="estado"]')
        .forEach(selector => {

            Array.from(selector.options).forEach(opcion => {

                const valor = opcion.value;

                if (esMovil && nombresEstadoMovil[valor]) {

                    opcion.textContent =
                        nombresEstadoMovil[valor];

                } else if (
                    !esMovil &&
                    nombresEstadoDesktop[valor]
                ) {

                    opcion.textContent =
                        nombresEstadoDesktop[valor];
                }

            });

        });
}


// Ejecutar al cargar
actualizarNombresEstadosResponsive();


// Actualizar si cambia el tamaño de pantalla
window.addEventListener(
    "resize",
    actualizarNombresEstadosResponsive
);

// ==========================================
// EDITAR TITULAR DE RESERVA
// ==========================================

document.addEventListener("click", (evento) => {

    const boton = evento.target.closest(".editar-titular");

    if (!boton) {
        return;
    }

    const numeroCabana = boton.dataset.editarTitular;

    const titular = document.querySelector(
        `[data-titular-cabana="${numeroCabana}"]`
    );

    if (!titular) {
        return;
    }

    const nombreActual =
        titular.textContent.trim() === "Sin titular"
            ? ""
            : titular.textContent.trim();

    const nuevoNombre = prompt(
        `Titular CAB ${numeroCabana}:`,
        nombreActual
    );

    // Si presiona Cancelar, no hacemos nada
    if (nuevoNombre === null) {
        return;
    }

    const nombreFinal = nuevoNombre.trim();

    titular.textContent =
        nombreFinal || "Sin titular";

        const datos = obtenerDatosDia(fechaSeleccionada);

if (!datos.cabanas[numeroCabana]) {
    datos.cabanas[numeroCabana] = {};
}

const cabanaActual = datos.cabanas[numeroCabana];

// Si este día estaba vacío manualmente y ahora recibe un nuevo titular,
// dejamos que vuelva a participar normalmente en el autocompletado.
if (
    nombreFinal !== "" &&
    cabanaActual.borradoManual === true
) {
    cabanaActual.borradoManual = false;
}

// Si borramos manualmente el titular,
// este espacio deja de pertenecer a la reserva anterior.
if (nombreFinal === "") {
    cabanaActual.borradoManual = true;
    cabanaActual.reservaId = "";
    cabanaActual.continuidadAutomatica = false;
    cabanaActual.fechaOrigenReserva = "";
    cabanaActual.noches = "";
}

// Si este día venía de una continuidad automática
// y cambiamos manualmente el titular,
// desde aquí comienza una reserva nueva e independiente.
if (
    cabanaActual.continuidadAutomatica === true &&
    nombreFinal !== nombreActual
) {
    cabanaActual.reservaId =
        generarReservaId(fechaSeleccionada, numeroCabana);

    cabanaActual.continuidadAutomatica = false;
    cabanaActual.fechaOrigenReserva = fechaSeleccionada;

    // Las noches de la reserva anterior no pertenecen
    // automáticamente a esta nueva reserva.
    cabanaActual.noches = "";
}

cabanaActual.titular = nombreFinal;
cabanaActual.editadoManual = true;

guardarDatos();

actualizarTarjetasRevision(fechaSeleccionada);
actualizarResumenAseo(fechaSeleccionada);

});

// ==========================================
// EDITAR CANTIDAD DE NOCHES
// ==========================================

document.addEventListener("click", (evento) => {

  const boton = evento.target.closest("[data-editar-noches]");

  if (!boton || !fechaSeleccionada) {
    return;
  }

  const numeroCabana = boton.dataset.editarNoches;
  const datos = obtenerDatosDia(fechaSeleccionada);

  if (!datos.cabanas[numeroCabana]) {
    datos.cabanas[numeroCabana] = {};
  }

  const nochesActuales = datos.cabanas[numeroCabana].noches || "";

  const respuesta = prompt(
    `Noches CAB ${numeroCabana}:`,
    nochesActuales
  );

  if (respuesta === null) {
    return;
  }

  // Si deja vacío o escribe 0, borrar cantidad de noches
if (respuesta.trim() === "" || respuesta.trim() === "0") {

    datos.cabanas[numeroCabana].noches = "";

    guardarDatos();

    const valorNoches = boton.querySelector(".valor-noches");

    if (valorNoches) {
        valorNoches.textContent = "";
    }

    return;
}

const noches = parseInt(respuesta, 10);

if (!Number.isInteger(noches) || noches < 1) {
    alert("Ingresa una cantidad válida de noches.");
    return;
}

datos.cabanas[numeroCabana].noches = noches;

// Crear Reserva ID solamente si esta reserva todavía no tiene uno
if (!datos.cabanas[numeroCabana].reservaId) {
    datos.cabanas[numeroCabana].reservaId =
        generarReservaId(fechaSeleccionada, numeroCabana);
}

guardarDatos();

// Crear los días de continuidad de esta reserva
crearContinuidadesReserva(
    fechaSeleccionada,
    numeroCabana,
    noches
);

if (typeof generarCalendario === "function") {
    generarCalendario();
}

const valorNoches = boton.querySelector(".valor-noches");

if (valorNoches) {
    valorNoches.textContent = noches;
}

});

// ======================================
// COPIAR RESUMEN DEL DÍA
// ======================================

const botonCopiarResumen = document.getElementById("copiar-resumen-dia");

if (botonCopiarResumen) {
    botonCopiarResumen.addEventListener("click", async () => {

        const resumen =
            document.getElementById("resumen-dia-texto")?.textContent.trim() || "";

        const mantencion =
            document.getElementById("resumen-mantencion")?.value.trim() || "";

        const lavanderia =
            document.getElementById("resumen-lavanderia")?.value.trim() || "";

        const partes = [resumen];

        if (mantencion) {
            partes.push(`MANTENCIÓN\n${mantencion}`);
        }

        if (lavanderia) {
            partes.push(`LAVANDERÍA\n${lavanderia}`);
        }

        const textoFinal = partes.join("\n\n");

        try {
            await navigator.clipboard.writeText(textoFinal);

            const textoOriginal = botonCopiarResumen.textContent;
            botonCopiarResumen.textContent = "✓ Resumen copiado";

            setTimeout(() => {
                botonCopiarResumen.textContent = textoOriginal;
            }, 2000);

        } catch (error) {
            console.error("No se pudo copiar el resumen:", error);
        }
    });
}