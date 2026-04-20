export function getAuthMessage(code: string | undefined) {
  switch (code) {
    case "account_created":
      return "Account created. Verify your email before continuing.";
    case "invalid_credentials":
      return "Invalid email or password.";
    case "invalid_input":
      return "Invalid input.";
    case "password_reset_requested":
      return "If that email exists, a reset link has been generated.";
    case "password_reset_success":
      return "Password updated. Sign in with your new password.";
    default:
      return null;
  }
}
