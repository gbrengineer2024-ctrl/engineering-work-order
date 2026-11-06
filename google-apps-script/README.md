# Google Apps Script Drive bridge setup

1. Create a standalone Apps Script project at https://script.google.com/.
2. Copy `Code.gs` from this directory into the project.
3. In **Project Settings → Script Properties**, add:
   - `API_TOKEN`: a long random value (at least 32 random bytes).
   - `DRIVE_FOLDER_ID`: the ID of the Drive folder where photos and PDFs should be stored.
4. In **Project Settings → Scopes** (or accept the authorization prompt on first run), allow Drive and external requests. The manifest scopes are:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/script.external_request`
5. Deploy → New deployment → Web app:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deployed Web app URL (ending in `/exec`) into Cloudflare Worker secrets:
   - `GOOGLE_APPS_SCRIPT_URL`: deployed Web app URL
   - `GOOGLE_APPS_SCRIPT_TOKEN`: the same value as Script Property `API_TOKEN`
7. Set the Worker secrets, then deploy the Worker. Keep the API token private.

The Apps Script account must have edit access to the target folder. The endpoint rejects requests unless the shared token matches and the requested folder ID equals the configured folder.
