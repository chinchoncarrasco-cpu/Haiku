// ========================================
// CIERRE DE TURNO
// ========================================

// Obtener / crear los datos de cierre del día
function obtenerCierreDia(fecha) {

    const datos = obtenerDatosDia(fecha);

    if (!datos.cierre) {

        datos.cierre = {

            // =========================
            // ETAPA 1
            // =========================

            salidaTemprana: "",
            salioAntes: "",
            llavesRetiradas: "",
            registroGuardado: false,
            reservaMarcada: false,
            pagoRegistrado: false,

            // =========================
            // ETAPA 2
            // =========================

            detallesCabanas: "",
            pendientesHacer: "",
            hayNovedades: "",
            novedades: "",

            // =========================
            // ETAPA 3 · TINAJAS
            // =========================

            tinajaTonelApagado: false,
            tinajaJacuzziApagado: false,
            tinajaTonelFuncionamiento: false,
            tinajaJacuzziFuncionamiento: false,
            tinajaCojinesRetirados: false,

            // =========================
            // ETAPA 4 · CABAÑAS
            // =========================

            cabanasCierre: {}
        };
    }

    // Compatibilidad con días guardados anteriormente
    if (!datos.cierre.cabanasCierre) {
        datos.cierre.cabanasCierre = {};
    }

    return datos.cierre;
}

// ========================================
// CARGAR VISUALMENTE EL CIERRE DEL DÍA
// ========================================

function cargarCierreDia(fecha) {

    const cierre = obtenerCierreDia(fecha);

    // ----------------
    // RADIOS
    // ----------------

    const radios = [
    // ETAPA 1
    ["salida-temprana", cierre.salidaTemprana],
    ["salio-antes", cierre.salioAntes],
    ["llaves-retiradas", cierre.llavesRetiradas],

    // ETAPA 2
    ["detalles-cabanas", cierre.detallesCabanas],
    ["pendientes-hacer", cierre.pendientesHacer],
    ["hay-novedades", cierre.hayNovedades]
];

    radios.forEach(([nombre, valor]) => {

        if (!valor) return;

        const radio = document.querySelector(
            `input[name="${nombre}"][value="${valor}"]`
        );

        if (radio) {
            radio.checked = true;
        }

    });


    // ----------------
    // CHECKBOXES
    // ----------------

    const registro = document.querySelector(
        '[data-cierre-campo="registro-guardado"]'
    );

    const reserva = document.querySelector(
        '[data-cierre-campo="reserva-marcada"]'
    );

    const pago = document.querySelector(
        '[data-cierre-campo="pago-registrado"]'
    );


    if (registro) {
        registro.checked = cierre.registroGuardado === true;
    }

    if (reserva) {
        reserva.checked = cierre.reservaMarcada === true;
    }

    if (pago) {
        pago.checked = cierre.pagoRegistrado === true;
    
        // =========================
// CHECKBOXES ETAPA 3 - TINAJAS
// =========================

const tonelApagado = document.querySelector(
    '[data-cierre-campo="tinaja-tonel-apagado"]'
);

const jacuzziApagado = document.querySelector(
    '[data-cierre-campo="tinaja-jacuzzi-apagado"]'
);

const tonelFuncionamiento = document.querySelector(
    '[data-cierre-campo="tinaja-tonel-funcionamiento"]'
);

const jacuzziFuncionamiento = document.querySelector(
    '[data-cierre-campo="tinaja-jacuzzi-funcionamiento"]'
);

const cojinesRetirados = document.querySelector(
    '[data-cierre-campo="tinaja-cojines-retirados"]'
);

if (tonelApagado) {
    tonelApagado.checked = cierre.tinajaTonelApagado === true;
}

if (jacuzziApagado) {
    jacuzziApagado.checked = cierre.tinajaJacuzziApagado === true;
}

if (tonelFuncionamiento) {
    tonelFuncionamiento.checked =
        cierre.tinajaTonelFuncionamiento === true;
}

if (jacuzziFuncionamiento) {
    jacuzziFuncionamiento.checked =
        cierre.tinajaJacuzziFuncionamiento === true;
}

if (cojinesRetirados) {
    cojinesRetirados.checked =
        cierre.tinajaCojinesRetirados === true;
}
    }

    // ----------------
    // TEXTAREA ETAPA 2
    // ----------------

    const novedades = document.querySelector(
        '[data-cierre-campo="novedades"]'
    );

    if (novedades) {
        novedades.value = cierre.novedades || "";
    }
    
    // ===============================
// CARGAR ETAPA 4 - CABAÑAS
// ===============================

// Cargar checks internos de cada cabaña
const checksCabanas = document.querySelectorAll(
    '[data-cierre-cabana][data-item]'
);

checksCabanas.forEach(check => {

    const cabana = check.dataset.cierreCabana;
    const item = check.dataset.item;

    const datosCabana = cierre.cabanasCierre?.[cabana];

    check.checked = datosCabana?.[item] === true;
});


// Cargar "Ocupada / No revisar"
const checksOcupadas = document.querySelectorAll(
    '[data-cierre-cabana-ocupada]'
);

checksOcupadas.forEach(check => {

    const cabana = check.dataset.cierreCabanaOcupada;

    const datosCabana = cierre.cabanasCierre?.[cabana];

    check.checked = datosCabana?.ocupada === true;
});

}

