export type AuthScreenState = "AUTH_LOADING" | "AUTH_RECOVERY" | "LOGIN" | "PROFILE_LOADING" | "PROFILE_RECOVERY" | "REGISTRATION" | "APP";

export function getAuthScreenState(input: {
  authLoading: boolean;
  authWaitExpired: boolean;
  hasUser: boolean;
  profileLoading: boolean;
  profileWaitExpired: boolean;
  profileFailed: boolean;
  needsRegistration: boolean;
}): AuthScreenState {
  if (input.authLoading) return input.authWaitExpired ? "AUTH_RECOVERY" : "AUTH_LOADING";
  if (!input.hasUser) return "LOGIN";
  if (input.profileLoading) return input.profileWaitExpired ? "PROFILE_RECOVERY" : "PROFILE_LOADING";
  if (input.profileFailed) return "PROFILE_RECOVERY";
  if (input.needsRegistration) return "REGISTRATION";
  return "APP";
}
