/**
 * Demo sign-in marker. This is NOT authentication: the cookie only records that someone pressed
 * "Sign in" on /enter, so the demo opens like a company login. Plain constants so proxy.ts can import them.
 */
export const SESSION_COOKIE = "bidlens_workspace";
export const SESSION_VALUE = "zanari";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
