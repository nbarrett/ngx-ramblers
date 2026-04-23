export interface NormalisedError {
  code: string;
  message: string;
}

export function errorResponse(error: unknown): NormalisedError {
  if (error instanceof Error) {
    return { code: error.name || "Error", message: error.message || String(error) };
  }
  return { code: "Error", message: String(error) };
}
