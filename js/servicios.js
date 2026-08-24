// =========================================
// SERVICIOS COMPLEMENTARIOS
// =========================================

// Catálogo general de servicios y productos.
// Este será el punto central desde donde Servicios
// obtendrá nombres, precios y categorías.

const CATALOGO_SERVICIOS = {

    // =====================================
    // TINAJAS
    // =====================================

    tinajaTonel: {
        categoria: "tinaja",
        nombre: "Tinaja Tonel de Madera",
        precio: 30000,
        unidad: "hora",
        capacidadIncluida: 3,
        capacidadMaxima: 3
    },

    tinajaJacuzzi: {
        categoria: "tinaja",
        nombre: "Tinaja Jacuzzi",
        precio: 30000,
        unidad: "hora",
        capacidadIncluida: 3,
        capacidadMaxima: 5,
        precioPersonaAdicional: 10000
    },


    // =====================================
    // MASAJES
    // =====================================

    masajeTerapeutico30: {
        categoria: "masaje",
        nombre: "Masaje Terapéutico 30 min",
        precio: 35000,
        duracionMinutos: 30
    },

    masajeTerapeutico60: {
        categoria: "masaje",
        nombre: "Masaje Terapéutico 60 min",
        precio: 45000,
        duracionMinutos: 60
    },

    masajeDescontracturante30: {
        categoria: "masaje",
        nombre: "Masaje Descontracturante 30 min",
        precio: 40000,
        duracionMinutos: 30
    },

    masajeDescontracturante60: {
        categoria: "masaje",
        nombre: "Masaje Descontracturante 60 min",
        precio: 50000,
        duracionMinutos: 60
    },


    // =====================================
    // CHECK-OUT
    // =====================================

    lateCheckout: {
        categoria: "checkout",
        nombre: "Late Check-out",
        precio: 10000,
        unidad: "hora",
        horaInicioCobro: "12:00"
    },


    // =====================================
    // ALIMENTOS
    // =====================================

    panMasaMadre: {
        categoria: "alimentos",
        nombre: "Pan masa madre",
        precio: 500,
        unidad: "unidad"
    },

    huevo: {
        categoria: "alimentos",
        nombre: "Huevo",
        precio: 500,
        unidad: "unidad"
    },

    trozoQueque: {
        categoria: "alimentos",
        nombre: "Trozo de queque",
        precio: 625,
        unidad: "unidad"
    },

    quequeEntero: {
        categoria: "alimentos",
        nombre: "Queque entero",
        precio: 6000,
        unidad: "unidad"
    },


    // =====================================
    // LEÑA Y CARBÓN
    // =====================================

    lena: {
        categoria: "combustible",
        nombre: "Carga adicional de leña",
        precio: 8000,
        unidad: "saco"
    },

    carbon: {
        categoria: "combustible",
        nombre: "Carga adicional de carbón",
        precio: 5000,
        unidad: "bolsa"
    },


    // =====================================
    // ATENCIONES ESPECIALES
    // =====================================

    atencionEspecial: {
        categoria: "atencion",
        nombre: "Atención especial",
        precio: 20000,
        unidad: "servicio",
        permiteCortesia: true
    }

};

// =========================================
// REGISTRO DE SERVICIOS
// =========================================

// Aquí se almacenarán todos los servicios registrados.
// Cada servicio tendrá su propio identificador y estará
// asociado a una fecha, cabaña y reserva.

let serviciosRegistrados = JSON.parse(
    localStorage.getItem("haikuServicios")
) || [];


// =========================================
// GUARDAR SERVICIOS
// =========================================

function guardarServicios() {

    localStorage.setItem(
        "haikuServicios",
        JSON.stringify(serviciosRegistrados)
    );

}


// =========================================
// GENERAR ID DE SERVICIO
// =========================================

function generarIdServicio() {

    return (
        "servicio-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2, 8)
    );

}

