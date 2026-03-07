function doGetWaitlist(e) {
  Logger.log("✅ ENTERED waitlist.doGet");

  const sheet = SpreadsheetApp.openById("1dTScmU5fgTmkp3TEUbLZ_8_KOve7SLd5pm2_9fEkuOU")
                  .getSheetByName("Waitlist Responses");

  const rawGameId = e?.parameter?.gameId;
  const name = e?.parameter?.name;

  if (rawGameId && name) {
    // Ensure gameId is stored as string (even if user sends a number)
    const gameId = String(rawGameId).trim();
    const timestamp = new Date();

    Logger.log("🟩 Received waitlist submission:");
    Logger.log("    🆔 gameId: " + gameId);
    Logger.log("    🙋 name: " + name);

    try {
      // Append new row
      sheet.appendRow([timestamp, gameId, name, ""]);
      Logger.log("✅ Row appended to Waitlist Responses");

      return ContentService
        .createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log("❌ Error appending row: " + error.message);
      return ContentService
        .createTextOutput(JSON.stringify({ status: "error", message: error.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Return full waitlist data
  try {
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const rows = data.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });

    Logger.log(`📤 Returning ${rows.length} waitlist entries`);
    return ContentService
      .createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log("❌ Error reading data: " + error.message);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
