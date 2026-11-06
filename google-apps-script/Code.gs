/**
 * Engineering Work Order - Google Apps Script Drive bridge.
 *
 * Deploy as a Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 * Then set Script Properties:
 *   API_TOKEN = a long random secret (same value as Cloudflare GOOGLE_APPS_SCRIPT_TOKEN)
 *   DRIVE_FOLDER_ID = the Drive folder ID used by the app
 *
 * The endpoint is public at the transport layer, but every request is authenticated
 * with API_TOKEN. Never put the token in client-side code.
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty("API_TOKEN");
    var folderId = props.getProperty("DRIVE_FOLDER_ID");
    if (!expected || !folderId || !body.token || !constantTimeEquals_(String(body.token), expected)) {
      return json_({ success: false, error: "Unauthorized or Apps Script is not configured" });
    }
    if (String(body.folderId || "") !== folderId) {
      return json_({ success: false, error: "Folder ID does not match configured Drive folder" });
    }
    var folder = DriveApp.getFolderById(folderId);
    if (body.action === "upload") {
      var bytes = Utilities.base64Decode(String(body.fileDataBase64 || ""));
      var blob = Utilities.newBlob(bytes, String(body.mimeType || "application/octet-stream"), safeName_(body.fileName));
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return json_({ success: true, key: file.getId(), url: "https://drive.google.com/uc?export=view&id=" + file.getId() });
    }
    if (body.action === "createPdf") {
      var pdfBlob = htmlToPdf_(String(body.html || ""), safeName_(body.fileName));
      var pdf = folder.createFile(pdfBlob);
      pdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return json_({ success: true, key: pdf.getId(), url: "https://drive.google.com/file/d/" + pdf.getId() + "/view" });
    }
    return json_({ success: false, error: "Unsupported action" });
  } catch (err) {
    return json_({ success: false, error: String(err && err.message || err) });
  }
}

function htmlToPdf_(html, fileName) {
  // Import HTML as a temporary Google Doc via the Drive API, then export to PDF.
  // The Advanced Drive service is not required; UrlFetchApp uses the script OAuth token.
  var folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  var boundary = "gas_" + Utilities.getUuid().replace(/-/g, "");
  var metadata = { name: "tmp_" + fileName.replace(/\.pdf$/i, ""), mimeType: "application/vnd.google-apps.document", parents: [folderId] };
  var body = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) + "\r\n--" + boundary +
    "\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" + html + "\r\n--" + boundary + "--";
  var headers = { Authorization: "Bearer " + ScriptApp.getOAuthToken() };
  var created = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "post", contentType: "multipart/related; boundary=" + boundary, payload: body, headers: headers, muteHttpExceptions: true
  });
  if (created.getResponseCode() < 200 || created.getResponseCode() >= 300) throw new Error("HTML-to-Docs conversion failed: " + created.getContentText().slice(0, 400));
  var docId = JSON.parse(created.getContentText()).id;
  try {
    var exported = UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(docId) + "/export?mimeType=application/pdf", {
      method: "get", headers: headers, muteHttpExceptions: true
    });
    if (exported.getResponseCode() < 200 || exported.getResponseCode() >= 300) throw new Error("PDF export failed: " + exported.getContentText().slice(0, 400));
    return exported.getBlob().setName(fileName).setContentType("application/pdf");
  } finally {
    UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(docId), {
      method: "delete", headers: headers, muteHttpExceptions: true
    });
  }
}

function safeName_(value) {
  return String(value || "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}
function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