// =========================================
// REGISTRAR NUEVO SERVICIO
// =========================================

function registrarServicio({
    fecha,
    numeroCabana,
    reservaId = "",
    titular = "",
    tipoServicio,
    cantidad = 1,
    personas = 1,
    tipoCobro = "normal",
    fechaServicio = "",
    hora = "",
    precioManual = null,
    cortesia = false,
    observaciones = ""
}) {

    const producto = CATALOGO_SERVICIOS[tipoServicio];

    if (!producto) {
        console.error("Servicio no encontrado:", tipoServicio);
        return null;
    }

    // Precio base
    let precioUnitario = producto.precio || 0;
    let total = precioUnitario * cantidad;

    // Precio manual del Jacuzzi
if (tipoServicio === "tinajaJacuzzi" && precioManual !== null) {
    precioUnitario = precioManual;
    total = precioManual * cantidad;
}

   // ------------------------------
// REGLA ESPECIAL: JACUZZI
// Solo se aplica si NO hay precio manual
// ------------------------------

if (
    tipoServicio === "tinajaJacuzzi" &&
    precioManual === null &&
    personas > producto.capacidadIncluida
) {
    const personasAdicionales =
        personas - producto.capacidadIncluida;

    total +=
        personasAdicionales *
        producto.precioPersonaAdicional;
}

    // -------------------------------------
    // CORTESÍA
    // -------------------------------------

    if (tipoCobro === "cortesia") {
    total = 0;
    }

    const nuevoServicio = {

        id: generarIdServicio(),

        fecha,
        numeroCabana,
        reservaId,
        titular,

        tipoServicio,
        categoria: producto.categoria,
        nombre: producto.nombre,

        cantidad,
        personas,

        fechaServicio,
        hora,
        precioManual,

        precioUnitario,
        total,

        tipoCobro,
        cortesia: tipoCobro === "cortesia",

        estadoServicio: "pendiente",

        estadoPago:
            total > 0
                ? "pendiente"
                : "no-corresponde",

        observaciones,

        creadoEn: new Date().toISOString()
    };

    serviciosRegistrados.push(nuevoServicio);

    guardarServicios();

    renderizarAgendaServicios();

    return nuevoServicio;
}

// =====================================
// MOSTRAR AGENDA DE SERVICIOS
// =====================================

