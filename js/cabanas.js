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
    actualizarTarjetasRevision(fecha);

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


        // ----------------------------
        // ESTADO
        // ----------------------------

        const estado =
            tarjeta.querySelector(".cabana-estado");

        if (estado) {

    const nombresEstado = {
        "libre-libre": "LIBRE / LIBRE",
        "libre-ingresa": "LIBRE / INGRESA",
        "sale-libre": "SALE / LIBRE",
        "sale-ingresa": "SALE / INGRESA",
        "continua": "CONTINÚA",
        "bloqueada": "BLOQUEADA"
    };

    estado.textContent =
        nombresEstado[datosCabana.estado] ||
        "Sin estado";

    estado.dataset.estado =
        datosCabana.estado || "";
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