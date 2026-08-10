// ========================================
// CHECKLIST DE CABAÑAS
// ========================================

const checklistsCabanas = {

    // ========================================
    // CAB 1
    // ========================================

    1: [

        {
            area: "🍳 COCINA",

            subareas: [

                {
                    nombre: "1️⃣ Subárea",
                    items: [
                        "Cocina",
                        "Chispero"
                    ]
                },

                {
                    nombre: "2️⃣ Subárea",
                    items: [
                        "Bowles",
                        "Cafetera",
                        "Termo",
                        "Aceite",
                        "Sal",
                        "Platos",
                        "Tazas",
                        "Vasos",
                        "Copas",
                        "Jarro jugo",
                        "Azúcar",
                        "Café",
                        "Té",
                        "Té de Hie."
                    ]
                },

                {
                    nombre: "3️⃣ Subárea",
                    items: [
                        "Individuales",
                        "Utensilios",
                        "Servilletas",
                        "Refri",
                        "Ollas",
                        "Ensaladera",
                        "Exprimidor",
                        "Sartén",
                        "Tabla de P.",
                        "Rallador",
                        "Guantes",
                        "Art. Limpieza",
                        "Basurero"
                    ]
                }

            ]
        },


        {
            area: "🚿 BAÑO",

            items: [
                "Amenities",
                "Jabón Liq.",
                "Secador",
                "WC",
                "Papel H.",
                "Toallas",
                "Basurero",
                "Chancho",
                "Sopapo",
                "Ducha",
                "Alfombra",
                "Cortina B."
            ]
        },


        {
            area: "🛏️ LIVING/C",

            items: [
                "Cama",
                "Cojines",
                "Pie de cama",
                "Cajones limpios",
                "Lámparas",
                "Alfombras",
                "Manta",
                "Frazadas",
                "Percheros",
                "Controles (2tv/1ac)",
                "TV",
                "AC",
                "Luces",
                "Vela",
                "Salamandra",
                "Manilla",
                "Leña",
                "Diario",
                "Ventanales",
                "Cortinas"
            ]
        },


        {
            area: "🌄 TERRAZA",

            items: [
                "Carbón",
                "Fogón",
                "Atizador",
                "Pala",
                "Escobillón",
                "Mesa",
                "Jardineras",
                "Cojines"
            ]
        }

    ]

};

// ========================================
// MOSTRAR CHECKLIST DE UNA CABAÑA
// ========================================

function mostrarChecklistCabana(numeroCabana) {

    const contenedor =
        document.getElementById("revision-checklist");

    if (!contenedor) {
        return;
    }

    contenedor.innerHTML = "";

    const checklist =
        checklistsCabanas[numeroCabana];

    if (!checklist) {

        contenedor.innerHTML =
            "<p>Checklist aún no configurado.</p>";

        return;
    }


    checklist.forEach((bloque, indiceArea) => {

        const area = document.createElement("div");

        area.className = "checklist-area";


        const titulo = document.createElement("h4");

        titulo.textContent = bloque.area;

        area.appendChild(titulo);


        // Áreas que contienen subáreas

        if (bloque.subareas) {

            bloque.subareas.forEach(
                (subarea, indiceSubarea) => {

                    const subtitulo =
                        document.createElement("h5");

                    subtitulo.textContent =
                        subarea.nombre;

                    area.appendChild(subtitulo);


                    crearItemsChecklist(
                        area,
                        subarea.items,
                        numeroCabana,
                        `${indiceArea}-${indiceSubarea}`
                    );

                }
            );

        }


        // Áreas normales

        if (bloque.items) {

            crearItemsChecklist(
                area,
                bloque.items,
                numeroCabana,
                `${indiceArea}`
            );

        }


        contenedor.appendChild(area);

    });

}

// ========================================
// CREAR ÍTEMS DEL CHECKLIST
// ========================================

function crearItemsChecklist(
    contenedor,
    items,
    numeroCabana,
    grupo
) {

    const lista =
        document.createElement("div");

    lista.className = "checklist-items";


    items.forEach((nombre, indice) => {

        const label =
            document.createElement("label");

        label.className = "checklist-item";


        const checkbox =
            document.createElement("input");

        checkbox.type = "checkbox";

        checkbox.dataset.checklistId =
            `${grupo}-${indice}`;


        const texto =
            document.createElement("span");

        texto.textContent = nombre;


        label.appendChild(checkbox);

        label.appendChild(texto);

        lista.appendChild(label);

    });


    contenedor.appendChild(lista);

}