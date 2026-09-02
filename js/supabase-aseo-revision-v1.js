// ========================================
// HAIKU · ASEO / REVISIÓN SUPABASE V1
// ========================================
// Mantiene la UI legacy, pero Supabase pasa a ser la fuente
// persistente de la revisión completa de cada cabaña.

(() => {
    "use strict";

    const TIPO_REVISION = "completa";

    const cacheCabanas = new Map();
    const cacheConfig = new Map();
    const cacheRevisiones = new Map();

    let usuarioIdCache = null;
    let resumenSincronizando = false;
    let temporizadorDetalles = null;
    let detallesEditandoHasta = 0;

    function cliente() {
        return window.haikuSupabase || null;
    }

    function fechaOperativa() {
        try {
            return (
                typeof fechaSeleccionada !== "undefined" &&
                fechaSeleccionada
            )
                ? String(fechaSeleccionada)
                : "";
        } catch (_) {
            return "";
        }
    }

    function numeroRevisionAbierta() {
        return localStorage.getItem("haikuRevisionCabana") || "";
    }

    function claveRevision(fecha, numeroCabana) {
        return `${fecha}::${numeroCabana}`;
    }

    async function obtenerUsuarioId() {
        if (usuarioIdCache) {
            return usuarioIdCache;
        }

        const supabase = cliente();
        if (!supabase) {
            return null;
        }

        const { data, error } = await supabase.auth.getUser();

        if (error) {
            throw error;
        }

        usuarioIdCache = data?.user?.id || null;
        return usuarioIdCache;
    }

    async function obtenerCabana(numeroCabana) {
        const numero = String(numeroCabana);

        if (cacheCabanas.has(numero)) {
            return cacheCabanas.get(numero);
        }

        const supabase = cliente();
        if (!supabase) {
            return null;
        }

        const { data, error } = await supabase
            .from("cabanas")
            .select("id, numero, nombre, tipo")
            .eq("numero", Number(numeroCabana))
            .single();

        if (error) {
            throw error;
        }

        cacheCabanas.set(numero, data);
        return data;
    }

    async function obtenerConfiguracion(numeroCabana, cabanaId) {
        const numero = String(numeroCabana);

        if (cacheConfig.has(numero)) {
            return cacheConfig.get(numero);
        }

        const supabase = cliente();
        if (!supabase) {
            return new Map();
        }

        const { data, error } = await supabase
            .from("cabana_checklist_config")
            .select(
                "checklist_item_id, legacy_checklist_id, cantidad_esperada, obligatorio, activo, orden_visual"
            )
            .eq("cabana_id", cabanaId)
            .eq("activo", true)
            .not("legacy_checklist_id", "is", null)
            .order("orden_visual", { ascending: true });

        if (error) {
            throw error;
        }

        const mapa = new Map();

        (data || []).forEach(item => {
            if (item.legacy_checklist_id) {
                mapa.set(String(item.legacy_checklist_id), item);
            }
        });

        cacheConfig.set(numero, mapa);
        return mapa;
    }

    async function buscarRevision(fecha, numeroCabana, cabanaId) {
        const key = claveRevision(fecha, numeroCabana);

        if (cacheRevisiones.has(key)) {
            return cacheRevisiones.get(key);
        }

        const supabase = cliente();
        if (!supabase) {
            return null;
        }

        const { data, error } = await supabase
            .from("revisiones_cabana")
            .select(
                "id, fecha, cabana_id, tipo_revision, estado, resultado, observaciones, revisado_por, iniciado_en, finalizado_en, creado_en"
            )
            .eq("fecha", fecha)
            .eq("cabana_id", cabanaId)
            .eq("tipo_revision", TIPO_REVISION)
            .neq("estado", "cancelada")
            .order("creado_en", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            throw error;
        }

        cacheRevisiones.set(key, data || null);
        return data || null;
    }

    async function asegurarRevision(numeroCabana) {
        const fecha = fechaOperativa();
        if (!fecha) {
            throw new Error("No hay fecha operativa seleccionada.");
        }

        const cabana = await obtenerCabana(numeroCabana);
        if (!cabana?.id) {
            throw new Error(`No se encontró CAB ${numeroCabana} en Supabase.`);
        }

        let revision = await buscarRevision(
            fecha,
            numeroCabana,
            cabana.id
        );

        if (revision) {
            return revision;
        }

        const supabase = cliente();
        const usuarioId = await obtenerUsuarioId();
        const ahora = new Date().toISOString();

        const { data, error } = await supabase
            .from("revisiones_cabana")
            .insert({
                fecha,
                cabana_id: cabana.id,
                tipo_revision: TIPO_REVISION,
                estado: "en_proceso",
                resultado: null,
                revisado_por: usuarioId,
                iniciado_en: ahora,
                observaciones: null
            })
            .select(
                "id, fecha, cabana_id, tipo_revision, estado, resultado, observaciones, revisado_por, iniciado_en, finalizado_en, creado_en"
            )
            .single();

        if (error) {
            // Si otra pestaña alcanzó a crear la revisión antes,
            // volvemos a leer antes de mostrar error.
            cacheRevisiones.delete(
                claveRevision(fecha, numeroCabana)
            );

            const recuperada = await buscarRevision(
                fecha,
                numeroCabana,
                cabana.id
            );

            if (recuperada) {
                return recuperada;
            }

            throw error;
        }

        cacheRevisiones.set(
            claveRevision(fecha, numeroCabana),
            data
        );

        return data;
    }

    async function obtenerItemsRevision(revisionId) {
        if (!revisionId) {
            return new Map();
        }

        const supabase = cliente();
        if (!supabase) {
            return new Map();
        }

        const { data, error } = await supabase
            .from("revision_items")
            .select(
                "checklist_item_id, estado, cantidad_esperada, cantidad_encontrada, observacion, revisado_en"
            )
            .eq("revision_id", revisionId);

        if (error) {
            throw error;
        }

        const mapa = new Map();

        (data || []).forEach(item => {
            mapa.set(String(item.checklist_item_id), item);
        });

        return mapa;
    }

    function estadoLegacyDesdeRevision(revision) {
        if (!revision) {
            return "pendiente";
        }

        if (revision.resultado === "lista") {
            return "lista";
        }

        if (
            revision.resultado === "con_detalles" ||
            revision.resultado === "no_lista"
        ) {
            return "con-detalles";
        }

        return "pendiente";
    }

    function actualizarCacheLocal(
        numeroCabana,
        config,
        revision,
        items
    ) {
        const fecha = fechaOperativa();

        if (
            !fecha ||
            typeof obtenerDatosDia !== "function"
        ) {
            return;
        }

        const datos = obtenerDatosDia(fecha);

        if (!datos.cabanas[numeroCabana]) {
            datos.cabanas[numeroCabana] = {};
        }

        const datosCabana = datos.cabanas[numeroCabana];
        const checklist = {};

        config.forEach((cfg, legacyId) => {
            const item = items.get(
                String(cfg.checklist_item_id)
            );

            checklist[legacyId] = item?.estado === "ok";
        });

        datosCabana.checklist = checklist;
        datosCabana.estadoRevision =
            estadoLegacyDesdeRevision(revision);
        datosCabana.detallesRevision =
            revision?.observaciones || "";

        // Estado final del Resumen sigue la revisión.
        if (datosCabana.estadoRevision === "lista") {
            datosCabana.estadoFinal = "LISTA";
        } else if (
            datosCabana.estadoRevision === "con-detalles"
        ) {
            datosCabana.estadoFinal = "CON DETALLES";
        } else {
            datosCabana.estadoFinal = "";
        }

        if (typeof guardarDatos === "function") {
            guardarDatos();
        }
    }

    function aplicarRevisionEnPantalla(
        numeroCabana,
        config,
        revision,
        items
    ) {
        // Si mientras esperábamos el usuario abrió otra CAB,
        // no tocamos su pantalla.
        if (
            String(numeroRevisionAbierta()) !==
            String(numeroCabana)
        ) {
            return;
        }

        const contenedor =
            document.getElementById("revision-checklist");

        if (!contenedor) {
            return;
        }

        contenedor
            .querySelectorAll(
                'input[type="checkbox"][data-checklist-id]'
            )
            .forEach(checkbox => {
                const cfg = config.get(
                    String(checkbox.dataset.checklistId || "")
                );

                if (!cfg) {
                    return;
                }

                const item = items.get(
                    String(cfg.checklist_item_id)
                );

                checkbox.checked = item?.estado === "ok";
            });

        const selectorEstado =
            document.getElementById("revision-estado");

        if (selectorEstado) {
            selectorEstado.value =
                estadoLegacyDesdeRevision(revision);
        }

        const detalles =
            document.getElementById("revision-detalles");

        if (
            detalles &&
            Date.now() >= detallesEditandoHasta
        ) {
            detalles.value = revision?.observaciones || "";
        }
    }

    function refrescarVistasLegacy() {
        const fecha = fechaOperativa();

        if (!fecha) {
            return;
        }

        if (typeof actualizarTarjetasRevision === "function") {
            actualizarTarjetasRevision(fecha);
        }

        if (typeof actualizarResumenAseo === "function") {
            actualizarResumenAseo(fecha);
        }

        if (typeof cargarCabanasDia === "function") {
            // No la llamamos siempre para evitar renderes innecesarios.
            // El estado final se actualiza en las vistas específicas.
        }
    }

    async function guardarItem(
        numeroCabana,
        legacyId,
        checked,
        checkbox
    ) {
        const supabase = cliente();
        if (!supabase) {
            return;
        }

        const cabana = await obtenerCabana(numeroCabana);
        const config = await obtenerConfiguracion(
            numeroCabana,
            cabana.id
        );
        const cfg = config.get(String(legacyId));

        if (!cfg) {
            throw new Error(
                `No existe mapeo Supabase para ${legacyId} en CAB ${numeroCabana}.`
            );
        }

        const revision = await asegurarRevision(numeroCabana);
        const ahora = new Date().toISOString();

        const payload = {
            revision_id: revision.id,
            checklist_item_id: cfg.checklist_item_id,
            estado: checked ? "ok" : "pendiente",
            cantidad_esperada:
                cfg.cantidad_esperada ?? null,
            cantidad_encontrada:
                checked
                    ? (cfg.cantidad_esperada ?? null)
                    : null,
            observacion: null,
            revisado_en: ahora
        };

        const { error } = await supabase
            .from("revision_items")
            .upsert(payload, {
                onConflict: "revision_id,checklist_item_id"
            });

        if (error) {
            throw error;
        }

        // Si una revisión ya estaba cerrada y se modifica un ítem,
        // vuelve a quedar en proceso para no mostrar un resultado viejo.
        if (revision.estado === "completada") {
            const usuarioId = await obtenerUsuarioId();

            const { error: errorRevision } = await supabase
                .from("revisiones_cabana")
                .update({
                    estado: "en_proceso",
                    resultado: null,
                    finalizado_en: null,
                    revisado_por: usuarioId
                })
                .eq("id", revision.id);

            if (errorRevision) {
                throw errorRevision;
            }

            revision.estado = "en_proceso";
            revision.resultado = null;
            revision.finalizado_en = null;

            const selectorEstado =
                document.getElementById("revision-estado");

            if (selectorEstado) {
                selectorEstado.value = "pendiente";
            }

            const fecha = fechaOperativa();
            const datos =
                typeof obtenerDatosDia === "function"
                    ? obtenerDatosDia(fecha)
                    : null;

            if (datos?.cabanas?.[numeroCabana]) {
                datos.cabanas[numeroCabana].estadoRevision =
                    "pendiente";
                datos.cabanas[numeroCabana].estadoFinal = "";

                if (typeof guardarDatos === "function") {
                    guardarDatos();
                }
            }
        }

        if (checkbox) {
            checkbox.dataset.supabaseGuardado = "1";
            setTimeout(() => {
                delete checkbox.dataset.supabaseGuardado;
            }, 800);
        }

        refrescarVistasLegacy();

        document.dispatchEvent(
            new CustomEvent("haiku:revision-item-guardado", {
                detail: {
                    fecha: fechaOperativa(),
                    numeroCabana: String(numeroCabana),
                    legacyId: String(legacyId),
                    checked: Boolean(checked),
                    revisionId: revision.id
                }
            })
        );
    }

    async function guardarEstadoRevision(numeroCabana) {
        const supabase = cliente();
        if (!supabase) {
            return;
        }

        const revision = await asegurarRevision(numeroCabana);
        const selector =
            document.getElementById("revision-estado");
        const detalles =
            document.getElementById("revision-detalles");

        if (!selector) {
            return;
        }

        const valor = selector.value || "pendiente";
        const usuarioId = await obtenerUsuarioId();
        const ahora = new Date().toISOString();

        let estado = "en_proceso";
        let resultado = null;
        let finalizadoEn = null;

        if (valor === "lista") {
            estado = "completada";
            resultado = "lista";
            finalizadoEn = ahora;
        } else if (valor === "con-detalles") {
            estado = "completada";
            resultado = "con_detalles";
            finalizadoEn = ahora;
        }

        const payload = {
            estado,
            resultado,
            finalizado_en: finalizadoEn,
            revisado_por: usuarioId,
            observaciones:
                detalles?.value?.trim() || null
        };

        const { error } = await supabase
            .from("revisiones_cabana")
            .update(payload)
            .eq("id", revision.id);

        if (error) {
            throw error;
        }

        Object.assign(revision, payload);
        refrescarVistasLegacy();
    }

    async function guardarDetallesRevision(numeroCabana) {
        const supabase = cliente();
        if (!supabase) {
            return;
        }

        const detalles =
            document.getElementById("revision-detalles");

        if (!detalles) {
            return;
        }

        const revision = await asegurarRevision(numeroCabana);
        const usuarioId = await obtenerUsuarioId();

        const payload = {
            observaciones: detalles.value.trim() || null,
            revisado_por: usuarioId
        };

        const { error } = await supabase
            .from("revisiones_cabana")
            .update(payload)
            .eq("id", revision.id);

        if (error) {
            throw error;
        }

        Object.assign(revision, payload);
    }

    function instalarListenersRevision(numeroCabana, config) {
        const contenedor =
            document.getElementById("revision-checklist");

        if (contenedor) {
            contenedor
                .querySelectorAll(
                    'input[type="checkbox"][data-checklist-id]'
                )
                .forEach(checkbox => {
                    const legacyId = String(
                        checkbox.dataset.checklistId || ""
                    );

                    if (!config.has(legacyId)) {
                        return;
                    }

                    if (
                        checkbox.dataset.supabaseRevisionListener === "1"
                    ) {
                        return;
                    }

                    checkbox.dataset.supabaseRevisionListener = "1";

                    checkbox.addEventListener("change", async () => {
                        const valorEsperado = checkbox.checked;

                        try {
                            await guardarItem(
                                numeroCabana,
                                legacyId,
                                valorEsperado,
                                checkbox
                            );
                        } catch (error) {
                            console.error(
                                "HAIKU · No fue posible guardar ítem de revisión en Supabase:",
                                error
                            );

                            checkbox.checked = !valorEsperado;
                            alert(
                                "No fue posible guardar este check en Supabase. Intenta nuevamente."
                            );
                        }
                    });
                });
        }

        const selector =
            document.getElementById("revision-estado");

        if (
            selector &&
            selector.dataset.supabaseRevisionListener !== "1"
        ) {
            selector.dataset.supabaseRevisionListener = "1";

            selector.addEventListener("change", async () => {
                const numero = numeroRevisionAbierta();
                if (!numero) {
                    return;
                }

                try {
                    await guardarEstadoRevision(numero);
                } catch (error) {
                    console.error(
                        "HAIKU · No fue posible guardar estado de revisión en Supabase:",
                        error
                    );
                    alert(
                        "No fue posible guardar el estado de la revisión en Supabase."
                    );
                }
            });
        }

        const detalles =
            document.getElementById("revision-detalles");

        if (
            detalles &&
            detalles.dataset.supabaseRevisionListener !== "1"
        ) {
            detalles.dataset.supabaseRevisionListener = "1";

            detalles.addEventListener("input", () => {
                detallesEditandoHasta = Date.now() + 1200;
                clearTimeout(temporizadorDetalles);

                temporizadorDetalles = setTimeout(async () => {
                    const numero = numeroRevisionAbierta();
                    if (!numero) {
                        return;
                    }

                    try {
                        await guardarDetallesRevision(numero);
                    } catch (error) {
                        console.error(
                            "HAIKU · No fue posible guardar detalle de revisión en Supabase:",
                            error
                        );
                    }
                }, 450);
            });
        }
    }

    async function prepararRevision(numeroCabana) {
        const supabase = cliente();
        const fecha = fechaOperativa();

        if (!supabase || !fecha || !numeroCabana) {
            return;
        }

        try {
            const cabana = await obtenerCabana(numeroCabana);
            const config = await obtenerConfiguracion(
                numeroCabana,
                cabana.id
            );
            const revision = await buscarRevision(
                fecha,
                numeroCabana,
                cabana.id
            );
            const items = revision?.id
                ? await obtenerItemsRevision(revision.id)
                : new Map();

            actualizarCacheLocal(
                String(numeroCabana),
                config,
                revision,
                items
            );

            aplicarRevisionEnPantalla(
                String(numeroCabana),
                config,
                revision,
                items
            );

            instalarListenersRevision(
                String(numeroCabana),
                config
            );

            refrescarVistasLegacy();

            console.log(
                "HAIKU · Revisión Supabase cargada:",
                {
                    fecha,
                    cabana: String(numeroCabana),
                    revision: revision?.id || null,
                    items: items.size,
                    configurados: config.size
                }
            );
        } catch (error) {
            console.error(
                "HAIKU · No fue posible cargar revisión desde Supabase:",
                error
            );
        }
    }

    async function sincronizarResumenFecha() {
        if (resumenSincronizando) {
            return;
        }

        const supabase = cliente();
        const fecha = fechaOperativa();

        if (!supabase || !fecha) {
            return;
        }

        resumenSincronizando = true;

        try {
            const { data: cabanas, error: errorCabanas } =
                await supabase
                    .from("cabanas")
                    .select("id, numero, nombre, tipo")
                    .eq("activa", true)
                    .order("numero", { ascending: true });

            if (errorCabanas) {
                throw errorCabanas;
            }

            const idANumero = new Map();
            const ids = [];

            (cabanas || []).forEach(cabana => {
                const numero = String(cabana.numero);
                cacheCabanas.set(numero, cabana);
                idANumero.set(String(cabana.id), numero);
                ids.push(cabana.id);
            });

            if (ids.length === 0) {
                return;
            }

            const { data: revisiones, error: errorRevisiones } =
                await supabase
                    .from("revisiones_cabana")
                    .select(
                        "id, fecha, cabana_id, tipo_revision, estado, resultado, observaciones, revisado_por, iniciado_en, finalizado_en, creado_en"
                    )
                    .eq("fecha", fecha)
                    .eq("tipo_revision", TIPO_REVISION)
                    .neq("estado", "cancelada")
                    .in("cabana_id", ids)
                    .order("creado_en", { ascending: false });

            if (errorRevisiones) {
                throw errorRevisiones;
            }

            const ultimaPorCabana = new Map();

            (revisiones || []).forEach(revision => {
                const cabanaId = String(revision.cabana_id);
                if (!ultimaPorCabana.has(cabanaId)) {
                    ultimaPorCabana.set(cabanaId, revision);
                }
            });

            if (typeof obtenerDatosDia === "function") {
                const datos = obtenerDatosDia(fecha);

                (cabanas || []).forEach(cabana => {
                    const numero = String(cabana.numero);
                    const revision = ultimaPorCabana.get(
                        String(cabana.id)
                    );

                    if (!datos.cabanas[numero]) {
                        datos.cabanas[numero] = {};
                    }

                    datos.cabanas[numero].estadoRevision =
                        estadoLegacyDesdeRevision(revision);
                    datos.cabanas[numero].detallesRevision =
                        revision?.observaciones || "";

                    if (
                        datos.cabanas[numero].estadoRevision ===
                        "lista"
                    ) {
                        datos.cabanas[numero].estadoFinal = "LISTA";
                    } else if (
                        datos.cabanas[numero].estadoRevision ===
                        "con-detalles"
                    ) {
                        datos.cabanas[numero].estadoFinal =
                            "CON DETALLES";
                    } else {
                        datos.cabanas[numero].estadoFinal = "";
                    }

                    const key = claveRevision(fecha, numero);
                    cacheRevisiones.set(key, revision || null);
                });

                if (typeof guardarDatos === "function") {
                    guardarDatos();
                }
            }

            refrescarVistasLegacy();

            const abierta = numeroRevisionAbierta();
            if (abierta) {
                await prepararRevision(abierta);
            }

            console.log(
                "HAIKU · Resumen de revisiones sincronizado desde Supabase:",
                {
                    fecha,
                    revisiones: ultimaPorCabana.size
                }
            );
        } catch (error) {
            console.error(
                "HAIKU · No fue posible sincronizar revisiones desde Supabase:",
                error
            );
        } finally {
            resumenSincronizando = false;
        }
    }

    function instalarPuenteMostrarChecklist() {
        if (
            typeof window.mostrarChecklistCabana !== "function" ||
            window.mostrarChecklistCabana.__haikuSupabaseRevisionV1
        ) {
            return;
        }

        const original = window.mostrarChecklistCabana;

        function puente(numeroCabana) {
            const resultado = original.apply(this, arguments);

            Promise.resolve().then(() => {
                prepararRevision(numeroCabana);
            });

            return resultado;
        }

        puente.__haikuSupabaseRevisionV1 = true;
        window.mostrarChecklistCabana = puente;
    }

    function instalarAutoRefreshAseo() {
        const seccion = document.getElementById("seccion-aseo");

        if (!seccion) {
            return;
        }

        let estabaActiva = seccion.classList.contains("activa");

        const observer = new MutationObserver(() => {
            const activa = seccion.classList.contains("activa");

            if (activa && !estabaActiva) {
                cacheRevisiones.clear();
                sincronizarResumenFecha();
            }

            estabaActiva = activa;
        });

        observer.observe(seccion, {
            attributes: true,
            attributeFilter: ["class"]
        });

        const botonAseo = document.querySelector(
            '.menu-item[data-seccion="aseo"]'
        );

        if (botonAseo) {
            botonAseo.addEventListener("click", () => {
                setTimeout(() => {
                    cacheRevisiones.clear();
                    sincronizarResumenFecha();
                }, 0);
            });
        }

        if (estabaActiva) {
            sincronizarResumenFecha();
        }
    }

    function iniciar() {
        instalarPuenteMostrarChecklist();
        instalarAutoRefreshAseo();

        window.HAIKU_REVISION_SUPABASE_V1 = Object.freeze({
            prepararRevision,
            sincronizarResumenFecha,
            limpiarCache() {
                cacheRevisiones.clear();
                cacheConfig.clear();
            }
        });

        console.log(
            "HAIKU · Puente Supabase activo: Aseo / Revisión V1."
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, {
            once: true
        });
    } else {
        iniciar();
    }
})();
