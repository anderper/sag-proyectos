/**
 * GOOGLE APPS SCRIPT - BACKEND SAG PROYECTOS TI (VERSIÓN 2.0)
 * Ahora permite insertar, actualizar y ELIMINAR filas según el ID.
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doGet(e) {
  const sheetName = e.parameter.sheet || "Proyectos";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) return createResponse([]);
  
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
