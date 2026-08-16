import { describe, expect, it } from "vitest";
import { getAuthScreenState } from "./authScreenState";

const base = { authLoading: false, authWaitExpired: false, hasUser: false, profileLoading: false, profileWaitExpired: false, profileFailed: false, needsRegistration: false };

describe("getAuthScreenState", () => {
  it("opens the LINE login screen when no session user is available", () => {
    expect(getAuthScreenState(base)).toBe("LOGIN");
  });

  it("does not leave a user on profile loading indefinitely", () => {
    expect(getAuthScreenState({ ...base, hasUser: true, profileLoading: true, profileWaitExpired: true })).toBe("PROFILE_RECOVERY");
  });

  it("keeps the first-registration flow for a resolved unregistered profile", () => {
    expect(getAuthScreenState({ ...base, hasUser: true, needsRegistration: true })).toBe("REGISTRATION");
  });
});
