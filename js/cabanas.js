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
    actualizarTarjetasRevision(fecha);
    actualizarResumenAseo(fecha);

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

        const encargado =
            cabana.aseo || "Sin asignar";

        const horaIn =
            cabana.aseoIn || "--:--";

        const horaOut =
            cabana.aseoOut || "--:--";
        
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

        tarjeta.innerHTML = `
            <div class="aseo-resumen-cabecera">

            <div class="aseo-resumen-numero">
            CAB ${numeroCabana}
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

                <div class="aseo-resumen-encargado">
                    <span>Encargado</span>
                    <strong>${encargado}</strong>
                </div>

                <div class="aseo-resumen-horario">
                    <div>
                        <span>IN</span>
                        <strong>${horaIn}</strong>
                    </div>

                    <div>
                        <span>OUT</span>
                        <strong>${horaOut}</strong>
                    </div>
                </div>

            </div>
        `;

        contenedor.appendChild(tarjeta);
    }

    // ========================================
// CAMBIAR ESTADO DESDE RESUMEN DE ASEO
// ========================================

document.addEventListener("change", (evento) => {

    const selector =
        evento.target.closest("[data-estado-revision]");

    if (!selector) {
        return;
    }

    if (!fechaSeleccionada) {
        return;
    }

    const numeroCabana =
        selector.dataset.estadoRevision;

    const datos =
        obtenerDatosDia(fechaSeleccionada);

    if (!datos.cabanas[numeroCabana]) {
        datos.cabanas[numeroCabana] = {};
    }

    // MISMO ESTADO UTILIZADO POR LA REVISIÓN INDIVIDUAL
    datos.cabanas[numeroCabana].estadoRevision =
        selector.value;

    guardarDatos();

    // Actualizar resumen
    actualizarResumenAseo(fechaSeleccionada);

    // Si justo está abierta esta misma cabaña,
    // actualizar también su selector
    const cabanaAbierta =
        localStorage.getItem("haikuRevisionCabana");

    if (
        cabanaAbierta === String(numeroCabana) &&
        revisionEstado
    ) {
        revisionEstado.value = selector.value;
    }
});

}

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