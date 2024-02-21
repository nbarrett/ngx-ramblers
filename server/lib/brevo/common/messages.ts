import { Request, Response } from "express";
import { HttpError } from "@getbrevo/brevo";

export function successfulResponse(req: Request, res: Response, response: any, messageType: string, debug: any) {
  debug("successfulResponse:", JSON.stringify(response));
  res.json({request: {messageType}, response});
}

export function handleError(req: Request, res: Response, messageType: string, debugLog: any, error: HttpError) {
  if (error instanceof HttpError) {
    debugLog(messageType, "API call failed with HttpError: body", error.body, "statusCode:", error.statusCode);
    res.status(error.statusCode).json({request: {messageType}, error: error.body});
  } else {
    res.status(500).json({request: {messageType}, error});
  }
}
