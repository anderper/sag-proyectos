/**
 * GOOGLE APPS SCRIPT - BACKEND SAG PROYECTOS TI (VERSIÓN 2.0)
 * Ahora permite insertar, actualizar y ELIMINAR filas según el ID.
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const FOLDER_NAME = "SAG_Cartas_Gantt";

function autorizarPermisos() {
  // NOTA: Selecciona esta función en el editor y presiona "Ejecutar"
  // Esto forzará que aparezca la ventana de permisos de ESCRITURA para Google Drive.
  var temp = DriveApp.createFolder("Autorizacion_Temporal_SAG");
  temp.setTrashed(true); // Se elimina inmediatamente para no dejar basura
  Logger.log("¡Permisos COMPLETOS de Drive autorizados correctamente!");
}

function doGet(e) {
  const sheetName = e.parameter.sheet || "Proyectos";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) return createResponse([]);

  // Asegurar que la columna carta_gantt_url existe en Proyectos
  if (sheetName === "Proyectos") {
    const dataRange = sheet.getDataRange();
    const headers = dataRange.getValues()[0];
    if (headers.indexOf("carta_gantt_url") === -1) {
      sheet.getRange(1, headers.length + 1).setValue("carta_gantt_url");
    }
  }

  // Asegurar columnas correctas en Hitos (nueva estructura con fecha_inicio / fecha_fin)
  if (sheetName === "Hitos") {
    const dataRange = sheet.getDataRange();
    const headers = dataRange.getValues()[0];
    // Si aún tiene los nombres antiguos, renombrar
    const fechaPlanIdx = headers.indexOf("fecha_planificada");
    if (fechaPlanIdx !== -1 && headers.indexOf("fecha_inicio") === -1) {
      sheet.getRange(1, fechaPlanIdx + 1).setValue("fecha_inicio");
    }
    const fechaRealIdx = headers.indexOf("fecha_real");
    if (fechaRealIdx !== -1 && headers.indexOf("fecha_fin") === -1) {
      sheet.getRange(1, fechaRealIdx + 1).setValue("fecha_fin");
    }
    // Agregar fecha_fin si no existe ninguna de las dos
    const hdrs2 = sheet.getDataRange().getValues()[0];
    if (hdrs2.indexOf("fecha_inicio") === -1) {
      sheet.getRange(1, hdrs2.length + 1).setValue("fecha_inicio");
    }
    const hdrs3 = sheet.getDataRange().getValues()[0];
    if (hdrs3.indexOf("fecha_fin") === -1) {
      sheet.getRange(1, hdrs3.length + 1).setValue("fecha_fin");
    }
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return createResponse([]); // Solo cabeceras

  const headers = data[0];
  const rows = data.slice(1);
  
  const jsonData = rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
  
  return createResponse(jsonData);
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const sheetName = params.sheet || "Proyectos";
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);
      sheet.appendRow(Object.keys(params.data));
    }

    const dataRows = sheet.getDataRange().getValues();
    const headers = dataRows[0];
    const idIndex = headers.indexOf("id");

    if (action === "insert") {
      const newRow = headers.map(h => params.data[h] !== undefined ? params.data[h] : "");
      sheet.appendRow(newRow);
      return createResponse({ success: true });
    } 

    if (action === "upload_gantt") {
      const folderRes = DriveApp.getFoldersByName(FOLDER_NAME);
      let folder;
      if (folderRes.hasNext()) {
        folder = folderRes.next();
      } else {
        folder = DriveApp.createFolder(FOLDER_NAME);
      }
      
      const contentType = params.data.contentType;
      const base64Data = params.data.base64;
      const fileName = params.data.fileName;
      const projectId = params.data.projectId; // Obtenemos el ID del proyecto
      
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const fileUrl = file.getUrl();

      // Si tenemos un projectId, actualizamos la hoja de Proyectos inmediatamente
      if (projectId) {
        const pSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Proyectos");
        if (pSheet) {
          const pData = pSheet.getDataRange().getValues();
          const pHeaders = pData[0];
          const pIdIdx = pHeaders.indexOf("id");
          const pGanttIdx = pHeaders.indexOf("carta_gantt_url");
          
          if (pIdIdx !== -1 && pGanttIdx !== -1) {
            for (let i = 1; i < pData.length; i++) {
              if (pData[i][pIdIdx] == projectId) {
                pSheet.getRange(i + 1, pGanttIdx + 1).setValue(fileUrl);
                break;
              }
            }
          }
        }
      }
      
      return createResponse({ success: true, url: fileUrl, fileId: file.getId() });
    }
    
    if (action === "update" || action === "delete") {
      const idToSearch = params.data.id;
      for (let i = 1; i < dataRows.length; i++) {
        if (dataRows[i][idIndex] == idToSearch) {
          if (action === "update") {
            const updatedRow = headers.map(h => params.data[h] !== undefined ? params.data[h] : dataRows[i][headers.indexOf(h)]);
            sheet.getRange(i + 1, 1, 1, headers.length).setValues([updatedRow]);
          } else if (action === "delete") {
            sheet.deleteRow(i + 1);
          }
          return createResponse({ success: true });
        }
      }
    }
    
    return createResponse({ error: "Acción no realizada", detail: "ID no encontrado" });
  } catch (err) {
    return createResponse({ error: err.toString() });
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
