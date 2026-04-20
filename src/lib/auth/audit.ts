type AuthAuditEvent =
  | "sign_in_attempt"
  | "sign_in_rate_limited"
  | "sign_in_success"
  | "sign_in_failure"
  | "sign_out"
  | "unlink_provider_attempt"
  | "unlink_provider_success"
  | "unlink_provider_failure"
  | "password_reset_link_generated"
  | "verify_email_link_generated";

export function logAuthEvent(event: AuthAuditEvent, payload: Record<string, unknown>) {
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (typeof value !== "string") {
        return true;
      }

      const lowered = value.toLowerCase();
      return !(
        lowered.includes("token") ||
        lowered.includes("password") ||
        lowered.includes("secret")
      );
    }),
  );

  console.info(`[auth-audit:${event}]`, sanitizedPayload);
}
