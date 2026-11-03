// Apps Script for the "CON-X Enquiries" sheet.
// Setup:
//  1. Extensions > Apps Script, paste this file.
//  2. Project Settings > Script properties:
//     SECRET = same as CONX_SHEET_SECRET (Vercel)
//  3. Deploy > New deployment > Web app,
//     Execute as "Me", access "Anyone".
//  4. Put the URL in CONX_SHEET_WEBHOOK_URL.
//
// Columns are matched by header name. A new
// form field gets its own column automatically.

const DEFAULT_HEADERS = [
  'Enquiry No',
  'Submitted (IST)',
  'Name',
  'Company',
  'Email',
  'Phone',
  'Country',
  'Source Page',
  'Status',
  'Notes',
];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const props =
      PropertiesService.getScriptProperties();
    const secret = props.getProperty('SECRET');
    if (!secret || d.secret !== secret) {
      return json({ ok: false, error: 'unauthorized' });
    }

    // Stored counter: deleting rows never
    // causes a repeated number.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let enquiryNo;
    try {
      const sheet = SpreadsheetApp
        .getActiveSpreadsheet()
        .getSheets()[0];

      if (sheet.getLastRow() === 0) {
        sheet.appendRow(DEFAULT_HEADERS);
        sheet.setFrozenRows(1);
        sheet
          .getRange(1, 1, 1, DEFAULT_HEADERS.length)
          .setFontWeight('bold');
      }

      const last = props.getProperty('LAST_NO');
      const n = Number(last || 1000) + 1;
      props.setProperty('LAST_NO', String(n));
      enquiryNo = 'CONX-' + n;

      const values = Object.assign(
        {},
        d.fields || {},
        { 'Enquiry No': enquiryNo, 'Status': 'New' }
      );

      const width = sheet.getLastColumn();
      const headers = sheet
        .getRange(1, 1, 1, width)
        .getValues()[0]
        .map(String);

      Object.keys(values).forEach(function (k) {
        if (headers.indexOf(k) === -1) {
          headers.push(k);
          sheet
            .getRange(1, headers.length)
            .setValue(k)
            .setFontWeight('bold');
        }
      });

      const row = headers.map(function (h) {
        return safe(values[h]);
      });
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }
    return json({ ok: true, enquiryNo: enquiryNo });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// Stops values like "=HYPERLINK(...)"
// from running as formulas.
function safe(v) {
  const s = v == null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