// ========================================
// CONTROLES ETAPA 1
// ========================================

const radiosSalidaTemprana =
    document.querySelectorAll('input[name="salida-temprana"]');

const radiosSalioAntes =
    document.querySelectorAll('input[name="salio-antes"]');

const radiosLlavesRetiradas =
    document.querySelectorAll('input[name="llaves-retiradas"]');

const checkRegistroGuardado =
    document.querySelector('[data-cierre-campo="registro-guardado"]');

const checkReservaMarcada =
    document.querySelector('[data-cierre-campo="reserva-marcada"]');

const checkPagoRegistrado =
    document.querySelector('[data-cierre-campo="pago-registrado"]');

    // =========================================
// CONTROLES ETAPA 2
// =========================================

const detallesCabanasInputs =
    document.querySelectorAll('input[name="detalles-cabanas"]');

const pendientesHacerInputs =
    document.querySelectorAll('input[name="pendientes-hacer"]');

const hayNovedadesInputs =
    document.querySelectorAll('input[name="hay-novedades"]');

const novedadesInput =
    document.querySelector('[data-cierre-campo="novedades"]');

// =========================
// CONTROLES ETAPA 3 · TINAJAS
// =========================

const checkTinajaTonelApagado =
    document.querySelector(
        '[data-cierre-campo="tinaja-tonel-apagado"]'
    );

const checkTinajaJacuzziApagado =
    document.querySelector(
        '[data-cierre-campo="tinaja-jacuzzi-apagado"]'
    );

const checkTinajaTonelFuncionamiento =
    document.querySelector(
        '[data-cierre-campo="tinaja-tonel-funcionamiento"]'
    );

const checkTinajaJacuzziFuncionamiento =
    document.querySelector(
        '[data-cierre-campo="tinaja-jacuzzi-funcionamiento"]'
    );

const checkTinajaCojinesRetirados =
    document.querySelector(
        '[data-cierre-campo="tinaja-cojines-retirados"]'
    );


// ========================================
// GUARDAR RADIO BUTTON
// ========================================

function guardarRadioCierre(nombre, campo) {

    const radios =
        document.querySelectorAll(`input[name="${nombre}"]`);

    radios.forEach(radio => {

        radio.addEventListener("change", () => {

            if (!fechaSeleccionada) {
                return;
            }

            const cierre =
                obtenerCierreDia(fechaSeleccionada);

            cierre[campo] = radio.value;

            guardarDatos();

            actualizarCierreTurno();
        });

    });
}