function renderizarAgendaServicios() {

    const agenda = document.getElementById("servicios-agenda");

    if (!agenda) return;

    const serviciosDelDia = serviciosRegistrados
    .filter(servicio => servicio.fechaServicio === fechaSeleccionada)
    .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

    const contadorHoy = document.getElementById("servicios-contador-hoy");

if (contadorHoy) {
  contadorHoy.textContent = serviciosDelDia.length;
}

const contadorPendientes = document.getElementById("servicios-contador-pendientes");

if (contadorPendientes) {
    const pendientes = serviciosDelDia.filter(
        servicio => servicio.estadoPago === "pendiente"
    );

    contadorPendientes.textContent = pendientes.length;
}

    console.log(
    "AGENDA DEL DÍA:",
    fechaSeleccionada,
    serviciosDelDia
);

if (serviciosDelDia.length === 0) {
    agenda.innerHTML = `
        <p class="servicios-agenda-vacia">
            No hay servicios programados para este día.
        </p>
    `;
    return;
}

agenda.innerHTML = serviciosDelDia.map(servicio => {

  const esCortesia =
    servicio.cortesia === true ||
    servicio.tipoCobro === "cortesia";

  const estaRealizado =
    servicio.estadoServicio === "realizado";

  const estaPagado =
    servicio.estadoPago === "pagado";

  const claseEstado = estaRealizado
    ? "estado-realizado"
    : "estado-pendiente";

  return `
    <div class="servicios-agenda-item ${claseEstado}">

      <!-- CABECERA -->
      <div class="servicio-agenda-cabecera">

        <div class="servicio-agenda-principal">
          <span class="servicio-agenda-hora">
            ${servicio.hora || "--:--"}
          </span>

          <strong class="servicio-agenda-nombre">
            ${servicio.nombre}
          </strong>
        </div>

        ${
          estaRealizado
            ? `<span class="servicio-estado-badge realizado">✓ Realizado</span>`
            : `<span class="servicio-estado-badge pendiente">Pendiente</span>`
        }

      </div>


      <!-- HUÉSPED / CABAÑA -->
      <div class="servicio-agenda-huesped">
        CAB ${servicio.numeroCabana}
        ${servicio.titular ? ` · ${servicio.titular}` : ""}
      </div>


      <!-- COBRO -->
      <div class="servicio-agenda-cobro">

        ${
          esCortesia
            ? `
              <span class="servicios-cortesia">
                🎁 CORTESÍA
              </span>
            `
            : `
              <strong class="servicio-agenda-precio">
                $${Number(servicio.total || 0).toLocaleString("es-CL")}
              </strong>

              ${
                servicio.estadoPago === "pendiente"
                  ? `
                    <span class="servicios-pago-pendiente">
                      Pendiente de pago
                    </span>
                  `
                  : estaPagado
                    ? `
                      <span class="servicios-pago-ok">
                        ✓ Pagado
                      </span>
                    `
                    : ""
              }
            `
        }

      </div>


      <!-- ACCIONES -->
      <div class="servicio-agenda-acciones">

        ${
          !esCortesia && servicio.estadoPago === "pendiente"
            ? `
              <button
                type="button"
                class="servicio-btn servicio-btn-ok"
                onclick="marcarServicioPagado('${servicio.id}')"
              >
                ✓ Marcar pagado
              </button>
            `
            : ""
        }

        ${
          !esCortesia && estaPagado
            ? `
              <button
                type="button"
                class="servicio-btn servicio-btn-secundario"
                onclick="deshacerServicioPagado('${servicio.id}')"
              >
                ↶ Deshacer pago
              </button>
            `
            : ""
        }

        ${
          estaRealizado
            ? `
              <button
                type="button"
                class="servicio-btn servicio-btn-secundario"
                onclick="deshacerServicioRealizado('${servicio.id}')"
              >
                ↶ Deshacer realizado
              </button>
            `
            : `
              <button
                type="button"
                class="servicio-btn servicio-btn-ok"
                onclick="marcarServicioRealizado('${servicio.id}')"
              >
                ✓ Marcar realizado
              </button>
            `
        }

        <button
          type="button"
          class="servicio-btn servicio-btn-eliminar"
          onclick="eliminarServicio('${servicio.id}')"
        >
          Eliminar
        </button>

      </div>

    </div>
  `;
}).join("");

}

// =====================================
// MARCAR SERVICIO COMO REALIZADO
// =====================================

function marcarServicioRealizado(idServicio) {

    const servicio = serviciosRegistrados.find(
        servicio => servicio.id === idServicio
    );

    if (!servicio) {
        console.error("No se encontró el servicio:", idServicio);
        return;
    }

    servicio.estadoServicio = "realizado";

    guardarServicios();
    renderizarAgendaServicios();

    console.log("SERVICIO REALIZADO:", servicio);
}

// =====================================
// DESHACER SERVICIO REALIZADO
// =====================================

function deshacerServicioRealizado(idServicio) {

    const servicio = serviciosRegistrados.find(
        servicio => servicio.id === idServicio
    );

    if (!servicio) {
        console.error("No se encontró el servicio:", idServicio);
        return;
    }

    servicio.estadoServicio = "pendiente";

    guardarServicios();
    renderizarAgendaServicios();

    console.log("SERVICIO REALIZADO DESHECHO:", servicio);
}

// =====================================
// MARCAR SERVICIO COMO PAGADO
// =====================================

