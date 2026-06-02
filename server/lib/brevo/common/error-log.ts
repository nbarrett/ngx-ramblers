import http from "http";
import { HttpError } from "@getbrevo/brevo";
import { isError } from "es-toolkit/compat";
import { createErrorDebugLog } from "../../shared/error-debug-log";

export interface BrevoErrorContext {
  [key: string]: unknown;
}

export function brevoErrorDiagnostics(messageType: string, error: unknown, context: BrevoErrorContext = {}): Record<string, unknown> {
  const httpError = error instanceof HttpError ? error : null;
  const httpResponse = httpError?.response as http.IncomingMessage | undefined;
  return {
    messageType,
    ...context,
    statusCode: httpError?.statusCode,
    httpErrorBody: httpError?.body,
    responseStatusMessage: httpResponse?.statusMessage,
    responseHeaders: httpResponse?.headers,
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
