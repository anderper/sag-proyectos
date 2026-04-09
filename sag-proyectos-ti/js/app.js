/* =========================================================
   SAG Proyectos TI — Application Logic & Routing
   ========================================================= */

// --- Global App State ---
const APP = {
    currentRoute: '',
    chartInstances: {}
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Mostrar estado de carga si es necesario
    console.log("Iniciando sincronización con la nube...");
    
    // Inicializar datos (asíncrono ahora)
    await appStore.initData();

    // Setup routing
    window.addEventListener('hashchange', handleRoute);
    
    // Initial route
    if (!window.location.hash) {
        window.location.hash = '#/dashboard';
    } else {
        handleRoute();
    }
});

// --- Sidebar Toggle ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// Close sidebar on click out for mobile
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.sidebar-toggle');
    if (window.innerWidth <= 900 && 
        !sidebar.contains(e.target) && 
        !toggleBtn.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});

// --- Routing System ---
function handleRoute() {
    const hash = window.location.hash.replace('#', '');
    APP.currentRoute = hash;
    
    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (hash.startsWith(item.getAttribute('data-route'))) {
            item.classList.add('active');
        }
    });

    if (window.innerWidth <= 900) {
        document.getElementById('sidebar').classList.remove('open');
    }

    renderView();
}

function navigateTo(hash) {
    window.location.hash = hash;
}

// --- View Renderer ---
function renderView() {
    const content = document.getElementById('app-content');
    const title = document.getElementById('topbar-title');
    
    // Cleanup old charts
    Object.keys(APP.chartInstances).forEach(k => {
        if (APP.chartInstances[k]) {
            APP.chartInstances[k].destroy();
        }
    });
    APP.chartInstances = {};

    let html = '';
    
    if (APP.currentRoute === '/dashboard' || APP.currentRoute === '') {
        title.textContent = 'Dashboard Ejecutivo';
        html = renderDashboard();
    } 
    else if (APP.currentRoute === '/proyectos') {
        title.textContent = 'Gestión de Proyectos';
        html = renderProyectosList();
    }
    else if (APP.currentRoute.startsWith('/proyectos/detalle/')) {
        const id = APP.currentRoute.split('/').pop();
        title.textContent = 'Detalle de Proyecto';
        html = renderProyectoDetalle(id);
    }
    else if (APP.currentRoute === '/seguimiento') {
        title.textContent = 'Seguimiento Semanal';
        html = renderSeguimientos();
    }
    else if (APP.currentRoute === '/riesgos') {
        title.textContent = 'Riesgos y Problemas';
        html = renderRiesgos();
    }
    else if (APP.currentRoute === '/admin') {
        title.textContent = 'Administración de Catálogos';
        html = renderAdmin();
    }
    else {
        html = `
            <div class="empty-state">
                <i class="ph ph-mask-sad empty-icon"></i>
                <h3>Página no encontrada</h3>
                <p>La sección solicitada no existe o está en construcción.</p>
                <button class="btn btn-primary mt-16" onclick="navigateTo('#/dashboard')">Ir al Dashboard</button>
            </div>
        `;
    }

    content.innerHTML = html;

    // Post-render actions (like charting)
    setTimeout(() => {
        if (APP.currentRoute === '/dashboard' || APP.currentRoute === '') {
            initDashboardCharts();
        }
    }, 50);
}

// =========================================================
// VIEWS CALLED BY ROUTER
// =========================================================

// --- Dashboard ---
function renderDashboard() {
    const stats = appStore.getDashboardStats();
    
    if (!stats) return `<div class="empty-state">No hay datos</div>`;

    const totalProximosVencer = stats.hitosProximos ? stats.hitosProximos.length : 0;
    const totalAtrasados = stats.hitosAtrasados ? stats.hitosAtrasados.length : 0;
    const tieneAlertas = totalProximosVencer > 0 || totalAtrasados > 0;

    return `
        <div class="kpi-grid">
            <div class="kpi-card" style="--kpi-accent: var(--sag-green);">
                <i class="material-icons-round kpi-icon">rocket_launch</i>
                <div class="kpi-label">Proyectos Activos</div>
                <div class="kpi-value">${stats.activos}</div>
            </div>
            
            <div class="kpi-card" style="--kpi-accent: var(--est-en-curso);">
                <i class="material-icons-round kpi-icon">trending_up</i>
                <div class="kpi-label">Avance Promedio</div>
                <div class="kpi-value">${stats.avancePromedio}%</div>
            </div>

            <div class="kpi-card${(stats.riesgosAbiertos && stats.riesgosAbiertos.length > 0) ? ' kpi-card-alerta' : ''}" style="--kpi-accent: var(--sag-naranja);">
                <i class="material-icons-round kpi-icon${(stats.riesgosAbiertos && stats.riesgosAbiertos.length > 0) ? ' kpi-icon-alerta' : ''}">warning</i>
                <div class="kpi-label">Riesgos</div>
                <div class="kpi-value">${stats.riesgosAbiertos ? stats.riesgosAbiertos.length : 0}</div>
            </div>

            <div class="kpi-card${totalProximosVencer > 0 ? ' kpi-card-alerta' : ''}" style="--kpi-accent: var(--sem-amarillo);">
                <i class="material-icons-round kpi-icon${totalProximosVencer > 0 ? ' kpi-icon-alerta' : ''}">event_busy</i>
                <div class="kpi-label">Hitos Próximos a Vencer</div>
                <div class="kpi-value">${totalProximosVencer}</div>
            </div>

            <div class="kpi-card${totalAtrasados > 0 ? ' kpi-card-alerta' : ''}" style="--kpi-accent: var(--sem-rojo);">
                <i class="material-icons-round kpi-icon${totalAtrasados > 0 ? ' kpi-icon-alerta' : ''}">report_problem</i>
                <div class="kpi-label">Hitos Vencidos</div>
                <div class="kpi-value">${totalAtrasados}</div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-container">
                <h3>Empresas Externas</h3>
                <p>Proyectos por proveedor (Externo/Mixto)</p>
                <div style="height: 220px; position:relative;">
                    <canvas id="chart-proveedores"></canvas>
                </div>
            </div>
            
            <div class="chart-container">
                <h3>Proyectos por Estado</h3>
                <p>Fases actuales de los proyectos</p>
                <div style="height: 220px; position:relative;">
                    <canvas id="chart-estados"></canvas>
                </div>
            </div>

            <div class="chart-container">
                <h3>Tipo de Desarrollo</h3>
                <p>Equipos internos vs proveedores externos</p>
                <div style="height: 220px; position:relative;">
                    <canvas id="chart-tipos"></canvas>
                </div>
            </div>
        </div>
    `;
}

