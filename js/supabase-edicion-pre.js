// ========================================
// HAIKU · SUPABASE · EDICIÓN PRIORITARIA
// Se carga antes del puente de creación para que Editar nunca
// sea interpretado como una reserva nueva.
// ========================================

(() => {
    "use strict";

    const cliente = window.haikuSupabase;
    if (!cliente) return;

    let guardando = false;

    function modoActual() {
        try { return String(modoFormularioReserva || "crear"); }
        catch { return "crear"; }
    }

    function reservaIdActual() {
        try { return String(reservaEditandoId || ""); }
        catch { return ""; }
    }

    function datosFormulario() {
        const titular = document.getElementById("reserva-nuevo-titular")?.value.trim() || "";
        const telefono = document.getElementById("reserva-nuevo-telefono")?.value.trim() || "";
        const rut = document.getElementById("reserva-nuevo-rut")?.value.trim() || "";
        const correo = document.getElementById("reserva-nuevo-correo")?.value.trim() || "";
        const observaciones = document.getElementById("reserva-nueva-observacion")?.value.trim() || "";
        const acompanantes = Array.from(
            document.querySelectorAll(".reserva-nuevo-acompanante")
        ).map(c => c.value.trim()).filter(Boolean);

        let llegada = "";
        let salida = "";
        let cabana = 0;
        let tarifas = {};
        let adultos = 1;
        let ninos = 0;
        let mascotas = 0;

        try { llegada = String(fechaLlegadaReserva || "").slice(0,10); } catch {}
        try { salida = String(fechaSalidaReserva || "").slice(0,10); } catch {}
        try { cabana = Number(cabanaSeleccionadaReserva || 0); } catch {}
        try { tarifas = { ...(tarifasNochesReserva || {}) }; } catch {}
        try { adultos = Number(adultosReserva ?? 1); } catch {}
        try { ninos = Number(ninosReserva ?? 0); } catch {}
        try { mascotas = Number(mascotasReserva ?? 0); } catch {}

        return {
            titular, telefono, rut, correo, observaciones,
            acompanantes, llegada, salida, cabana, tarifas,
            adultos, ninos, mascotas
        };
    }

    function diferenciaDias(inicio, fin) {
        const a = new Date(`${inicio}T12:00:00`);
        const b = new Date(`${fin}T12:00:00`);
        return Math.round((b - a) / 86400000);
    }

    async function estadiaActual(reservaId) {
        const { data, error } = await cliente
            .from("reserva_estadias")
            .select("id,cabana_id,fecha_ingreso,fecha_salida,tipo_estadia,estado_estadia,cabanas(numero)")
            .eq("reserva_id", reservaId)
            .not("estado_estadia", "in", "(cancelada,no_show)")
            .order("creado_en", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async function guardarEdicion(reservaId, datos) {
        if (!window.haikuTienePermiso?.("reservas.editar")) {
            throw new Error("Tu usuario no tiene permiso para editar reservas.");
        }

        const actual = await estadiaActual(reservaId);
        if (!actual) throw new Error("No se encontró la estadía activa de la reserva.");

        const cabActual = Number(actual.cabanas?.numero || 0);
        const ingresoActual = String(actual.fecha_ingreso).slice(0,10);
        const salidaActual = String(actual.fecha_salida).slice(0,10);

        if (datos.cabana !== cabActual || datos.llegada !== ingresoActual) {
            throw new Error(
                "Cambiar de cabaña o mover la fecha de ingreso requiere la función de reasignación. No se guardó ningún cambio."
            );
        }

        if (datos.salida !== salidaActual) {
            const noches = diferenciaDias(datos.llegada, datos.salida);
            if (!Number.isInteger(noches) || noches < 1) {
                throw new Error("La fecha de salida debe dejar al menos 1 noche.");
            }

            const { error: errorNoches } = await cliente.rpc(
                "haiku_actualizar_noches_rapido",
                { p_reserva_id: reservaId, p_noches: noches }
            );
            if (errorNoches) throw errorNoches;
        }

        const { data, error } = await cliente.rpc(
            "haiku_actualizar_reserva",
            {
                p_reserva_id: reservaId,
                p_titular_nombre: datos.titular,
                p_cabana_numero: datos.cabana,
                p_fecha_ingreso: datos.llegada,
                p_fecha_salida: datos.salida,
                p_adultos: Math.max(0, datos.adultos),
                p_ninos: Math.max(0, datos.ninos),
                p_mascotas: Math.max(0, datos.mascotas),
                p_correo_contacto: datos.correo || null,
                p_telefono_contacto: datos.telefono || null,
                p_rut: datos.rut || null,
                p_observaciones: datos.observaciones || null,
                p_tarifas: datos.tarifas,
                p_acompanantes: datos.acompanantes
            }
        );
        if (error) throw error;
        return data;
    }

    document.addEventListener("click", async evento => {
        const boton = evento.target.closest("#crear-nueva-reserva");
        if (!boton || modoActual() !== "editar") return;

        evento.preventDefault();
        evento.stopPropagation();
        evento.stopImmediatePropagation();

        if (guardando) return;

        const reservaId = reservaIdActual();
        const datos = datosFormulario();
        if (!reservaId || !datos.titular || !datos.cabana || !datos.llegada || !datos.salida) {
            alert("Faltan datos obligatorios para guardar la edición.");
            return;
        }

        const texto = boton.textContent;
        guardando = true;
        boton.disabled = true;
        boton.textContent = "Guardando en Supabase…";

        try {
            const resultado = await guardarEdicion(reservaId, datos);
            console.info("HAIKU · Edición guardada en Supabase:", resultado);

            if (typeof window.haikuSincronizarReservasSupabase === "function") {
                await window.haikuSincronizarReservasSupabase();
            }

            document.getElementById("cerrar-nueva-reserva")?.click();
            alert("Reserva actualizada correctamente.");
        } catch (error) {
            console.error("HAIKU · No fue posible guardar edición:", error);
            alert(error?.message || "No fue posible guardar los cambios.");
        } finally {
            guardando = false;
            boton.disabled = false;
            boton.textContent = texto;
        }
    }, true);

    console.info("HAIKU · Edición prioritaria Supabase preparada.");
})();
