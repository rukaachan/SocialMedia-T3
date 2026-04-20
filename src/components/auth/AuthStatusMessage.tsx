type AuthStatusMessageProps = {
  debugUrl?: string | null;
  error?: string | null;
  message?: string | null;
};

export function AuthStatusMessage({
  debugUrl,
  error,
  message,
}: AuthStatusMessageProps) {
  if (error == null && message == null && debugUrl == null) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        error != null
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {message != null ? <p>{message}</p> : null}
      {error != null ? <p>{error}</p> : null}
      {debugUrl != null ? (
        <p className="mt-2 break-all">
          Dev link:{" "}
          <a className="font-medium underline" href={debugUrl}>
            {debugUrl}
          </a>
        </p>
      ) : null}
    </div>
  );
}