function initDashboardCharts() {
    const stats = appStore.getDashboardStats();
    if (!stats) return;

    // Colores institucionales del CSS para Chart.js
    const rootStyles = getComputedStyle(document.documentElement);
    const chartPalette = [
        rootStyles.getPropertyValue('--chart-1').trim(),
        rootStyles.getPropertyValue('--chart-2').trim(),
        rootStyles.getPropertyValue('--chart-3').trim(),
        rootStyles.getPropertyValue('--chart-4').trim(),
        rootStyles.getPropertyValue('--chart-5').trim(),
        rootStyles.getPropertyValue('--chart-6').trim(),
        rootStyles.getPropertyValue('--chart-7').trim(),
        rootStyles.getPropertyValue('--chart-8').trim(),
    ];

    // 1. Proveedores Externos
    const ctxProv = document.getElementById('chart-proveedores').getContext('2d');
    const provLabels = stats.graficoProveedores.map(g => g.name);
    const provData = stats.graficoProveedores.map(g => g.value);
    
    APP.chartInstances['proveedores'] = new Chart(ctxProv, {
        type: 'doughnut',
        data: {
            labels: provLabels,
            datasets: [{
                data: provData,
                backgroundColor: chartPalette,
                borderWidth: 1,
                borderColor: '#ffffff'
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            cutout: '65%', 
            plugins: { 
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw} Proyectos`;
                        }
                    }
                }
            } 
        }
    });

    // 2. Estados
    const ctxEst = document.getElementById('chart-estados').getContext('2d');
    APP.chartInstances['estados'] = new Chart(ctxEst, {
        type: 'bar',
        data: {
            labels: stats.graficoEstados.map(g => g.name),
            datasets: [{
                label: 'Proyectos',
                data: stats.graficoEstados.map(g => g.value),
                backgroundColor: chartPalette,
                borderRadius: 4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            } 
        }
    });

    // 3. Tipos Desarrollo
    const ctxTip = document.getElementById('chart-tipos').getContext('2d');
    APP.chartInstances['tipos'] = new Chart(ctxTip, {
        type: 'pie',
        data: {
            labels: stats.graficoTipos.map(g => g.name),
            datasets: [{
                data: stats.graficoTipos.map(g => g.value),
                backgroundColor: [chartPalette[0], chartPalette[2], chartPalette[4]],
                borderWidth: 1,
                borderColor: '#ffffff'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

// --- Dashboard: Panel de Hitos y Riesgos (Próximos y Atrasados) ---
function renderDashboardHitosAlerta(stats) {
    const hitosProximos = stats.hitosProximos || [];
    const hitosAtrasados = stats.hitosAtrasados || [];
    
    if (hitosProximos.length === 0 && hitosAtrasados.length === 0) return '';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Función helper para cada fila
    const renderFilaHito = (h, esAtrasado) => {
        const proyecto = appStore.getProyecto(h.proyecto_id);
        if (!h.fecha_fin) return '';
        
        const parts = h.fecha_fin.split('-');
        const fechaFinDate = new Date(parts[0], parts[1] - 1, parts[2]);
        const diffDias = esAtrasado 
            ? Math.ceil((hoy - fechaFinDate) / (1000 * 60 * 60 * 24))
            : Math.ceil((fechaFinDate - hoy) / (1000 * 60 * 60 * 24));
        
        let urgenciaClass = '';
        let urgenciaLabel = '';
        
        if (esAtrasado) {
            urgenciaClass = 'badge-rojo';
            urgencyLabel = `Atrasado ${diffDias === 1 ? '1 día' : diffDias + ' días'}`;
        } else if (diffDias <= 7) {
            urgencyClass = 'badge-rojo';
            urgenciaLabel = `${diffDias === 0 ? 'Vence hoy' : diffDias === 1 ? 'Mañana' : `En ${diffDias} días`}`;
        } else if (diffDias <= 15) {
            urgenciaClass = 'badge-amarillo';
            urgenciaLabel = `En ${diffDias} días`;
        } else {
            urgenciaClass = 'badge-proximo-vencer';
            urgenciaLabel = `En ${diffDias} días`;
        }

        return `
            <tr>
                <td>
                    <div class="td-bold">${h.nombre}</div>
                    <div class="td-small">${proyecto ? proyecto.nombre : 'Proyecto desconocido'}</div>
                </td>
                <td class="text-sm">${proyecto ? proyecto.coordinador : '-'}</td>
                <td>
                    <span class="flex items-center gap-4 text-sm" style="color: var(--sem-amarillo); font-weight:600;">
                        <i class="material-icons-round" style="font-size:16px;">play_circle_outline</i>
                        ${formatDate(h.fecha_inicio)}
                    </span>
                </td>
                <td>
                    <span class="flex items-center gap-4 text-sm font-bold" style="${esAtrasado || diffDias <= 7 ? 'color:var(--sem-rojo)' : 'color:var(--sem-amarillo)'}">
                        <i class="material-icons-round" style="font-size:16px;">flag</i>
                        ${formatDate(h.fecha_fin)}
                    </span>
                </td>
                <td>
                    <span class="badge ${urgenciaClass}">
                        <i class="material-icons-round" style="font-size:13px; vertical-align:middle;">${esAtrasado ? 'warning' : 'alarm'}</i>
                        ${urgenciaLabel}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="navigateTo('#/proyectos/detalle/${h.proyecto_id}'); window.currentTabId='tab-hitos';">
                        Ver Hito
                    </button>
                </td>
            </tr>
        `;
    };

    // Combinar atrasados primero, luego proximos
    const filasAtrasados = hitosAtrasados.map(h => renderFilaHito(h, true)).join('');
    const filasProximos = hitosProximos.map(h => renderFilaHito(h, false)).join('');
    const total = hitosAtrasados.length + hitosProximos.length;

    return `
        <div class="card mb-24">
            <div class="card-header" style="border-left: 4px solid ${hitosAtrasados.length > 0 ? 'var(--sem-rojo)' : 'var(--sem-amarillo)'};">
                <div class="flex items-center gap-8">
                    <i class="material-icons-round" style="color: ${hitosAtrasados.length > 0 ? 'var(--sem-rojo)' : 'var(--sem-amarillo)'}; font-size: 22px;">${hitosAtrasados.length > 0 ? 'warning' : 'alarm'}</i>
                    <h3>Hitos con Alerta
                        <span class="badge ${hitosAtrasados.length > 0 ? 'badge-rojo' : 'badge-amarillo'} ml-8" style="font-size:12px; vertical-align:middle;">${total}</span>
                    </h3>
                </div>
                <p class="text-sm text-muted mt-4">
                    ${hitosAtrasados.length > 0 ? `<span style="color:var(--sem-rojo); font-weight:600;">${hitosAtrasados.length} hito${hitosAtrasados.length !== 1 ? 's' : ''} atrasado${hitosAtrasados.length !== 1 ? 's' : ''}</span>` : ''}
                    ${hitosAtrasados.length > 0 && hitosProximos.length > 0 ? ' · ' : ''}
                    ${hitosProximos.length > 0 ? `${hitosProximos.length} hito${hitosProximos.length !== 1 ? 's' : ''} proximo${hitosProximos.length !== 1 ? 's' : ''} a vencer` : ''}
                </p>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre del Hito</th>
                            <th>Coordinador</th>
                            <th>Fecha Inicio</th>
                            <th>Fecha Fin</th>
                            <th>Urgencia</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasAtrasados}
                        ${filasProximos}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// --- Proyectos ---
function renderProyectosList() {
    return `
        <div class="filters-bar" id="proyectos-filters">
            <div class="search-wrap">
                <i class="material-icons-round search-icon">search</i>
                <input type="text" class="search-input" id="filtro-busqueda" placeholder="Buscar por nombre o sistema..." onkeyup="filtrarProyectos()">
            </div>
            
            <div class="filter-group">
                <select class="filter-control" id="filtro-estado" onchange="filtrarProyectos()">
                    <option value="Todos">Todos los Estados</option>
                    ${appStore.data.catalogos.estados.map(e => `<option value="${e}">${e}</option>`).join('')}
                </select>
            </div>
            
            <div class="filter-group">
                <select class="filter-control" id="filtro-semaforo" onchange="filtrarProyectos()">
                    <option value="Todos">Todos los Semáforos</option>
                    <option value="Verde">Verde</option>
                    <option value="Amarillo">Amarillo</option>
                    <option value="Rojo">Rojo</option>
                </select>
            </div>
            
            <div class="filter-actions">
                <button class="btn btn-secondary btn-export" onclick="exportarProyectosExcel()">
                    <i class="material-icons-round">description</i> Exportar
                </button>
                <button class="btn btn-primary" onclick="abrirModalFormProyecto()">
                    <i class="material-icons-round">add</i> Nuevo Proyecto
                </button>
            </div>
        </div>

        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre del Proyecto</th>
                            <th>Semáforo</th>
                            <th>Estado</th>
                            <th>Avance</th>
                            <th>Coordinador</th>
                            <th>Fecha Fin</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="proyectos-tbody">
                        ${renderProyectosTableRows(appStore.getProyectos())}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderProyectosTableRows(proyectos) {
    if (proyectos.length === 0) return `<tr><td colspan="7" class="text-center" style="padding:40px;">No se encontraron proyectos.</td></tr>`;
    
    return proyectos.map(p => `
        <tr onclick="navigateTo('#/proyectos/detalle/${p.id}')">
            <td>
                <div class="td-bold">${p.nombre}</div>
                <div class="td-small">${p.sistema} • ${p.unidad_usuaria}</div>
            </td>
            <td>${renderBadgeSemaforo(p.semaforo)}</td>
            <td>${renderBadgeEstado(p.estado)}</td>
            <td style="width: 140px;">${renderProgressBar(p.porcentaje_avance, p.semaforo)}</td>
            <td>${p.coordinador}</td>
            <td>
                <div class="${getDaysSince(p.fecha_fin_planificada) < 0 && getDaysSince(p.fecha_fin_planificada) > -30 ? 'text-secondary font-bold' : ''}">
                    ${formatDate(p.fecha_fin_planificada)}
                </div>
            </td>
            <td onclick="event.stopPropagation()">
                <div class="flex gap-4">
                    <button class="btn btn-icon" onclick="abrirModalFormProyecto('${p.id}')" data-tooltip="Editar"><i class="material-icons-round">edit</i></button>
                    ${p.carta_gantt_url ? `<button class="btn btn-icon text-primary" onclick="window.open('${p.carta_gantt_url}', '_blank')" data-tooltip="Ver Carta Gantt"><i class="material-icons-round">analytics</i></button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

window.filtrarProyectos = function() {
    const search = document.getElementById('filtro-busqueda').value;
    const estado = document.getElementById('filtro-estado').value;
    const semaforo = document.getElementById('filtro-semaforo').value;
    
    const res = appStore.getProyectos({ search, estado, semaforo });
    document.getElementById('proyectos-tbody').innerHTML = renderProyectosTableRows(res);
};

window.exportarProyectosExcel = function() {
    const proyectos = appStore.getProyectos();
    const dataAExportar = proyectos.map(p => ({
        ID: p.id,
        Nombre: p.nombre,
        Semaforo: p.semaforo,
        Estado: p.estado,
        Avance: `${p.porcentaje_avance}%`,
        Coordinador: p.coordinador,
        Proveedor: p.proveedor,
        Tipo: p.tipo_proyecto,
        Fecha_Inicio_Plan: formatDate(p.fecha_inicio_planificada),
        Fecha_Fin_Plan: formatDate(p.fecha_fin_planificada)
    }));
    exportToExcel(dataAExportar, 'SAG_Proyectos_TI');
};

// --- Formulario de Proyecto ---
window.abrirModalFormProyecto = function(id = null) {
    let p = {
        id: 'prj-' + Date.now(), // ID temporal para nuevos proyectos
        nombre: '', sistema: '', descripcion: '', categoria: '', division_departamento: 'División TI',
        unidad_usuaria: '', responsable_usuario: '', coordinador: '', tipo_proyecto: 'Nuevo',
        tipo_desarrollo: 'Interno', proveedor: '', equipo_proveedor: '', fecha_inicio_planificada: '', fecha_fin_planificada: '',
        inicio_contrato: '', fin_contrato: '', estado: 'Planificado', prioridad: 'Media', criticidad: 'Media'
    };
    
    if (id) {
        const exist = appStore.getProyecto(id);
        if (exist) p = {...exist};
    }

    const { catalogos } = appStore.data;
    const cSelect = (arr, val) => (arr || []).map(x => x ? `<option value="${x}" ${val === x ? 'selected':''}>${x}</option>` : '').join('');

    const html = `
        <div class="modal-overlay">
            <div class="modal modal-lg">
                <div class="modal-header">
                    <h2>${id ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
                    <button class="btn btn-icon" onclick="closeModal()"><i class="material-icons-round">close</i></button>
                </div>
                <div class="modal-body">
                    <form id="form-proyecto" class="form-grid-3">
                        <div class="form-group form-full">
                            <label class="form-label">Nombre del Proyecto <span class="required">*</span></label>
                            <input type="text" class="form-control" id="f-nombre" required value="${p.nombre}">
                        </div>
                        
                        <div class="form-group form-full">
                            <label class="form-label">Descripción</label>
                            <textarea class="form-control" id="f-descripcion">${p.descripcion}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Sistema Asociado <span class="required">*</span></label>
                            <select class="form-control" id="f-sistema" required>
                                ${cSelect(catalogos.sistemas, p.sistema)}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Coordinador TI <span class="required">*</span></label>
                            <select class="form-control" id="f-coordinador" required>
                                ${cSelect(catalogos.coordinadores, p.coordinador)}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Unidad Usuaria <span class="required">*</span></label>
                            <select class="form-control" id="f-unidad" required>
                                ${cSelect(catalogos.unidadesUsuarias, p.unidad_usuaria)}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Responsable Unidad (Contraparte)</label>
                            <input type="text" class="form-control" id="f-responsable-usuario" value="${p.responsable_usuario || ''}" placeholder="Nombre de la persona...">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Tipo Proyecto</label>
                            <select class="form-control" id="f-tipo">
                                ${cSelect(["Nuevo", "Mejora", "Correctivo"], p.tipo_proyecto)}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Tipo Desarrollo</label>
                            <select class="form-control" id="f-desarrollo" onchange="document.getElementById('f-proveedor').disabled = this.value === 'Interno'">
                                ${cSelect(catalogos.tiposDesarrollo, p.tipo_desarrollo)}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Proveedor</label>
                            <select class="form-control" id="f-proveedor" ${p.tipo_desarrollo === 'Interno' ? 'disabled' : ''}>
                                ${cSelect(catalogos.proveedores, p.proveedor)}
                            </select>
                        </div>
                        <div class="form-group form-full">
                            <label class="form-label">Equipo Proveedor / Contraparte Técnica</label>
                            <textarea class="form-control" id="f-equipo-proveedor" placeholder="Ej: Ana Martínez-Desarrolladora, Javier Campos-Scrum Master...">${p.equipo_proveedor || ''}</textarea>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Fecha Inicio Planificada</label>
                            <input type="date" class="form-control" id="f-inicio-plan" value="${formatDateForInput(p.fecha_inicio_planificada)}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Fecha Fin Planificada <span class="required">*</span></label>
                            <input type="date" class="form-control" id="f-fin-plan" required value="${formatDateForInput(p.fecha_fin_planificada)}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Estado Actual</label>
                            <select class="form-control" id="f-estado">
                                ${cSelect(catalogos.estados, p.estado)}
                            </select>
                        </div>
                        
                        <div class="form-group form-full mt-8">
                            <h4 class="form-label text-muted" style="border-bottom: 1px solid var(--border); padding-bottom: 4px;">Atributos Adicionales</h4>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Categoría</label>
                            <select class="form-control" id="f-categoria">
                                ${cSelect(catalogos.categorias, p.categoria)}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Prioridad</label>
                            <select class="form-control" id="f-prioridad">
                                ${cSelect(["Alta", "Media", "Baja"], p.prioridad)}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Criticidad Negocio</label>
                            <select class="form-control" id="f-criticidad">
                                ${cSelect(["Alta", "Media", "Baja"], p.criticidad)}
                            </select>
                        </div>

                        <div class="form-group form-full mt-8">
                            <label class="form-label">Carta Gantt (Excel)</label>
                            <div class="flex items-center gap-12">
                                <input type="file" id="f-gantt-file" style="display: none;" onchange="onGanttFileSelected(this)">
                                <button type="button" class="btn btn-secondary" onclick="document.getElementById('f-gantt-file').click()">
                                    <i class="material-icons-round">attach_file</i> ${p.carta_gantt_url ? 'Cambiar Archivo' : 'Subir Archivo'}
                                </button>
                                <div id="gantt-file-info" class="text-xs text-secondary">
                                    ${p.carta_gantt_url ? `<a href="${p.carta_gantt_url}" target="_blank" class="flex items-center gap-4"><i class="material-icons-round" style="font-size:14px;">link</i> Ver archivo actual</a>` : 'No hay archivo adjunto'}
                                </div>
                                <input type="hidden" id="f-gantt-url" value="${p.carta_gantt_url || ''}">
                                <input type="hidden" id="f-proyecto-actual-id" value="${id || p.id || ''}">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    ${id ? `<button class="btn btn-danger mr-auto" onclick="confirmarEliminarProyecto('${id}')" style="margin-right: auto"><i class="material-icons-round">delete</i> Eliminar</button>` : ''}
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="guardarProyecto('${id || ''}')"><i class="material-icons-round">save</i> Guardar</button>
                </div>
            </div>
        </div>
    `;
    showModal('form-proyecto', html);
};

window.guardarProyecto = function(idStr) {
    const form = document.getElementById('form-proyecto');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Regla 6: No cerrar proyecto si hay riesgos abiertos
    const estadoSeleccionado = document.getElementById('f-estado').value;
    if (idStr && (estadoSeleccionado === 'Finalizado' || estadoSeleccionado === 'Cancelado')) {
        const riesgosAbiertos = appStore.getRiesgosByProyecto(idStr).filter(r => r.estado === 'Abierto');
        if (riesgosAbiertos.length > 0) {
            showToast('No se puede finalizar/cancelar el proyecto. Existen riesgos abiertos.', 'error');
            return;
        }
    }

    let p = idStr ? appStore.getProyecto(idStr) : { 
        id: document.getElementById('f-proyecto-actual-id').value 
    };
    
    p.nombre = document.getElementById('f-nombre').value;
    p.descripcion = document.getElementById('f-descripcion').value;
    p.sistema = document.getElementById('f-sistema').value;
    p.coordinador = document.getElementById('f-coordinador').value;
    p.unidad_usuaria = document.getElementById('f-unidad').value;
    p.responsable_usuario = document.getElementById('f-responsable-usuario').value;
    p.tipo_proyecto = document.getElementById('f-tipo').value;
    p.tipo_desarrollo = document.getElementById('f-desarrollo').value;
    p.proveedor = p.tipo_desarrollo === 'Interno' ? 'Interno' : document.getElementById('f-proveedor').value;
    p.equipo_proveedor = document.getElementById('f-equipo-proveedor').value;
    p.fecha_inicio_planificada = document.getElementById('f-inicio-plan').value;
    p.fecha_fin_planificada = document.getElementById('f-fin-plan').value;
    p.estado = estadoSeleccionado;
    p.categoria = document.getElementById('f-categoria').value;
    p.prioridad = document.getElementById('f-prioridad').value;
    p.criticidad = document.getElementById('f-criticidad').value;
    p.carta_gantt_url = document.getElementById('f-gantt-url').value;

    appStore.saveProyecto(p);
    closeModal();
    showToast('Proyecto guardado exitosamente');
    if (APP.currentRoute.startsWith('/proyectos/detalle/')) {
        renderView();
    } else {
        filtrarProyectos();
    }
};

window.onGanttFileSelected = async function(input) {
    const file = input.files[0];
    if (!file) return;

    // Obtener ID del proyecto con prioridad: campo oculto -> URL -> parametro
    const pId = document.getElementById('f-proyecto-actual-id')?.value || 
                (window.location.hash.includes('detalle') ? window.location.hash.split('/').pop() : null); 
    
    if (!pId) {
        showToast('Debes asignar un nombre al proyecto antes de subir la carta Gantt', 'warning');
        return;
    }

    const info = document.getElementById('gantt-file-info');
    info.innerHTML = `<span class="flex items-center gap-4"><i class="material-icons-round rotating" style="font-size:14px;">sync</i> Preparando archivo...</span>`;
    
    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result.split(',')[1];
            const fileData = {
                fileName: file.name,
                contentType: file.type,
                base64: base64
            };
            
            info.innerHTML = `<span class="flex items-center gap-4"><i class="material-icons-round rotating" style="font-size:14px;">cloud_upload</i> Subiendo a Drive...</span>`;
            
            const res = await appStore.uploadGantt(pId, fileData);
            
            if (res.success && res.url) {
                // Actualizar campo oculto para que al dar Guardar se conserve
                document.getElementById('f-gantt-url').value = res.url;
                
                info.innerHTML = `<span class="text-success flex items-center gap-4"><i class="material-icons-round" style="font-size:14px;">check_circle</i> ¡Terminado!</span> <a href="${res.url}" target="_blank" class="flex items-center gap-4 mt-4" style="color:var(--sag-green);"><i class="material-icons-round" style="font-size:14px;">link</i> Ver archivo adjunto</a>`;
                
                showToast('Archivo enviado correctamente.');
                
                // Forzar actualización en el store si el proyecto ya existía
                const updatedP = appStore.getProyecto(pId);
                if (updatedP) {
                    updatedP.carta_gantt_url = res.url;
                }
            } else {
                info.innerHTML = `<span class="text-danger flex items-center gap-4"><i class="material-icons-round" style="font-size:14px;">error</i> Error.</span>`;
                showToast('Error al subir: ' + (res.error || 'Desconocido'), 'error');
            }
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error(err);
        info.innerHTML = `<span class="text-danger">Error fatal. ${err.message}</span>`;
    }
};

window.confirmarEliminarProyecto = function(id) {
    showConfirmDialog('Eliminar Proyecto', '¿Está seguro que desea eliminar este proyecto y todos sus registros asociados? Esta acción no se puede deshacer.', () => {
        appStore.deleteProyecto(id);
        showToast('Proyecto eliminado');
        navigateTo('#/proyectos');
    });
};

// --- Detalle de Proyecto ---
function renderProyectoDetalle(id) {
    const p = appStore.getProyecto(id);
    if (!p) return `<div class="empty-state">Proyecto no encontrado</div>`;
    
    window.currentTabId = window.currentTabId || 'tab-seguimientos';

    const renderTabBtn = (id, label, icon, badge) => `
        <button class="tab-btn ${window.currentTabId === id ? 'active' : ''}" onclick="switchTabDetalle('${id}')">
            <i class="material-icons-round">${icon}</i> ${label}
            ${badge > 0 ? `<span class="tab-badge ${id==='tab-riesgos'?'red':''}">${badge}</span>` : ''}
        </button>
    `;

    return `
        <div class="mb-16">
            <button class="btn btn-secondary btn-sm" onclick="navigateTo('#/proyectos')">
                <i class="material-icons-round">arrow_back</i> Volver a Proyectos
            </button>
        </div>

        <div class="card mb-24">
            <div class="card-body">
                <div class="flex justify-between items-center mb-16">
                    <div>
                        <h2 style="font-size: 20px; font-weight: 800;">${p.nombre}</h2>
                        <p class="text-muted text-sm mt-4">${p.sistema} • Creado el ${formatDate(p.fecha_ultima_actualizacion)}</p>
                    </div>
                    <div class="flex gap-8">
                        <button class="btn ${p.carta_gantt_url ? 'btn-primary' : 'btn-secondary'}" 
                                ${p.carta_gantt_url ? `onclick="window.open('${p.carta_gantt_url}', '_blank')"` : 'disabled'}
                                style="${!p.carta_gantt_url ? 'opacity: 0.6; cursor: not-allowed;' : ''}">
                            <i class="material-icons-round">analytics</i> 
                            ${p.carta_gantt_url ? 'Ver Carta Gantt' : 'Sin Carta Gantt'}
                        </button>
                        <button class="btn btn-secondary" onclick="abrirModalFormProyecto('${p.id}')">
                            <i class="material-icons-round">edit</i> Editar
                        </button>
                    </div>
                </div>

                <div class="detail-grid mt-24 mb-16" style="background: var(--bg-card-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
                    <div class="detail-item">
                        <div class="detail-label">Estado General</div>
                        <div class="detail-value mt-4">
                            ${renderBadgeEstado(p.estado)} ${renderBadgeSemaforo(p.semaforo)}
                        </div>
                    </div>
                    
                    <div class="detail-item">
                        <div class="detail-label">Avance</div>
                        <div class="detail-value mt-4" style="max-width: 150px;">
                            ${renderProgressBar(p.porcentaje_avance, p.semaforo)}
                        </div>
                    </div>
                    
                    <div class="detail-item">
                        <div class="detail-label">Coordinador / Proveedor</div>
                        <div class="detail-value">
                            ${p.coordinador} <br> 
                            <span class="text-xs text-muted">${p.tipo_desarrollo} - ${p.proveedor}</span>
                            ${p.equipo_proveedor ? `<div class="text-xs text-secondary mt-4" style="white-space: pre-line;"><strong>Equipo:</strong><br>${p.equipo_proveedor}</div>` : ''}
                        </div>
                    </div>
                    
                     <div class="detail-item">
                        <div class="detail-label">Fechas (Planificadas)</div>
                        <div class="detail-value">${formatDate(p.fecha_inicio_planificada)} al ${formatDate(p.fecha_fin_planificada)}</div>
                    </div>
             
                    <div class="detail-item">
                        <div class="detail-label">Unidad Usuaria / Contraparte</div>
                        <div class="detail-value">
                            ${p.unidad_usuaria}
                            ${p.responsable_usuario ? `<br><span class="text-xs text-secondary"><strong>Resp:</strong> ${p.responsable_usuario}</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <p class="text-sm text-secondary">${p.descripcion || 'Sin descripción detallada.'}</p>
            </div>
        </div>

        <div class="tabs">
            ${renderTabBtn('tab-seguimientos', 'Seguimientos Semanales', 'fact_check', appStore.getSeguimientosByProyecto(p.id).length)}
            ${renderTabBtn('tab-riesgos', 'Riesgos y Problemas', 'warning', appStore.getRiesgosByProyecto(p.id).length)}
            ${renderTabBtn('tab-hitos', 'Hitos del Proyecto', 'flag', appStore.getHitosByProyecto(p.id).length)}
        </div>

        <div id="tab-content" class="mt-16">
            ${renderTabContent(p)}
        </div>
    `;
}

window.switchTabDetalle = function(tabId) {
    window.currentTabId = tabId;
    renderView(); // Re-render completo para no complicar el DOM manual
};

function renderTabContent(p) {
    if (window.currentTabId === 'tab-seguimientos') return renderTabSeguimientos(p);
    if (window.currentTabId === 'tab-riesgos') return renderTabRiesgos(p);
    if (window.currentTabId === 'tab-hitos') return renderTabHitos(p);
    return '';
}

// -- Tab Seguimientos --
function renderTabSeguimientos(p) {
    const segs = appStore.getSeguimientosByProyecto(p.id);
    let html = `
        <div class="flex justify-between items-center mb-16">
            <h3 style="font-size: 15px; font-weight:700;">Historial de Seguimientos</h3>
            <button class="btn btn-primary btn-sm" onclick="abrirModalFormSeguimiento('${p.id}')">
                <i class="material-icons-round">add</i> Nuevo Seguimiento
            </button>
        </div>
    `;

    if (segs.length === 0) {
        html += `<div class="empty-state"><p>No hay seguimientos registrados.</p></div>`;
    } else {
        html += `<div class="flex flex-col gap-16">`;
        segs.forEach(s => {
            html += `
                <div class="card p-16">
                    <div class="flex justify-between items-center mb-12">
                        <div class="flex items-center gap-12">
                            <div class="badge badge-en-curso font-bold">${s.semana}</div>
                            <span class="text-secondary text-sm"><i class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-top:-2px;">schedule</i> Reportado el ${formatDate(s.fecha_reporte)}</span>
                        </div>
                        <div class="text-sm font-bold">Avance Reportado: ${s.avance_acumulado}</div>
                    </div>
                    <div class="form-grid-3 text-sm">
                        <div>
                            <div class="font-semibold text-xs text-muted mb-4 uppercase">Actividades Realizadas</div>
                            <div style="white-space: pre-wrap;" class="text-primary">${s.actividades_realizadas || '-'}</div>
                        </div>
                        <div>
                            <div class="font-semibold text-xs text-muted mb-4 uppercase">Actividades Próximas</div>
                            <div style="white-space: pre-wrap;" class="text-primary">${s.actividades_proximas || '-'}</div>
                        </div>
                        <div>
                            <div class="font-semibold text-xs text-muted mb-4 uppercase">Riesgos / Problemas / Bloqueos</div>
                            <div style="white-space: pre-wrap;" class="text-primary">${s.riesgos || '-'}<br>${s.problemas||''}<br>${s.bloqueos||''}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }
    return html;
}

window.onCambiarProyectoSeguimiento = function(selectEl) {
    const p = appStore.getProyecto(selectEl.value);
    if(p) {
        document.getElementById('fs-avance').value = p.porcentaje_avance;
        document.getElementById('info-proyecto-nombre').innerHTML = `<strong>${p.nombre}</strong> (Actual: ${p.porcentaje_avance}%)`;
    }
};

window.abrirModalFormSeguimiento = function(proyectoId, isGlobal = false) {
    const hoy = getCurrentDate();
    const sem = getCurrentWeek();

    let pInfoHtml = '';
    let pidSelectObj = '';
    let currentPct = 0;

    if (isGlobal || !proyectoId) {
        const prjs = appStore.getProyectos({estado: 'Todos'}).filter(x => x.estado !== 'Finalizado' && x.estado !== 'Cancelado');
        pidSelectObj = `
            <div class="form-group form-full mb-16">
                <label class="form-label">Seleccionar Proyecto <span class="required">*</span></label>
                <select class="form-control" id="fs-proyecto-id" required onchange="onCambiarProyectoSeguimiento(this)">
                    <option value="" disabled selected>-- Seleccione un proyecto activo --</option>
                    ${prjs.map(x => `<option value="${x.id}">${x.nombre} (${x.sistema})</option>`).join('')}
                </select>
            </div>
        `;
        pInfoHtml = `<div id="info-proyecto-nombre">Seleccione un proyecto para ver estado</div>`;
    } else {
        const p = appStore.getProyecto(proyectoId);
        if(!p) return;
        currentPct = p.porcentaje_avance;
        pidSelectObj = `<input type="hidden" id="fs-proyecto-id" value="${p.id}">`;
        pInfoHtml = `<strong>${p.nombre}</strong> (Actual: ${p.porcentaje_avance}%)`;
    }

    const html = `
        <div class="modal-overlay">
            <div class="modal modal-md">
                <div class="modal-header">
                    <h2>Registrar Seguimiento Semanal</h2>
                    <button class="btn btn-icon" onclick="closeModal()"><i class="material-icons-round">close</i></button>
                </div>
                <div class="modal-body">
                    <form id="form-seguimiento">
                        ${pidSelectObj}
                        <div class="alert-banner info">
                            <div id="info-proyecto-nombre">${pInfoHtml}</div>
                        </div>
                        
                        <div class="form-grid mb-16 mt-16">
                            <div class="form-group">
                                <label class="form-label">Responsable Reporte <span class="required">*</span></label>
                                <select class="form-control" id="fs-responsable" required>
                                    ${appStore.data.catalogos.coordinadores.map(c => `<option value="${c}">${c}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Semana</label>
                                <input type="text" class="form-control" id="fs-semana" value="${sem}" readonly>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Avance Acumulado Actualizado (%) <span class="required">*</span></label>
                                <input type="number" min="0" max="100" class="form-control" id="fs-avance" required value="${currentPct}">
                                <div class="form-hint">Actualizará el % del proyecto</div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Fecha de Reporte <span class="required">*</span></label>
                                <input type="date" class="form-control" id="fs-fecha" required value="${hoy}">
                            </div>
                        </div>

                        <div class="form-group mb-12">
                            <label class="form-label">Actividades Realizadas esta Semana</label>
                            <textarea class="form-control" id="fs-realizadas"></textarea>
                        </div>
                        <div class="form-group mb-12">
                            <label class="form-label">Actividades Próximas</label>
                            <textarea class="form-control" id="fs-proximas"></textarea>
                        </div>
                        <div class="form-group mb-12">
                            <label class="form-label">Riesgos / Problemas detectados</label>
                            <textarea class="form-control" id="fs-riesgos"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="guardarSeguimiento()">Guardar</button>
                </div>
            </div>
        </div>
    `;
    showModal('form-seguimiento', html);
};

window.guardarSeguimiento = function(antiguoProyectoId) {
    const form = document.getElementById('form-seguimiento');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const comboId = document.getElementById('fs-proyecto-id');
    const pId = comboId ? comboId.value : antiguoProyectoId;
    if(!pId) {
        showToast('Debe seleccionar un proyecto asociado', 'warning'); return;
    }

    const s = {
        proyecto_id: pId,
        fecha_reporte: document.getElementById('fs-fecha').value,
        semana: document.getElementById('fs-semana').value,
        avance_acumulado: document.getElementById('fs-avance').value + '%',
        actividades_realizadas: document.getElementById('fs-realizadas').value,
        actividades_proximas: document.getElementById('fs-proximas').value,
        riesgos: document.getElementById('fs-riesgos').value,
        responsable: document.getElementById('fs-responsable').value
    };

    appStore.saveSeguimiento(s);
    closeModal();
    showToast('Seguimiento guardado exitosamente');
    renderView();
};

// -- Tab Riesgos --
function renderTabRiesgos(p) {
    const riesgos = appStore.getRiesgosByProyecto(p.id);
    let html = `
        <div class="flex justify-between items-center mb-16">
            <h3 style="font-size: 15px; font-weight:700;">Registro de Riesgos, Problemas y Bloqueos</h3>
            <button class="btn btn-primary btn-sm" onclick="abrirModalFormRiesgo('${p.id}')">
                <i class="material-icons-round">add</i> Registrar Riesgo
            </button>
        </div>
        
        <div class="alert-banner warning mb-16">
            <strong>Regla del Sistema:</strong> Si existe un Riesgo Abierto de impacto Alto o Bloqueo, el proyecto pasará a Estado Rojo o Amarillo automáticamente.
        </div>
    `;

    if (riesgos.length === 0) {
        html += `<div class="empty-state"><p>No hay riesgos registrados.</p></div>`;
    } else {
        html += `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Descripción</th>
                            <th>Impacto</th>
                            <th>Estado</th>
                            <th>Responsable</th>
                            <th>Compromiso</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${riesgos.map(r => `
                        <tr>
                            <td><span class="badge badge-${r.tipo.toLowerCase()}">${r.tipo}</span></td>
                            <td style="max-width:300px;" class="truncate" title="${r.descripcion}">${r.descripcion}</td>
                            <td>${renderBadgePrioridad(r.impacto)}</td>
                            <td><span class="badge badge-${r.estado.toLowerCase().replace(/\s+/g, '-')}">${r.estado}</span></td>
                            <td class="text-sm">${r.responsable}</td>
                            <td class="text-sm ${new Date(r.fecha_compromiso) < new Date() && r.estado === 'Abierto' ? 'text-primary font-bold' : ''}">${formatDate(r.fecha_compromiso)}</td>
                            <td>
                                <button class="btn btn-icon btn-sm" onclick="abrirModalFormRiesgo('${p.id}', '${r.id}')"><i class="ph ph-pencil-simple"></i></button>
                            </td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    return html;
}

window.abrirModalFormRiesgo = function(proyectoId, riesgoId = null, isGlobal = false) {
    let r = { tipo: 'Riesgo', descripcion: '', impacto: 'Medio', probabilidad: 'Media', severidad: 'Media', responsable: '', plan_accion: '', estado: 'Abierto', fecha_compromiso: '' };
    if (riesgoId) {
        const exist = appStore.data.riesgos.find(x => x.id === riesgoId);
        if (exist) r = {...exist};
    }

    let pidSelectObj = '';
    if (isGlobal || !proyectoId) {
        const prjs = appStore.getProyectos({estado: 'Todos'}).filter(x => x.estado !== 'Finalizado' && x.estado !== 'Cancelado');
        pidSelectObj = `
            <div class="form-group form-full mb-16">
                <label class="form-label">Asociar al Proyecto <span class="required">*</span></label>
                <select class="form-control" id="fr-proyecto-id" required>
                    <option value="" disabled selected>-- Seleccione un proyecto --</option>
                    ${prjs.map(x => `<option value="${x.id}" ${r.proyecto_id===x.id?'selected':''}>${x.nombre}</option>`).join('')}
                </select>
            </div>
        `;
    } else {
        pidSelectObj = `<input type="hidden" id="fr-proyecto-id" value="${proyectoId}">`;
    }

    const cSelect = (arr, val) => arr.map(x => `<option value="${x}" ${val === x ? 'selected':''}>${x}</option>`).join('');

    const html = `
        <div class="modal-overlay">
            <div class="modal modal-md">
                <div class="modal-header">
                    <h2>${riesgoId ? 'Editar Registro' : 'Nuevo Registro'}</h2>
                    <button class="btn btn-icon" onclick="closeModal()"><i class="ph ph-x"></i></button>
                </div>
                <div class="modal-body">
                    <form id="form-riesgo" class="form-grid">
                        ${pidSelectObj}
                        <div class="form-group form-full">
                            <label class="form-label">Tipo <span class="required">*</span></label>
                            <div class="flex gap-8">
                                <label><input type="radio" name="fr-tipo" value="Riesgo" ${r.tipo==='Riesgo'?'checked':''}> Riesgo</label>
                                <label><input type="radio" name="fr-tipo" value="Problema" ${r.tipo==='Problema'?'checked':''}> Problema</label>
                                <label><input type="radio" name="fr-tipo" value="Bloqueo" ${r.tipo==='Bloqueo'?'checked':''}> Bloqueo</label>
                            </div>
                        </div>

                        <div class="form-group form-full">
                            <label class="form-label">Descripción Detallada <span class="required">*</span></label>
                            <textarea class="form-control" id="fr-descripcion" required>${r.descripcion}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Impacto</label>
                            <select class="form-control" id="fr-impacto">
                                ${cSelect(['Alto', 'Medio', 'Bajo'], r.impacto)}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Estado <span class="required">*</span></label>
                            <select class="form-control" id="fr-estado">
                                ${cSelect(['Abierto', 'En gestión', 'Cerrado'], r.estado)}
                            </select>
                        </div>

                        <div class="form-group form-full">
                            <label class="form-label">Plan de Acción / Mitigación</label>
                            <textarea class="form-control" style="min-height:50px;" id="fr-plan">${r.plan_accion}</textarea>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Responsable Gestión</label>
                            <input type="text" class="form-control" id="fr-responsable" value="${r.responsable}">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Fecha Compromiso <span class="required">*</span></label>
                            <input type="date" class="form-control" id="fr-fecha" required value="${r.fecha_compromiso}">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="guardarRiesgo('${proyectoId || ''}', '${riesgoId || ''}')">Guardar</button>
                </div>
            </div>
        </div>
    `;
    showModal('form-riesgo', html);
};

window.guardarRiesgo = function(oldProyectoId, riesgoIdStr) {
    const form = document.getElementById('form-riesgo');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const comboId = document.getElementById('fr-proyecto-id');
    const pId = comboId ? comboId.value : oldProyectoId;
    if(!pId) {
        showToast('Debe seleccionar un proyecto', 'warning'); return;
    }

    const r = riesgoIdStr ? appStore.getAllRiesgos().find(x=>x.id===riesgoIdStr) || {} : {};
    r.proyecto_id = pId;
    r.tipo = document.querySelector('input[name="fr-tipo"]:checked').value;
    r.descripcion = document.getElementById('fr-descripcion').value;
    r.impacto = document.getElementById('fr-impacto').value;
    r.severidad = r.impacto; // simplificacion para este demo
    r.estado = document.getElementById('fr-estado').value;
    r.plan_accion = document.getElementById('fr-plan').value;
    r.responsable = document.getElementById('fr-responsable').value;
    r.fecha_compromiso = document.getElementById('fr-fecha').value;

    appStore.saveRiesgo(r);
    closeModal();
    showToast('Registro guardado exitosamente');
    renderView();
};

// -- Tab Hitos --
function renderTabHitos(p) {
    const hitos = appStore.getHitosByProyecto(p.id);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const en30 = new Date(hoy);
    en30.setDate(hoy.getDate() + 30);

    // Calcular peso total para la advertencia
    const totalPeso = hitos.reduce((acc, h) => acc + (parseFloat(h.peso_porcentual) || 0), 0);
    const pesoBanner = Math.abs(totalPeso - 100) < 0.1
        ? `<div class="alert-banner info mb-16"><i class="material-icons-round" style="font-size:16px; vertical-align:middle;">check_circle</i> <strong>Pesos al 100%:</strong> El avance del proyecto se recalcula automáticamente en base a los hitos completados.</div>`
        : totalPeso > 0
            ? `<div class="alert-banner warning mb-16"><i class="material-icons-round" style="font-size:16px; vertical-align:middle;">warning</i> <strong>Suma de pesos: ${totalPeso}%</strong> — Para que el avance se recalcule automáticamente, la suma debe ser exactamente 100%.</div>`
            : `<div class="alert-banner info mb-16"><strong>Regla del Sistema:</strong> El avance del proyecto se calcula automáticamente si la suma del peso de los hitos es 100%.</div>`;

    let html = `
        <div class="flex justify-between items-center mb-16">
            <h3 style="font-size: 15px; font-weight:700;">Plan de Hitos y Entregables</h3>
            <button class="btn btn-primary btn-sm" onclick="abrirModalFormHito('${p.id}')">
                <i class="material-icons-round">add</i> Nuevo Hito
            </button>
        </div>
        ${pesoBanner}
    `;

    if (hitos.length === 0) {
        html += `<div class="empty-state"><p>No hay hitos planificados.</p></div>`;
    } else {
        html += `<div class="hito-list card p-16">`;
        hitos.forEach(h => {
            const isCompleted = h.estado === 'Completado';
            
            // Evaluar si el hito está atrasado (fecha_fin < hoy y no completado)
            let fechaFinDate = null;
            if (h.fecha_fin) {
                const parts = h.fecha_fin.split('-');
                if (parts.length === 3) fechaFinDate = new Date(parts[0], parts[1] - 1, parts[2]);
            }
            const isAtrasado = !isCompleted && fechaFinDate && fechaFinDate < hoy;

            // Alerta: vence en ≤ 30 días (no completado, fecha_fin entre hoy y en30)
            const isProximoAVencer = !isCompleted && fechaFinDate && fechaFinDate >= hoy && fechaFinDate <= en30;

            let dotClass = 'pendiente';
            if (isCompleted) dotClass = 'completado';
            else if (isAtrasado) dotClass = 'atrasado';
            else if (isProximoAVencer) dotClass = 'proximo';

            const alertaBadge = isProximoAVencer
                ? `<span class="badge badge-proximo-vencer ml-8" title="Vence en los próximos 30 días"><i class="material-icons-round" style="font-size:13px; vertical-align:middle;">alarm</i> Próximo a vencer</span>`
                : '';
            const atrasadoBadge = isAtrasado
                ? `<span class="badge badge-rojo ml-8" title="Fecha fin superada"><i class="material-icons-round" style="font-size:13px; vertical-align:middle;">warning</i> Atrasado</span>`
                : '';

            // Fechas a mostrar
            const fechaInicioStr = h.fecha_inicio ? `<span><i class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-top:-2px;">play_circle_outline</i> Inicio: <strong>${formatDate(h.fecha_inicio)}</strong></span>` : '';
            const fechaFinStr = fechaFinDate ? `<span class="ml-12"><i class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-top:-2px; ${isAtrasado ? 'color:var(--sem-rojo)' : isProximoAVencer ? 'color:var(--sem-amarillo)' : ''}">flag</i> Fin: <strong style="${isAtrasado ? 'color:var(--sem-rojo)' : isProximoAVencer ? 'color:var(--sem-amarillo)' : ''}">${formatDate(h.fecha_fin)}</strong></span>` : '';

            html += `
                <div class="hito-item${isProximoAVencer ? ' hito-alerta-proximo' : ''}${isAtrasado ? ' hito-alerta-atrasado' : ''}">
                    <div class="hito-dot-col">
                        <div class="hito-dot ${dotClass}"></div>
                        <div class="hito-line"></div>
                    </div>
                    <div class="hito-content">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="hito-name ${isCompleted ? 'text-muted' : ''}" style="${isCompleted ? 'text-decoration: line-through;' : ''}">
                                    ${h.nombre}
                                    <span class="text-xs text-muted font-normal ml-8">Peso: ${h.peso_porcentual}%</span>
                                    ${alertaBadge}${atrasadoBadge}
                                </div>
                            </div>
                            <div class="flex gap-4">
                                <button class="btn btn-icon btn-sm" onclick="abrirModalFormHito('${p.id}', '${h.id}')" title="Editar"><i class="material-icons-round">edit</i></button>
                                <button class="btn btn-icon btn-sm" onclick="appStore.deleteHito('${h.id}'); renderView();" title="Eliminar"><i class="material-icons-round" style="color:var(--sem-rojo);">delete</i></button>
                            </div>
                        </div>
                        <div class="hito-dates flex gap-4 flex-wrap" style="align-items:center;">
                            ${fechaInicioStr}
                            ${fechaFinStr}
                            <span class="ml-12">
                                <span class="badge badge-${h.estado === 'Completado' ? 'completado' : h.estado === 'En Progreso' ? 'en-curso' : 'planificado'}" style="font-size:11px;">${h.estado}</span>
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }
    return html;
}

window.abrirModalFormHito = function(proyectoId, hitoId = null) {
    let h = { nombre: '', fecha_inicio: '', fecha_fin: '', estado: 'Pendiente', peso_porcentual: 0 };
    if (hitoId) {
        const exist = appStore.data.hitos.find(x => x.id === hitoId);
        if (exist) {
            h = {...exist};
            // Compatibilidad con campos antiguos si vienen del servidor
            if (!h.fecha_inicio && exist.fecha_planificada) h.fecha_inicio = exist.fecha_planificada;
            if (!h.fecha_fin && exist.fecha_real) h.fecha_fin = exist.fecha_real;
        }
    }

    const cSelect = (arr, val) => arr.map(x => `<option value="${x}" ${val === x ? 'selected':''}>${x}</option>`).join('');

    const html = `
        <div class="modal-overlay">
            <div class="modal modal-md">
                <div class="modal-header">
                    <h2>${hitoId ? 'Editar Hito' : 'Nuevo Hito'}</h2>
                    <button class="btn btn-icon" onclick="closeModal()"><i class="material-icons-round">close</i></button>
                </div>
                <div class="modal-body">
                    <form id="form-hito" class="form-grid" onsubmit="return false;">
                        <div class="form-group form-full">
                            <label class="form-label">Nombre del Hito <span class="required">*</span></label>
                            <input type="text" class="form-control" id="fh-nombre" required value="${h.nombre}" placeholder="Ej: Levantamiento de Requerimientos">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Fecha de Inicio del Hito <span class="required">*</span></label>
                            <input type="date" class="form-control" id="fh-inicio" required value="${h.fecha_inicio || ''}"
                                onchange="validarFechasHito()">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Fecha Fin del Hito <span class="required">*</span></label>
                            <input type="date" class="form-control" id="fh-fin" required value="${h.fecha_fin || ''}"
                                onchange="validarFechasHito()">
                        </div>

                        <div id="fh-fechas-error" class="form-group form-full" style="display:none; margin-top:-8px;">
                            <div class="alert-banner error" style="padding: 8px 12px; font-size: 13px;">
                                <i class="material-icons-round" style="font-size:16px; vertical-align:middle;">error_outline</i>
                                La fecha de inicio no puede ser posterior a la fecha fin del hito.
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Peso Porcentual (%) <span class="required">*</span></label>
                            <input type="number" min="0" max="100" class="form-control" id="fh-peso" required value="${h.peso_porcentual}" placeholder="0-100">
                            <div class="form-hint">Si la suma de pesos es 100%, el avance del proyecto se recalcula automáticamente.</div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Estado</label>
                            <select class="form-control" id="fh-estado">
                                ${cSelect(['Pendiente', 'En Progreso', 'Completado'], h.estado)}
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="guardarHito('${proyectoId}', '${hitoId || ''}')">
                        <i class="material-icons-round">save</i> Guardar
                    </button>
                </div>
            </div>
        </div>
    `;
    showModal('form-hito', html);
};

window.validarFechasHito = function() {
    const inicio = document.getElementById('fh-inicio')?.value;
    const fin = document.getElementById('fh-fin')?.value;
    const errorDiv = document.getElementById('fh-fechas-error');
    const finInput = document.getElementById('fh-fin');
    
    if (!errorDiv) return true;

    if (inicio && fin && inicio > fin) {
        errorDiv.style.display = 'block';
        if (finInput) finInput.classList.add('input-error');
        return false;
    } else {
        errorDiv.style.display = 'none';
        if (finInput) finInput.classList.remove('input-error');
        return true;
    }
};

window.guardarHito = function(proyectoId, hitoIdStr) {
    const form = document.getElementById('form-hito');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    // Validación de fechas
    if (!validarFechasHito()) {
        showToast('La fecha de inicio no puede ser posterior a la fecha fin del hito.', 'error');
        return;
    }

    const fechaInicio = document.getElementById('fh-inicio').value;
    const fechaFin = document.getElementById('fh-fin').value;

    // Validación de formato: ambas fechas son requeridas
    if (!fechaInicio || !fechaFin) {
        showToast('Debes ingresar la fecha de inicio y la fecha fin del hito.', 'error');
        return;
    }

    const h = hitoIdStr ? appStore.data.hitos.find(x=>x.id===hitoIdStr) || {} : {};
    h.proyecto_id = proyectoId;
    h.nombre = document.getElementById('fh-nombre').value.trim();
    h.fecha_inicio = fechaInicio;
    h.fecha_fin = fechaFin;
    h.peso_porcentual = parseFloat(document.getElementById('fh-peso').value) || 0;
    h.estado = document.getElementById('fh-estado').value;

    appStore.saveHito(h);
    closeModal();
    showToast('Hito guardado. Avance actualizado si aplican pesos.');
    renderView();
};

// --- Menús Globales Simplificados ---
function renderSeguimientos() {
    const segs = [...appStore.data.seguimientos].sort((a,b) => new Date(b.fecha_reporte) - new Date(a.fecha_reporte));
    return `
        <div class="card">
            <div class="card-header flex justify-between items-center" style="padding: 16px;">
                <h3 style="font-size: 15px; font-weight: 700;">Historial Global de Seguimientos</h3>
                <button class="btn btn-primary btn-sm" onclick="abrirModalFormSeguimiento(null, true)">
                    <i class="material-icons-round">add</i> Registrar Seguimiento
                </button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>Proyecto</th><th>Semana / Fecha</th><th>Avance</th><th>Actividades Realizadas</th><th>Responsable</th></tr>
                    </thead>
                    <tbody>
                        ${segs.map(s => {
                            const p = appStore.getProyecto(s.proyecto_id);
                            return `
                                <tr onclick="navigateTo('#/proyectos/detalle/${p?.id}')">
                                    <td><div class="td-bold">${p ? p.nombre : 'Desconocido'}</div><div class="text-xs text-muted">${p ? p.sistema : ''}</div></td>
                                    <td><span class="badge badge-en-curso font-bold">${s.semana}</span><br><span class="text-xs text-muted">${formatDate(s.fecha_reporte)}</span></td>
                                    <td class="font-bold text-center">${s.avance_acumulado}</td>
                                    <td class="text-sm truncate" style="max-width:300px;" title="${s.actividades_realizadas}">${s.actividades_realizadas||'-'}</td>
                                    <td class="text-sm">${s.responsable}</td>
                                </tr>
                            `;
                        }).join('') || `<tr><td colspan="5" class="text-center p-24 text-muted">No hay seguimientos registrados</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}
function renderRiesgos() {
    const rs = appStore.getAllRiesgos();
    return `
        <div class="card">
            <div class="card-header flex justify-between items-center" style="padding: 16px;">
                 <h3 style="font-size: 15px; font-weight: 700;">Todos los Riesgos Abiertos (Vista Global)</h3>
                 <button class="btn btn-primary btn-sm" onclick="abrirModalFormRiesgo(null, null, true)">
                    <i class="material-icons-round">add</i> Registrar Riesgo / Problema
                </button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>ID / Proyecto</th><th>Tipo</th><th>Impacto</th><th>Estado</th><th>Compromiso</th></tr>
                    </thead>
                    <tbody>
                        ${rs.filter(r=>r.estado!=='Cerrado').map(r => {
                            const p = appStore.getProyecto(r.proyecto_id);
                            return `
                                <tr onclick="navigateTo('#/proyectos/detalle/${p?.id}')">
                                    <td><div class="td-bold">${r.id}</div><div class="text-xs text-muted">${p ? p.nombre : 'Desc'}</div></td>
                                    <td><span class="badge badge-${r.tipo.toLowerCase()}">${r.tipo}</span></td>
                                    <td>${renderBadgePrioridad(r.impacto)}</td>
                                    <td>${renderBadgeEstado(r.estado)}</td>
                                    <td>${formatDate(r.fecha_compromiso)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}
function renderAdmin() {
    const cats = appStore.data.catalogos;
    return `
        <div class="card mb-24">
            <div class="card-header">
                <h3>Administración de Catálogos (Vía Excel)</h3>
            </div>
            <div class="card-body">
                <div class="alert-banner info mb-16">
                    Maneja las opciones de los formularios (Sistemas, Coordinadores, Unidades, Proveedores) importando un documento de Excel.
                </div>
                
                <div class="flex gap-16 mt-24">
                    <button class="btn btn-secondary btn-export" onclick="descargarExcelCatalogos()">
                        <i class="material-icons-round">download</i> 1. Descargar Plantilla / Catálogos Actuales
                    </button>
                    
                    <div>
                        <input type="file" id="file-catalogos" accept=".xlsx, .xls" style="display: none;" onchange="procesarExcelCatalogos(event)">
                        <button class="btn btn-primary" onclick="document.getElementById('file-catalogos').click()">
                            <i class="material-icons-round">upload</i> 2. Subir Excel Actualizado
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="grid-catalogos" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div class="card">
                <div class="card-header"><h3 style="font-size: 13px;">Coordinadores (${cats.coordinadores?.length||0})</h3></div>
                <div class="card-body" style="padding:10px;">
                    <ul class="text-sm" style="list-style: disk inside; color: var(--text-secondary);">
                        ${(cats.coordinadores||[]).map(c => `<li>${c}</li>`).join('')}
                    </ul>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3 style="font-size: 13px;">Sistemas (${cats.sistemas?.length||0})</h3></div>
                <div class="card-body" style="padding:10px;">
                    <ul class="text-sm" style="list-style: disk inside; color: var(--text-secondary);">
                        ${(cats.sistemas||[]).map(c => `<li>${c}</li>`).join('')}
                    </ul>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3 style="font-size: 13px;">Estados del Proyecto (${cats.estados?.length||0})</h3></div>
                <div class="card-body" style="padding:10px;">
                    <ul class="text-sm" style="list-style: disk inside; color: var(--text-secondary);">
                        ${(cats.estados||[]).map(c => `<li>${c}</li>`).join('')}
                    </ul>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3 style="font-size: 13px;">Unidades (${cats.unidadesUsuarias?.length||0})</h3></div>
                <div class="card-body" style="padding:10px;">
                    <ul class="text-sm" style="list-style: disk inside; color: var(--text-secondary);">
                        ${(cats.unidadesUsuarias||[]).map(c => `<li>${c}</li>`).join('')}
                    </ul>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3 style="font-size: 13px;">Proveedores (${cats.proveedores?.length||0})</h3></div>
                <div class="card-body" style="padding:10px;">
                    <ul class="text-sm" style="list-style: disk inside; color: var(--text-secondary);">
                        ${(cats.proveedores||[]).map(c => `<li>${c}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;
}

// ==== Logica de Archivos para Catalogos ====
window.descargarExcelCatalogos = function() {
    const cats = appStore.data.catalogos;
    // Buscamos cuál es el array más largo para crear la tabla
    const maxLen = Math.max(
        (cats.sistemas||[]).length,
        (cats.coordinadores||[]).length,
        (cats.unidadesUsuarias||[]).length,
        (cats.proveedores||[]).length,
        (cats.estados||[]).length
    );

    const dataArr = [];
    for (let i = 0; i < maxLen; i++) {
        dataArr.push({
            "Sistemas": (cats.sistemas||[])[i] || "",
            "Coordinadores": (cats.coordinadores||[])[i] || "",
            "UnidadUsuaria": (cats.unidadesUsuarias||[])[i] || "",
            "Proveedores": (cats.proveedores||[])[i] || "",
            "Estados": (cats.estados||[])[i] || ""
        });
    }

    if (!window.XLSX) return showToast('Librería SheetJS no cargada', 'error');
    
    exportToExcel(dataArr, 'SAG_Catalogos_Config');
};

window.procesarExcelCatalogos = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // Usamos la primera hoja del excel
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // Transformamos lo que haya a JSON
            const json = XLSX.utils.sheet_to_json(sheet);
            
            const nuevosSistemas = new Set();
            const nuevosCoordinadores = new Set();
            const nuevasUnidades = new Set();
            const nuevosProveedores = new Set();
            const nuevosEstados = new Set();

            json.forEach(row => {
                if(row["Sistemas"] && row["Sistemas"].toString().trim() !== "") nuevosSistemas.add(row["Sistemas"].toString().trim());
                if(row["Coordinadores"] && row["Coordinadores"].toString().trim() !== "") nuevosCoordinadores.add(row["Coordinadores"].toString().trim());
                if(row["UnidadUsuaria"] && row["UnidadUsuaria"].toString().trim() !== "") nuevasUnidades.add(row["UnidadUsuaria"].toString().trim());
                if(row["Proveedores"] && row["Proveedores"].toString().trim() !== "") nuevosProveedores.add(row["Proveedores"].toString().trim());
                if(row["Estados"] && row["Estados"].toString().trim() !== "") nuevosEstados.add(row["Estados"].toString().trim());
            });

            appStore.data.catalogos.sistemas = Array.from(nuevosSistemas).sort();
            appStore.data.catalogos.coordinadores = Array.from(nuevosCoordinadores).sort();
            appStore.data.catalogos.unidadesUsuarias = Array.from(nuevasUnidades).sort();
            appStore.data.catalogos.proveedores = Array.from(nuevosProveedores).sort();
            if (nuevosEstados.size > 0) {
                appStore.data.catalogos.estados = Array.from(nuevosEstados).sort();
            }

            appStore.save();
            await appStore.saveCatalogosToCloud(); // Sincronizar configuración con Google Sheets

            showToast('Catálogos actualizados y sincronizados con la nube exitosamente.', 'success');
            
            // Reset input file
            event.target.value = '';
            
            // Refrescar vista
            renderView();

        } catch (error) {
            console.error(error);
            showToast('Error procesando el archivo Excel. Asegúrate que respeta el formato de la plantilla.', 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
};

// === Fin del sistema ===
