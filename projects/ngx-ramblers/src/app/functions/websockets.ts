import { allowableStatusCodes, MappedCloseMessage } from "../models/websocket.model";

export function mapStatusCode(code: number) {
  const mappedCloseMessage: MappedCloseMessage = {
    message: mapWebSocketErrorMessage(code),
    code,
    success: allowableStatusCodes.includes(code),
  };
  return mappedCloseMessage;
}

export function mapWebSocketErrorMessage(code: number): string {
  switch (code) {
    case 1000:
      return "Normal closure: Connection closed successfully.";
    case 1001:
      return "Going away: An endpoint is terminating the connection (e.g., browser tab closed).";
    case 1002:
      return "Protocol error: Connection closed due to a protocol violation.";
    case 1003:
      return "Unsupported data: Connection closed because the received data type is not supported.";
    case 1005:
      return "No status received: Connection closed without a status code.";
    case 1006:
      return "Abnormal closure: Connection closed unexpectedly (e.g., network failure).";
    case 1007:
      return "Invalid payload data: Connection closed due to invalid message data.";
    case 1008:
      return "Policy violation: Connection closed due to a policy violation.";
    case 1009:
      return "Message too big: Connection closed because the message exceeds the server’s size limit.";
    case 1010:
      return "Missing extension: Client closed connection due to missing server extension.";
    case 1011:
      return "Internal server error: Connection closed due to an unexpected server error.";
    case 1015:
      return "TLS handshake failure: Connection closed due to a failed TLS handshake.";
    default:
      return `Unknown error: Connection closed with code ${code}.`;
  }
}
