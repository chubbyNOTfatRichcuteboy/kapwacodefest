function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}



function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  // ---- Menu #1: Web Dashboard ----
  ui.createMenu('Web Dashboard')
    .addItem('Open Orders Dashboard', 'openWebApp')
    .addToUi();

  // ---- Menu #2: Toasty Planner (Calendar) ----
  // (optional condition if you want this only on Dashboard tab)
  if (sheet.getName() === "Dashboard") {
    ui.createMenu('Toasty Planner')
      .addItem('Open Calendar', 'openCalendar')
      .addToUi();
  }
}





// Hardcoded the url to the Newest Deployment website.
function openWebApp() {
  const url = "https://script.google.com/a/macros/uci.edu/s/AKfycby3YzVUx8SS_kDMk9XfILam_jeuXZ_cIH_-HC_jYAQ--PX5Fc15XIfjq0X0oHJmm4KvLQ/exec";
  const html = HtmlService.createHtmlOutput(`<script>window.open('${url}', '_blank');google.script.host.close();</script>`);
  SpreadsheetApp.getUi().showModalDialog(html, 'Opening Dashboard...');
}


function processFormData(formData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Orders');

  const productList = formData.products.map(p => `${p.name} (x${p.quantity})`).join(', ');
  const quantityList = formData.products.map(p => p.quantity).join(', ');

  sheet.appendRow([
    formData.order_id,
    formData.email,
    formData.date,
    productList,
    quantityList,
    formData.revenue,
    formData.cost,
    formData.status
  ]);

  return 'Order saved to spreadsheet.';
}



// ------------------ Orders ------------------ //

function getSheet(SHEET_NAME){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  return sheet;
}

function getColDataByName(columnName, sheet){
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let columnIndex = headerRow.indexOf(columnName) + 1;

  if (columnIndex === 0) return [];

  const values = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1).getValues().flat();
  return values.filter(v => v !== "");

}

function getProductsWithRevenueCost() {
  const PRODUCTS_SHEET_NAME = "Products"
  const sheet = getSheet(PRODUCTS_SHEET_NAME);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h).trim());
  const productCol = headers.indexOf("Product");
  const revenueCol = headers.indexOf("Revenue");
  const costCol = headers.indexOf('Cost');

  if (productCol === -1 || revenueCol === -1 || costCol === -1) return [];

  const products = data.slice(1).map(row => ({
    name: row[productCol],
    revenue: Number(row[revenueCol]) || 0, 
    cost: Number(row[costCol]) || 0
  })).filter(p => p.name);

  return products;
}

function getNextOrderID() {
  const sheet = getSheet('Orders');
  if (!sheet) return 100;
  const orderIds = getColDataByName('Order ID', sheet);
  if (orderIds.length === 0) return 100;

  const numericIds = orderIds.map(v => Number(v)).filter(n => !isNaN(n));
  const maxID = numericIds.length ? Math.max(...numericIds) : 99;
  console.log(maxID);
  
  return maxID + 1;
}

// ------------------ Inventory ------------------ //

function getInventoryData() {
  const sheet = getSheet('Inventory');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  // DO SOMETHING HERE DEPENDING ON TOP HEADERS OF SS
  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;    
  })
}

function addInventoryData(formData) {
  const sheet = getSheet('Inventory');
  if (!sheet) {
    return 'Inventory not found';
  }
  const headers = sheet.getDataRange().getValues()[0];
  const row = headers.map(h => formData[h] || '');

  sheet.appendRow(row);
  return 'Inventory record added successfully';
}

// ------------------ Events ------------------ //

const EVENTS_SHEET_NAME = 'Events';
const EVENTS_HEADERS = [
  'id','date','title','channel','qty','hours','priority','revenue','notes','status'
];

function getEventsSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(EVENTS_SHEET_NAME);
  }
  // Ensure headers exist in row 1
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.getRange(1, 1, 1, EVENTS_HEADERS.length).setValues([EVENTS_HEADERS]);
  } else {
    const current = sh.getRange(1, 1, 1, EVENTS_HEADERS.length).getValues()[0];
    if (current.join('|') !== EVENTS_HEADERS.join('|')) {
      sh.getRange(1, 1, 1, EVENTS_HEADERS.length).setValues([EVENTS_HEADERS]);
    }
  }
  return sh;
}

function uuid_() { return Utilities.getUuid(); }

function listEvents(startISO, endISO) {
  const sh = getEventsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];

  const values = sh.getRange(2, 1, last - 1, EVENTS_HEADERS.length).getValues();
  const start = new Date(startISO);
  const end = new Date(endISO);
  const tz = Session.getScriptTimeZone();
  const out = [];

  values.forEach(row => {
    const [id, dateVal, title, channel, qty, hours, priority, revenue, notes, status] = row;
    if (!dateVal) return;

    // Date may be a Date or a string
    const dateStr = (dateVal && dateVal.getFullYear)
      ? Utilities.formatDate(dateVal, tz, 'yyyy-MM-dd')
      : String(dateVal).substring(0, 10);

    const d = new Date(dateStr);
    if (d >= start && d <= end) {
      out.push({
        id: id || '',
        title: String(title || ''),
        start: dateStr,
        extendedProps: {
          channel: channel || '',
          qty: Number(qty || 0),
          hours: Number(hours || 0),
          priority: Number(priority || 0),
          revenue: Number(revenue || 0),
          notes: notes || '',
          status: status || 'planned'
        }
      });
    }
  });

  return out;
}

// add new event 
function addEvent(evt) {
  const sh = getEventsSheet_();
  const id = uuid_();
  const dateStr = (evt.start || evt.date || '').substring(0, 10);

  const row = [
    id,
    dateStr,
    evt.title || '',
    evt.channel || '',
    Number(evt.qty || 0),
    Number(evt.hours || 0),
    Number(evt.priority || 0),
    Number(evt.revenue || 0),
    evt.notes || '',
    evt.status || 'planned'
  ];
  sh.appendRow(row);
  return { id };
}

//update event 
function updateEvent(evt) {
  if (!evt || !evt.id) return false;

  const sh = getEventsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return false;

  const ids = sh.getRange(2, 1, last - 1, 1).getValues().flat();
  const idx = ids.indexOf(evt.id);
  if (idx === -1) return false;

  const r = idx + 2; // actual sheet row (1-based + header)
  if (evt.start || evt.date) sh.getRange(r, 2).setValue((evt.start || evt.date).substring(0, 10));
  if ('title'    in evt) sh.getRange(r, 3).setValue(evt.title || '');
  if ('channel'  in evt) sh.getRange(r, 4).setValue(evt.channel || '');
  if ('qty'      in evt) sh.getRange(r, 5).setValue(Number(evt.qty || 0));
  if ('hours'    in evt) sh.getRange(r, 6).setValue(Number(evt.hours || 0));
  if ('priority' in evt) sh.getRange(r, 7).setValue(Number(evt.priority || 0));
  if ('revenue'  in evt) sh.getRange(r, 8).setValue(Number(evt.revenue || 0));
  if ('notes'    in evt) sh.getRange(r, 9).setValue(evt.notes || '');
  if ('status'   in evt) sh.getRange(r,10).setValue(evt.status || 'planned');

  return true;
}

//delete event using id 
function deleteEvent(id) {
  if (!id) return false;

  const sh = getEventsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return false;

  const ids = sh.getRange(2, 1, last - 1, 1).getValues().flat();
  const idx = ids.indexOf(id);
  if (idx === -1) return false;

  sh.deleteRow(idx + 2);
  return true;
}
