// Cloudflare Workers have no persistent process.env. Bindings (D1, R2) and
// vars/secrets arrive per-request via the `env` object passed to the fetch
// handler. bindEnv() copies them onto this mutable ENV object once at the
// start of every request (see server/index.ts), so the rest of the app can
// keep doing `import { ENV } from "./env"` exactly like before.
export interface WorkerEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  VITE_APP_ID?: string;
  JWT_SECRET: string;
  OWNER_OPEN_ID?: string;
  OAUTH_SERVER_URL?: string;
  LINE_LOGIN_CHANNEL_ID?: string;
  LINE_LOGIN_CHANNEL_SECRET?: string;
  PUBLIC_APP_BASE_URL?: string;
  ASSETS?: Fetcher;
  // Google service account used to upload work-order photos to Drive when
  // google_drive_integration_settings.isEnabled is true (see googleDrive.ts).
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
}

export const ENV = {
  appId: "",
  cookieSecret: "",
  ownerOpenId: "",
  isProduction: true,
  oAuthServerUrl: "",
  lineLoginChannelId: "",
  lineLoginChannelSecret: "",
  publicAppBaseUrl: "",
  googleServiceAccountEmail: "",
  googlePrivateKey: "",
};

export function bindEnv(env: WorkerEnv) {
  ENV.appId = env.VITE_APP_ID ?? "";
  ENV.cookieSecret = env.JWT_SECRET ?? "";
  ENV.ownerOpenId = env.OWNER_OPEN_ID ?? "";
  ENV.isProduction = true;
  ENV.oAuthServerUrl = env.OAUTH_SERVER_URL ?? "";
  ENV.lineLoginChannelId = env.LINE_LOGIN_CHANNEL_ID ?? "";
  ENV.lineLoginChannelSecret = env.LINE_LOGIN_CHANNEL_SECRET ?? "";
  ENV.publicAppBaseUrl = env.PUBLIC_APP_BASE_URL ?? "";
  ENV.googleServiceAccountEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
  ENV.googlePrivateKey = env.GOOGLE_PRIVATE_KEY ?? "";
}
