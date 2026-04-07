/* =========================================================
   SAG Proyectos TI — Utilidades y Lógica de Negocio
   ========================================================= */

// --- 1. Fechas ---
const formatDate = (dateString, format = 'DD/MM/YYYY') => {
    if (!dateString) return '-';
    
    // Asumiendo formato YYYY-MM-DD
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    
    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    
    if (isNaN(date.getTime())) return dateString;

    if (format === 'DD/MM/YYYY') {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    
    if (format === 'relative') {
        const now = new Date();
        now.setHours(0,0,0,0);
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Mañana';
        if (diffDays === -1) return 'Ayer';
        if (diffDays > 0) return `En ${diffDays} días`;
        return `Hace ${Math.abs(diffDays)} días`;
    }
    
    return dateString;
};

const getDaysSince = (dateString) => {
    if (!dateString) return 999;
    
    const parts = dateString.split('-');
    if (parts.length !== 3) return 999;
    
    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    const now = new Date();
    
    const diffTime = now.getTime() - date.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const getCurrentDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const getCurrentWeek = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

// --- 2. Semáforo y Reglas de Negocio ---
const calcularSemaforo = (proyecto, riesgosProyecto) => {
    // Si está finalizado o cancelado, el semáforo no aplica (o verde por defecto)
    if (proyecto.estado === 'Finalizado' || proyecto.estado === 'Cancelado') {
        return 'Verde';
    }

    // Regla 4: Si existe un riesgo de impacto alto abierto -> Rojo/Amarillo
    if (riesgosProyecto && riesgosProyecto.length > 0) {
        const riesgosAltos = riesgosProyecto.filter(
            r => r.estado === 'Abierto' && (r.impacto === 'Alto' || r.severidad === 'Alta' || r.tipo === 'Bloqueo')
        );
        if (riesgosAltos.length > 0) {
            return 'Rojo'; // Riesgos altos o bloqueos marcan inmediatamente en rojo
        }
    }

    // Atraso cálculo
    let retrasoDias = 0;
    
    if (proyecto.fecha_fin_planificada) {
        const partsPlan = proyecto.fecha_fin_planificada.split('-');
        const datePlan = new Date(partsPlan[0], partsPlan[1] - 1, partsPlan[2]);
        const now = new Date();
        
        let diffTime = now.getTime() - datePlan.getTime();
        retrasoDias = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    // Regla 3: Atraso automático
    if (retrasoDias > 30) return 'Rojo';
    if (retrasoDias > 0 && retrasoDias <= 30) return 'Amarillo';
    
    // Regla 5: Sin actualización semanal
    const diasSinActualizar = getDaysSince(proyecto.fecha_ultima_actualizacion);
    if (diasSinActualizar > 14) return 'Amarillo'; // Más de dos semanas

    return 'Verde'; // En plazo, sin riesgos críticos
};

// --- 3. Componentes Visuales HTML Helpers ---

const renderBadgeSemaforo = (valor) => {
    const valLow = (valor || 'verde').toLowerCase();
    return `<span class="badge badge-semaforo-${valLow}"><span class="semaforo-dot ${valLow}"></span>${valor}</span>`;
};

const renderBadgeEstado = (valor) => {
    const clz = valor ? valor.toLowerCase().replace(/\s+/g, '-') : 'planificado';
    return `<span class="badge badge-${clz}">${valor}</span>`;
};

const renderBadgePrioridad = (valor) => {
    const clz = valor ? valor.toLowerCase() : 'media';
    return `<span class="badge badge-${clz}">${valor}</span>`;
};

const renderBadgeTipo = (valor) => {
    const clz = valor ? valor.toLowerCase().replace(/\s+/g, '-') : 'nuevo';
    return `<span class="badge badge-${clz}">${valor}</span>`;
};

const renderProgressBar = (pct, semaforo) => {
    const valLow = (semaforo || 'verde').toLowerCase();
    const p = Math.max(0, Math.min(100, pct || 0));
    
    return `
        <div class="progress-label">
            <div class="progress-bar" style="flex:1;">
                <div class="progress-fill progress-${valLow}" style="width: ${p}%"></div>
            </div>
            <span class="progress-pct">${p}%</span>
        </div>
    `;
};

// --- 4. Modales y Toasts ---

const showModal = (id, overlayHtml) => {
    const container = document.getElementById('modal-container');
    container.innerHTML = overlayHtml;
    // Evitar scroll en body
    document.body.style.overflow = 'hidden';
};

const closeModal = () => {
    const container = document.getElementById('modal-container');
    container.innerHTML = '';
    document.body.style.overflow = '';
};

// Cierra el modal si se clickea el fondo (overlay)
document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('modal-overlay')) {
        closeModal();
    }
});

const showToast = (message, type = 'success') => { // success, error, warning
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ph-check-circle';
    if(type === 'error') icon = 'ph-x-circle';
    if(type === 'warning') icon = 'ph-warning';

    toast.innerHTML = `<i class="ph ${icon}" style="font-size: 18px;"></i> ${message}`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.25s ease reverse forwards';
        setTimeout(() => toast.remove(), 250);
    }, 4000);
};

const showConfirmDialog = (title, message, onConfirm) => {
    const html = `
        <div class="modal-overlay">
            <div class="confirm-dialog">
                <i class="ph ph-warning-circle confirm-icon" style="color: var(--sem-amarillo);"></i>
                <h3 class="confirm-title">${title}</h3>
                <p class="confirm-msg">${message}</p>
                <div class="confirm-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="btn-confirm-dialog">Confirmar</button>
                </div>
            </div>
        </div>
    `;
    showModal('confirm-dialog', html);
    
    setTimeout(() => {
        document.getElementById('btn-confirm-dialog').addEventListener('click', () => {
            closeModal();
            onConfirm();
        });
    }, 50);
};

// --- 5. Exportación a Excel (usando SheetJS) ---
const exportToExcel = (data, filename, sheetName = 'Datos') => {
    if (!window.XLSX) {
        showToast('Error: Biblioteca SheetJS no está cargada', 'error');
        return;
    }
    
    const currentDate = getCurrentDate().replace(/-/g, '');
    const finalFilename = `${filename}_${currentDate}.xlsx`;
    
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Auto-ajustar ancho de columnas básico
    const colWidths = [];
    Object.keys(data[0] || {}).forEach((key, i) => {
        let maxLen = key.length;
        data.forEach(row => {
            const val = row[key];
            if (val !== null && val !== undefined) {
                const len = val.toString().length;
                if (len > maxLen) maxLen = len;
            }
        });
        colWidths[i] = { wch: Math.min(maxLen + 2, 50) }; // Cap de 50 chars para ancho
    });
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    XLSX.writeFile(wb, finalFilename);
};
