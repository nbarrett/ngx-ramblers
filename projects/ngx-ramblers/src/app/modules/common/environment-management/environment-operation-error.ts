export function environmentOperationErrorDetail(error: any): string {
  if (error?.error?.error) {
    return error.error.error;
  } else if (error?.error?.message) {
    return error.error.message;
  } else if (error?.message) {
    return error.message;
  } else {
    return error?.toString() || "Unknown error occurred";
  }
}
