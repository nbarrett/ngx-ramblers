import { BrevoError } from "@getbrevo/brevo";
import { isError } from "es-toolkit/compat";
import { createErrorDebugLog } from "../../shared/error-debug-log";

export interface BrevoErrorContext {
  [key: string]: unknown;
}

function headersToObject(headers: Headers | undefined): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function brevoErrorDiagnostics(messageType: string, error: unknown, context: BrevoErrorContext = {}): Record<string, unknown> {
  const brevoError = error instanceof BrevoError ? error : null;
  const rawResponse = brevoError?.rawResponse;
  return {
    messageType,
    ...context,
    statusCode: brevoError?.statusCode,
    httpErrorBody: brevoError?.body,
    responseStatusMessage: rawResponse?.statusText,
    responseHeaders: headersToObject(rawResponse?.headers),
    errorName: isError(error) ? error.name : "NonError",
    errorMessage: isError(error) ? error.message : String(error)
  };
}

export function logBrevoError(messageType: string, error: unknown, context: BrevoErrorContext = {}): Record<string, unknown> {
  const diagnostics = brevoErrorDiagnostics(messageType, error, context);
  const errorDebugLog = createErrorDebugLog(messageType);
  errorDebugLog("API call failed:", diagnostics);
  errorDebugLog("stack trace:", isError(error) && error.stack ? error.stack : "(no stack available)");
  return diagnostics;
}