function marcarServicioPagado(idServicio) {

    const servicio = serviciosRegistrados.find(
        servicio => servicio.id === idServicio
    );

    if (!servicio) {
        console.error("No se encontró el servicio:", idServicio);
        return;
    }

    servicio.estadoPago = "pagado";

    guardarServicios();
    renderizarAgendaServicios();

    console.log("SERVICIO PAGADO:", servicio);
}

// ===================================
// DESHACER SERVICIO PAGADO
// ===================================

function deshacerServicioPagado(idServicio) {

    const servicio = serviciosRegistrados.find(
        servicio => servicio.id === idServicio
    );

    if (!servicio) {
        console.error("No se encontró el servicio:", idServicio);
        return;
    }

    servicio.estadoPago = "pendiente";

    guardarServicios();
    renderizarAgendaServicios();

    console.log("PAGO DESHECHO:", servicio);
}

// =====================================
// ELIMINAR SERVICIO
// =====================================

function eliminarServicio(idServicio) {

    const servicio = serviciosRegistrados.find(
        servicio => servicio.id === idServicio
    );

    if (!servicio) {
        console.error("No se encontró el servicio:", idServicio);
        return;
    }

    const confirmar = confirm(
        `¿Eliminar ${servicio.nombre} de la cabaña ${servicio.numeroCabana}?`
    );

    if (!confirmar) return;

    serviciosRegistrados = serviciosRegistrados.filter(
        servicio => servicio.id !== idServicio
    );

    guardarServicios();
    renderizarAgendaServicios();

    console.log("SERVICIO ELIMINADO:", servicio);
}

// ============================================
// SERVICIOS COMPLEMENTARIOS
// ============================================


// ============================================
// ABRIR / CERRAR FORMULARIO
// ============================================