// ========================================
// GUARDAR CHECKBOX
// ========================================

function guardarCheckCierre(elemento, campo) {

    if (!elemento) {
        return;
    }

    elemento.addEventListener("change", () => {

        if (!fechaSeleccionada) {
            return;
        }

        const cierre =
            obtenerCierreDia(fechaSeleccionada);

        cierre[campo] = elemento.checked;

        guardarDatos();

        actualizarCierreTurno();
    });
}


// ========================================
// ACTIVAR GUARDADO ETAPA 1
// ========================================

guardarRadioCierre(
    "salida-temprana",
    "salidaTemprana"
);

guardarRadioCierre(
    "salio-antes",
    "salioAntes"
);

guardarRadioCierre(
    "llaves-retiradas",
    "llavesRetiradas"
);

guardarCheckCierre(
    checkRegistroGuardado,
    "registroGuardado"
);

guardarCheckCierre(
    checkReservaMarcada,
    "reservaMarcada"
);

guardarCheckCierre(
    checkPagoRegistrado,
    "pagoRegistrado"
);

// =========================================
// ACTIVAR GUARDADO ETAPA 2
// =========================================

guardarRadioCierre(
    "detalles-cabanas",
    "detallesCabanas"
);

guardarRadioCierre(
    "pendientes-hacer",
    "pendientesHacer"
);

guardarRadioCierre(
    "hay-novedades",
    "hayNovedades"
);

if (novedadesInput) {

    novedadesInput.addEventListener("input", () => {

        if (!fechaSeleccionada) {
            return;
        }

        const cierre =
            obtenerCierreDia(fechaSeleccionada);

        cierre.novedades =
            novedadesInput.value;

        guardarDatos();

        actualizarCierreTurno();

    });

}

// =========================
// ACTIVAR GUARDADO ETAPA 3
// =========================

guardarCheckCierre(
    checkTinajaTonelApagado,
    "tinajaTonelApagado"
);

guardarCheckCierre(
    checkTinajaJacuzziApagado,
    "tinajaJacuzziApagado"
);

guardarCheckCierre(
    checkTinajaTonelFuncionamiento,
    "tinajaTonelFuncionamiento"
);

guardarCheckCierre(
    checkTinajaJacuzziFuncionamiento,
    "tinajaJacuzziFuncionamiento"
);

guardarCheckCierre(
    checkTinajaCojinesRetirados,
    "tinajaCojinesRetirados"
);

// ===============================
// ACTIVAR GUARDADO ETAPA 4
// CABAÑAS
// ===============================

const checksCabanasCierre = document.querySelectorAll(
    '[data-cierre-cabana][data-item]'
);

checksCabanasCierre.forEach(check => {

    check.addEventListener("change", () => {

        if (!fechaSeleccionada) {
            return;
        }

        const cabana = check.dataset.cierreCabana;
        const item = check.dataset.item;

        const cierre = obtenerCierreDia(fechaSeleccionada);

        // Crear la cabaña si todavía no existe
        if (!cierre.cabanasCierre[cabana]) {
            cierre.cabanasCierre[cabana] = {};
        }

        // Guardar el estado del checkbox
        cierre.cabanasCierre[cabana][item] = check.checked;

        guardarDatos();

        actualizarCierreTurno();
    });

});

// ===============================
// CABAÑA OCUPADA / NO REVISAR
// ===============================

const checksCabanasOcupadas = document.querySelectorAll(
    '[data-cierre-cabana-ocupada]'
);

