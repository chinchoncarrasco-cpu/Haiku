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