document.addEventListener("DOMContentLoaded", () => {

    const btnNuevo = document.getElementById("servicios-btn-nuevo");
    const formulario = document.getElementById("servicios-formulario");
    const btnCancelar = document.getElementById("servicios-btn-cancelar");
    const selectCabana = document.getElementById("servicios-cabana");
    const selectProducto = document.getElementById("servicios-producto");

    if (!btnNuevo || !formulario || !btnCancelar) {
        return;
    }

    btnNuevo.addEventListener("click", () => {

        console.log("CLICK REGISTRAR SERVICIO");
        console.log("selectProducto:", selectProducto);
        console.log("CATALOGO_SERVICIOS:", CATALOGO_SERVICIOS);

    formulario.hidden = false;
    btnNuevo.hidden = true;

    // Cargar cabañas disponibles
    if (selectCabana) {

        selectCabana.innerHTML =
            '<option value="">Seleccionar cabaña</option>';

                for (let numeroCabana = 1; numeroCabana <= 11; numeroCabana++) {

            const option = document.createElement("option");

            option.value = numeroCabana;
            option.textContent = `Cabaña ${numeroCabana}`;

            selectCabana.appendChild(option);
        }
    }

    // Cargar servicios y productos disponibles
if (selectProducto) {

    selectProducto.innerHTML =
        '<option value="">Seleccionar servicio</option>';

        console.log("CATÁLOGO SERVICIOS:", CATALOGO_SERVICIOS);
        Object.entries(CATALOGO_SERVICIOS).forEach(([idServicio, servicio]) => {

    const option = document.createElement("option");

    option.value = idServicio;
    option.textContent = servicio.nombre;

    selectProducto.appendChild(option);
});

}

// ==========================================
// ACTUALIZAR PRECIO AUTOMÁTICAMENTE
// ==========================================

const inputCantidad = document.getElementById("servicios-cantidad");
const textoPrecio = document.getElementById("servicios-precio");
const btnGuardar = document.getElementById("servicios-btn-guardar");
const inputPrecioManual = document.getElementById("servicios-precio-manual");

function actualizarPrecioServicio() {

    const idServicio = selectProducto.value;
    const cantidad = Number(inputCantidad.value) || 1;

    // Jacuzzi: permitir ingresar el valor total manualmente
    if (idServicio === "tinajaJacuzzi") {
    inputPrecioManual.hidden = false;

    const valorManual = Number(inputPrecioManual.value);

    if (valorManual > 0) {
        textoPrecio.textContent = `$${valorManual.toLocaleString("es-CL")}`;
    } else {
        textoPrecio.textContent = "$30.000";
    }

    return;
}

// Cualquier otro servicio: precio automático
inputPrecioManual.hidden = true;
inputPrecioManual.value = "";

    if (!idServicio || !CATALOGO_SERVICIOS[idServicio]) {
        textoPrecio.textContent = "$0";
        return;
    }

    const servicio = CATALOGO_SERVICIOS[idServicio];

    const total = servicio.precio * cantidad;

    textoPrecio.textContent = `$${total.toLocaleString("es-CL")}`;
}

selectProducto.addEventListener("change", actualizarPrecioServicio);
inputCantidad.addEventListener("input", actualizarPrecioServicio);
inputPrecioManual.addEventListener("input", actualizarPrecioServicio);

// ==========================================
// MOSTRAR FECHA Y HORA SOLO TINAJAS / MASAJES
// ==========================================

const programacionServicio = document.getElementById("servicios-programacion");
const inputFechaServicio = document.getElementById("servicios-fecha");
const inputHoraServicio = document.getElementById("servicios-hora");

function actualizarProgramacionServicio() {

    const idServicio = selectProducto.value;
    const servicio = CATALOGO_SERVICIOS[idServicio];

    if (!servicio) {
        programacionServicio.hidden = true;
        return;
    }

    const requiereProgramacion =
        servicio.categoria === "tinaja" ||
        servicio.categoria === "masaje";

    programacionServicio.hidden = !requiereProgramacion;

    if (!requiereProgramacion) {
        inputFechaServicio.value = "";
        inputHoraServicio.value = "";
    }
}

selectProducto.addEventListener("change", actualizarProgramacionServicio);

// ==========================================
// GUARDAR NUEVO SERVICIO
// ==========================================

btnGuardar.addEventListener("click", () => {

    const cabana = selectCabana.value;
    const idServicio = selectProducto.value;
    const cantidad = Number(inputCantidad.value) || 1;

    const tipoCobro = document.querySelector(
    'input[name="servicios-tipo-cobro"]:checked'
    )?.value || "normal";

    const servicio = CATALOGO_SERVICIOS[idServicio];

const requiereProgramacion =
    servicio?.categoria === "tinaja" ||
    servicio?.categoria === "masaje";

const fechaServicio = requiereProgramacion
    ? inputFechaServicio.value
    : "";

const horaServicio = requiereProgramacion
    ? inputHoraServicio.value
    : "";

const precioManual =
    idServicio === "tinajaJacuzzi"
        ? Number(inputPrecioManual.value) || 30000
        : null;

    // Validar que exista cabaña y servicio
    if (!cabana || !idServicio) {
        alert("Selecciona una cabaña y un servicio.");
        return;
    }

    const datosDia = obtenerDatosDia(fechaSeleccionada);
    const datosCabana = datosDia.cabanas[cabana] || {};

    const nuevoServicio = registrarServicio({
    fecha: fechaSeleccionada,
    numeroCabana: cabana,
    reservaId: datosCabana.reservaId || "",
    titular: datosCabana.titular || "",
    tipoServicio: idServicio,
    cantidad: cantidad,
    personas: cantidad,
    tipoCobro: tipoCobro,

    fechaServicio: fechaServicio,
    hora: horaServicio,
    precioManual: precioManual
});

    console.log("SERVICIO GUARDADO:", nuevoServicio);
});

});

btnCancelar.addEventListener("click", () => {
    formulario.hidden = true;
    btnNuevo.hidden = false;
});

renderizarAgendaServicios();

});