checksCabanasOcupadas.forEach(check => {

    check.addEventListener("change", () => {

        if (!fechaSeleccionada) {
            return;
        }

        const cabana = check.dataset.cierreCabanaOcupada;

        const cierre = obtenerCierreDia(fechaSeleccionada);

        // Crear la cabaña si todavía no existe
        if (!cierre.cabanasCierre[cabana]) {
            cierre.cabanasCierre[cabana] = {};
        }

        // Guardar si está ocupada
        cierre.cabanasCierre[cabana].ocupada = check.checked;

        guardarDatos();

        actualizarCierreTurno();
    });

});

// ========================================
// ACTUALIZAR PROGRESO DEL CIERRE
// ========================================

function actualizarCierreTurno() {

    if (!fechaSeleccionada) {
        return;
    }

    const cierre =
        obtenerCierreDia(fechaSeleccionada);
        
    console.log("DATOS CIERRE:", cierre);

    // ========================================
    // ETAPA 1
    // ========================================

    const controlesEtapa1 = [
        cierre.salidaTemprana === "si" || cierre.salidaTemprana === "no-hay",
        cierre.salioAntes === "si" || cierre.salioAntes === "no",
        cierre.llavesRetiradas === "si" ||
        cierre.llavesRetiradas === "no" ||
        cierre.llavesRetiradas === "no-aplica",
        cierre.registroGuardado === true,
        cierre.reservaMarcada === true,
        cierre.pagoRegistrado === true
    ];

    const completados =
        controlesEtapa1.filter(Boolean).length;

    const total =
        controlesEtapa1.length;

    const porcentaje =
        Math.round((completados / total) * 100);

    console.log(
        `Cierre Etapa 1: ${completados}/${total} - ${porcentaje}%`
    );

    // =========================================
// ETAPA 2
// =========================================

const controlesEtapa2 = [

    cierre.detallesCabanas === "si" ||
    cierre.detallesCabanas === "pendientes",

    cierre.pendientesHacer === "si" ||
    cierre.pendientesHacer === "no",

    cierre.hayNovedades === "no" ||
    cierre.hayNovedades === "si"

];

const completadosEtapa2 =
    controlesEtapa2.filter(Boolean).length;

const totalEtapa2 =
    controlesEtapa2.length;

const porcentajeEtapa2 =
    Math.round(
        (completadosEtapa2 / totalEtapa2) * 100
    );

console.log(
    `Cierre Etapa 2: ${completadosEtapa2}/${totalEtapa2} - ${porcentajeEtapa2}%`
);

// =========================
// ETAPA 3 - TINAJAS
// =========================

const controlesEtapa3 = [
    cierre.tinajaTonelApagado === true,
    cierre.tinajaJacuzziApagado === true,
    cierre.tinajaTonelFuncionamiento === true,
    cierre.tinajaJacuzziFuncionamiento === true,
    cierre.tinajaCojinesRetirados === true
];

const completadosEtapa3 =
    controlesEtapa3.filter(Boolean).length;

const totalEtapa3 =
    controlesEtapa3.length;

const porcentajeEtapa3 =
    Math.round((completadosEtapa3 / totalEtapa3) * 100);

console.log(
    `Cierre Etapa 3: ${completadosEtapa3}/${totalEtapa3} - ${porcentajeEtapa3}%`
);

// =========================
// PROGRESO GENERAL
// =========================

const completadosGeneral =
    completados + completadosEtapa2 + completadosEtapa3;

const totalGeneral =
    total + totalEtapa2 + totalEtapa3;

const porcentajeGeneral =
    Math.round((completadosGeneral / totalGeneral) * 100);

    // Actualizar porcentaje visual
    const porcentajeElemento =
    document.getElementById("cierre-porcentaje");

    if (porcentajeElemento) {
    porcentajeElemento.textContent = `${porcentajeGeneral}%`;
    }

    // Actualizar barra visual
    const barraProgreso =
    document.getElementById("cierre-barra-progreso");

    if (barraProgreso) {
    barraProgreso.style.width = `${porcentajeGeneral}%`;
    }

    }

    cargarCierreDia(fechaSeleccionada);
    actualizarCierreTurno();