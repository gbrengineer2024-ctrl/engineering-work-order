export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  lineLoginChannelId: process.env.LINE_LOGIN_CHANNEL_ID ?? "",
  lineLoginChannelSecret: process.env.LINE_LOGIN_CHANNEL_SECRET ?? "",
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "",
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY ?? "",
  // Falls back to the "HotelMaintenance/WorkOrders" folder already created for this project
  // (see google-workspace-integration-notes.md) if no override is set.
  googleDriveWorkOrdersFolderId:
    process.env.GOOGLE_DRIVE_WORK_ORDERS_FOLDER_ID ?? "1ealFTh1rxz2Bt7D7Yij4KpnK0j9ZoC3K",
};
