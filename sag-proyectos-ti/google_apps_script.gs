/**
 * GOOGLE APPS SCRIPT - BACKEND PARA SAG PROYECTOS TI
 * Este script convierte tu Google Sheet en una API para la aplicación web.
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// 1. Manejador de peticiones GET: Lee datos del Excel
function doGet(e) {
  const sheetName = e.parameter.sheet || "Proyectos";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    return createResponse({ error: "Hoja no encontrada: " + sheetName });
  }
  
  const data = sheet.getDataRange().getValues();
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

// 2. Manejador de peticiones POST: Escribe o actualiza datos
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const sheetName = params.sheet || "Proyectos";
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    
    if (!sheet) {
      // Si la hoja no existe, la creamos al vuelo
      const newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);
      const headers = Object.keys(params.data);
      newSheet.appendRow(headers);
      newSheet.appendRow(headers.map(h => params.data[h]));
      return createResponse({ success: true, message: "Hoja creada y datos insertados" });
    }

    if (action === "insert") {
      const headers = sheet.getDataRange().getValues()[0];
      const newRow = headers.map(h => params.data[h] !== undefined ? params.data[h] : "");
      sheet.appendRow(newRow);
      return createResponse({ success: true });
    } 
    
    if (action === "update") {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIndex = headers.indexOf("id");
      const idToUpdate = params.data.id;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][idIndex] == idToUpdate) {
          const updatedRow = headers.map(h => params.data[h] !== undefined ? params.data[h] : data[i][headers.indexOf(h)]);
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([updatedRow]);
          return createResponse({ success: true });
        }
      }
    }
    
    return createResponse({ error: "Acción no reconocida" });
  } catch (err) {
    return createResponse({ error: err.toString() });
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
