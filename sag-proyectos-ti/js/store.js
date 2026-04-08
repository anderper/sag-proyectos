/* =========================================================
   SAG Proyectos TI — Data Store (Local Storage)
   ========================================================= */

const STORAGE_KEY = 'sag_proyectos_data';
const GS_URL = 'https://script.google.com/macros/s/AKfycbwAiDd-aNlT_9kgmdAkImC7d-1znULlBlRdpbCyK2VeqmuI7u584b8keajsdB36_SUQ/exec';

const appStore = {
    data: {
        catalogos: {},
        proyectos: [],
        seguimientos: [],
        riesgos: [],
        hitos: []
    },
    isSyncing: false,

    // 1. Inicialización asíncrona (vía Google Sheets)
    initData: async function(forceReset = false) {
        if (forceReset) {
            localStorage.removeItem(STORAGE_KEY);
        }

        // Recuperar sesión local rápida
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                this.data = { ...this.data, ...parsed };
            } catch (e) {
                console.error("Error parseando LocalStorage", e);
            }
        }
        
        // Si no hay datos en absoluto (ni local ni catálogo), cargar demo como base temporal
        if (!this.data.catalogos.sistemas) {
            this.loadInitialData();
        }

        // Sincronizar todo desde la nube (incluyendo catálogos)
        await this.syncFromCloud();
        
        this.updateRiesgosBadge();
    },

    syncFromCloud: async function() {
        this.isSyncing = true;
        try {
            // Sincronizar Catálogos (Configuración)
            const cRes = await fetch(`${GS_URL}?sheet=Catalogos`);
            const cData = await cRes.json();
            if (cData && Array.isArray(cData) && cData.length > 0) {
                // El Excel devuelve filas, tenemos que reconstruir el objeto de catálogos
                this.data.catalogos.sistemas = cData.map(r => r.Sistemas).filter(x => x);
                this.data.catalogos.coordinadores = cData.map(r => r.Coordinadores).filter(x => x);
                this.data.catalogos.unidadesUsuarias = cData.map(r => r.UnidadUsuaria).filter(x => x);
                this.data.catalogos.proveedores = cData.map(r => r.Proveedores).filter(x => x);
                this.data.catalogos.estados = cData.map(r => r.Estados).filter(x => x);
            }

            // Sincronizar Proyectos
            const pRes = await fetch(`${GS_URL}?sheet=Proyectos`);
            const pData = await pRes.json();
            if (pData && Array.isArray(pData)) {
                this.data.proyectos = pData;
            }

            // Sincronizar Seguimientos
            const sRes = await fetch(`${GS_URL}?sheet=Seguimientos`);
            const sData = await sRes.json();
            if (sData && Array.isArray(sData)) {
                this.data.seguimientos = sData;
            }

            // Sincronizar Riesgos
            const rRes = await fetch(`${GS_URL}?sheet=Riesgos`);
            const rData = await rRes.json();
            if (rData && Array.isArray(rData)) {
                this.data.riesgos = rData;
            }

            this.saveLocally();
        } catch (e) {
            console.warn("Falla de sincronización cloud (usando locales):", e);
        } finally {
            this.isSyncing = false;
        }
    },

    saveLocally: function() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.updateRiesgosBadge();
    },

    save: function() {
        this.saveLocally();
    },

    saveToCloud: async function(sheetName, data, action = 'insert') {
        try {
            await fetch(GS_URL, {
                method: 'POST',
                mode: 'no-cors', // Necesario para Google Apps Script
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheet: sheetName, action: action, data: data })
            });
        } catch (e) {
            console.error("Error al guardar en la nube:", e);
        }
    },

    uploadGantt: async function(projectId, fileData) {
        // fileData: { fileName, contentType, base64 }
        try {
            // Usamos mode: 'no-cors' para evitar errores de seguridad del navegador.
            // La respuesta será opaca, pero el servidor procesará el archivo
            // porque estamos enviando el projectId para que lo guarde.
            await fetch(GS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'upload_gantt', 
                    data: { ...fileData, projectId: projectId } 
                })
            });
            
            // Retornamos éxito manual ya que no podemos leer la respuesta opaca,
            // confiamos en que el servidor lo procesó (fallará solo si hay red down).
            return { success: true, detail: "Enviado a procesar..." };
        } catch (e) {
            console.error("Error en uploadGantt:", e);
            return { error: "Error de red", detail: e.message };
        }
    },

    saveCatalogosToCloud: async function() {
        const cats = this.data.catalogos;
        const maxLen = Math.max(
            (cats.sistemas||[]).length, 
            (cats.coordinadores||[]).length, 
            (cats.unidadesUsuarias||[]).length, 
            (cats.proveedores||[]).length,
            (cats.estados||[]).length
        );

        // Limpiar pestaña antes de subir (vía Apps Script esto es insert masivo)
        // Por simplicidad en esta demo, enviamos fila por fila o un bloque
        for (let i = 0; i < maxLen; i++) {
            const rowData = {
                id: `cat-${i}`, // Necesario para la lógica de búsqueda/update del script
                Sistemas: (cats.sistemas||[])[i] || "",
                Coordinadores: (cats.coordinadores||[])[i] || "",
                UnidadUsuaria: (cats.unidadesUsuarias||[])[i] || "",
                Proveedores: (cats.proveedores||[])[i] || "",
                Estados: (cats.estados||[])[i] || ""
            };
            await this.saveToCloud('Catalogos', rowData, i === 0 ? 'insert' : 'insert'); 
            // Nota: En una versión pro limpiaríamos la hoja primero, aquí simplemente acumulamos o actualizamos
        }
    },

    loadInitialData: function() {
        // defined in data.js
        this.data = JSON.parse(JSON.stringify(initialData)); 
        this.save();
    },

    save: function() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.updateRiesgosBadge();
    },

    updateRiesgosBadge: function() {
        const bdg = document.getElementById('badge-riesgos');
        if(!bdg) return;
        
        const abiertosActivos = this.data.riesgos.filter(r => r.estado === 'Abierto' && r.impacto === 'Alto');
        if (abiertosActivos.length > 0) {
            bdg.textContent = abiertosActivos.length;
            bdg.style.display = 'inline-block';
        } else {
            bdg.style.display = 'none';
        }
    },

    // --- 2. Operaciones Proyectos ---
    getProyectos: function(filters = {}) {
        let result = [...this.data.proyectos];

        if (filters.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(p => 
                p.nombre.toLowerCase().includes(q) || 
                p.sistema.toLowerCase().includes(q) ||
                p.coordinador.toLowerCase().includes(q)
            );
        }
        if (filters.estado && filters.estado !== 'Todos') {
            result = result.filter(p => p.estado === filters.estado);
        }
        if (filters.coordinador && filters.coordinador !== 'Todos') {
            result = result.filter(p => p.coordinador === filters.coordinador);
        }
        if (filters.semaforo && filters.semaforo !== 'Todos') {
            result = result.filter(p => p.semaforo === filters.semaforo);
        }
        
        return result;
    },

    getProyecto: function(id) {
        return this.data.proyectos.find(p => p.id === id);
    },

    saveProyecto: function(proyecto) {
        const isNew = !proyecto.id;
        
        // Recalcular semáforo si está salvando
        const riesgosAsociados = this.getRiesgosByProyecto(proyecto.id);
        
        // Actualizamos o asignamos semáforo
        if(!isNew) {
            proyecto.semaforo = calcularSemaforo(proyecto, riesgosAsociados);
        } else {
            // Un proyecto nuevo arranca verde generalmente
            proyecto.semaforo = 'Verde';
            proyecto.id = 'prj-' + crypto.randomUUID().slice(0, 8);
            proyecto.fecha_ultima_actualizacion = getCurrentDate();
            proyecto.porcentaje_avance = 0;
            if(!proyecto.estado) proyecto.estado = 'Planificado';
        }

        if (isNew) {
            this.data.proyectos.push(proyecto);
            this.saveToCloud('Proyectos', proyecto, 'insert');
        } else {
            const index = this.data.proyectos.findIndex(p => p.id === proyecto.id);
            if (index !== -1) {
                this.data.proyectos[index] = proyecto;
                this.saveToCloud('Proyectos', proyecto, 'update');
            }
        }
        
        this.saveLocally();
        return proyecto;
    },

    deleteProyecto: function(id) {
        // Borramos en Nube
        this.saveToCloud('Proyectos', {id: id}, 'delete');
        
        // Borramos localmente
        this.data.proyectos = this.data.proyectos.filter(p => p.id !== id);
        this.data.seguimientos = this.data.seguimientos.filter(s => s.proyecto_id !== id);
        this.data.riesgos = this.data.riesgos.filter(r => r.proyecto_id !== id);
        this.data.hitos = this.data.hitos.filter(h => h.proyecto_id !== id);
        
        this.saveLocally();
    },

    // --- 3. Operaciones Seguimiento ---
    getSeguimientosByProyecto: function(proyectoId) {
        return this.data.seguimientos
            .filter(s => s.proyecto_id === proyectoId)
            .sort((a, b) => new Date(b.fecha_reporte) - new Date(a.fecha_reporte));
    },

    saveSeguimiento: function(seguimiento) {
        if (!seguimiento.id) {
            seguimiento.id = 'seg-' + crypto.randomUUID().slice(0, 8);
            this.data.seguimientos.push(seguimiento);
            this.saveToCloud('Seguimientos', seguimiento, 'insert');
        } else {
            const idx = this.data.seguimientos.findIndex(s => s.id === seguimiento.id);
            if (idx !== -1) {
                this.data.seguimientos[idx] = seguimiento;
                this.saveToCloud('Seguimientos', seguimiento, 'update');
            }
        }

        // Al crear un seguimiento, actualizamos la fecha del proyecto y su % avance si viene definido
        const prj = this.getProyecto(seguimiento.proyecto_id);
        if (prj) {
            prj.fecha_ultima_actualizacion = seguimiento.fecha_reporte;
            if(seguimiento.avance_acumulado) {
                prj.porcentaje_avance = parseInt(seguimiento.avance_acumulado.replace('%', ''), 10) || prj.porcentaje_avance;
            }
            this.saveProyecto(prj); // recalcula semaforo auto y guarda en nube
        }

        this.saveLocally();
    },

    // --- 4. Operaciones Riesgos ---
    getRiesgosByProyecto: function(proyectoId) {
        return this.data.riesgos.filter(r => r.proyecto_id === proyectoId);
    },

    getAllRiesgos: function(filters = {}) {
        let res = [...this.data.riesgos];
        if(filters.estado && filters.estado !== 'Todos') res = res.filter(r => r.estado === filters.estado);
        if(filters.tipo && filters.tipo !== 'Todos') res = res.filter(r => r.tipo === filters.tipo);
        return res.sort((a, b) => new Date(b.fecha_compromiso) - new Date(a.fecha_compromiso));
    },

    saveRiesgo: function(riesgo) {
        if (!riesgo.id) {
            riesgo.id = 'rsk-' + crypto.randomUUID().slice(0, 8);
            this.data.riesgos.push(riesgo);
            this.saveToCloud('Riesgos', riesgo, 'insert');
        } else {
            const idx = this.data.riesgos.findIndex(r => r.id === riesgo.id);
            if (idx !== -1) {
                this.data.riesgos[idx] = riesgo;
                this.saveToCloud('Riesgos', riesgo, 'update');
            }
        }

        // Recalcular semáforo del proyecto asociado
        const prj = this.getProyecto(riesgo.proyecto_id);
        if (prj) this.saveProyecto(prj);

        this.saveLocally();
    },

    // --- 5. Operaciones Hitos ---
    getHitosByProyecto: function(proyectoId) {
        return this.data.hitos
            .filter(h => h.proyecto_id === proyectoId)
            .sort((a, b) => new Date(a.fecha_planificada) - new Date(b.fecha_planificada));
    },

    saveHito: function(hito) {
        const isNew = !hito.id;
        if (isNew) {
            hito.id = 'ht-' + crypto.randomUUID().slice(0, 8);
            this.data.hitos.push(hito);
            this.saveToCloud('Hitos', hito, 'insert');
        } else {
            const idx = this.data.hitos.findIndex(h => h.id === hito.id);
            if (idx !== -1) {
                this.data.hitos[idx] = hito;
                this.saveToCloud('Hitos', hito, 'update');
            }
        }

        // Recalcular % de avance basado en hitos completados vs planificados
        const hitos = this.getHitosByProyecto(hito.proyecto_id);
        let totalPeso = 0;
        let pctCompletado = 0;
        
        hitos.forEach(h => {
             const peso = parseFloat(h.peso_porcentual) || 0;
             totalPeso += peso;
             if(h.estado === 'Completado') {
                 pctCompletado += peso;
             }
        });

        // Si la suma de pesos es 100, actualizamos el % de avance en base a los hitos
        if(Math.abs(totalPeso - 100) < 0.1) {
             const prj = this.getProyecto(hito.proyecto_id);
             if(prj) {
                 prj.porcentaje_avance = Math.round(pctCompletado);
                 this.saveProyecto(prj);
             }
        }

        this.saveLocally();
    },
    
    deleteHito: function(id) {
        this.saveToCloud('Hitos', {id: id}, 'delete');
        this.data.hitos = this.data.hitos.filter(h => h.id !== id);
        this.saveLocally();
    },

    // --- 6. Analytics (Dashboard) ---
    getDashboardStats: function() {
        const prjs = this.data.proyectos;
        const total = prjs.length;
        if(total === 0) return null;

        const activos = prjs.filter(p => !['Finalizado','Cancelado'].includes(p.estado));
        const finalizados = prjs.filter(p => p.estado === 'Finalizado').length;
        
        const atrasados = activos.filter(p => {
             if(!p.fecha_fin_planificada) return false;
             return new Date(p.fecha_fin_planificada) < new Date();
        }).length;

        const semaforos = {
             verde: activos.filter(p => p.semaforo === 'Verde').length,
             amarillo: activos.filter(p => p.semaforo === 'Amarillo').length,
             rojo: activos.filter(p => p.semaforo === 'Rojo').length
        };

        const tiposObj = prjs.reduce((acc, p) => { acc[p.tipo_desarrollo] = (acc[p.tipo_desarrollo]||0)+1; return acc; }, {});
        const estadosObj = prjs.reduce((acc, p) => { acc[p.estado] = (acc[p.estado]||0)+1; return acc; }, {});

        let avanceSum = 0;
        activos.forEach(p => avanceSum += (p.porcentaje_avance || 0));
        const avancePromedio = activos.length ? Math.round(avanceSum / activos.length) : 0;

        // Próximos a vencer (en los siguientes 30 días)
        const proximos = activos.filter(p => {
            if(!p.fecha_fin_planificada) return false;
            const diffDias = getDaysSince(p.fecha_fin_planificada) * -1; // negativos son en el futuro
            return diffDias >= 0 && diffDias <= 30;
        }).sort((a,b) => new Date(a.fecha_fin_planificada) - new Date(b.fecha_fin_planificada));

        const proveedoresObj = activos
            .filter(p => p.proveedor && p.proveedor !== 'Interno')
            .reduce((acc, p) => { acc[p.proveedor] = (acc[p.proveedor]||0)+1; return acc; }, {});

        return {
            total,
            activos: activos.length,
            finalizados,
            atrasados,
            semaforos,
            avancePromedio,
            proximos,
            graficoTipos: Object.keys(tiposObj).map(k => ({name: k, value: tiposObj[k]})),
            graficoEstados: Object.keys(estadosObj).map(k => ({name: k, value: estadosObj[k]})),
            graficoProveedores: Object.keys(proveedoresObj).map(k => ({name: k, value: proveedoresObj[k]}))
        };
    }
};

// Auto-init al cargar el archivo
appStore.initData();
