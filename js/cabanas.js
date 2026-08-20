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

    // PRIORIDAD 4: TODOS LOS ESTADOS OPERATIVOS → GRIS
// BLOQUEADA ya fue capturada arriba y permanece ROJA
if (
    datosCabana.estado === "libre-libre" ||
    datosCabana.estado === "libre-ingresa" ||
    datosCabana.estado === "sale-libre" ||
    datosCabana.estado === "sale-ingresa" ||
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

        const titularCabana = fila.querySelector(
    `[data-titular-cabana="${numeroCabana}"]`
);

if (titularCabana) {
    titularCabana.textContent =
        datosCabana.titular && datosCabana.titular.trim() !== ""
            ? datosCabana.titular
            : "Sin titular";
}

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

// SERVICIOS
const serviciosCabana = [];

Object.entries(datos.cabanas).forEach(([numeroCabana, cabana]) => {
    const servicio = cabana.servicio || "";

    if (servicio.trim() !== "") {
        serviciosCabana.push({
            cabana: numeroCabana,
            servicio: servicio.trim()
        });
    }
});

if (serviciosCabana.length > 0) {
    lineas.push("");
    lineas.push("SERVICIOS");

    serviciosCabana.forEach(item => {
        lineas.push(`CAB ${item.cabana} — ${item.servicio}`);
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
        <strong>${encargado}</strong>
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

datos.cabanas[numeroCabana].titular = nombreFinal;

guardarDatos();

actualizarTarjetasRevision(fechaSeleccionada);
actualizarResumenAseo(fechaSeleccionada);

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