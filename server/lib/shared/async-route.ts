import { Request, RequestHandler, Response } from "express";
import { errorResponse } from "./error-response";
import { createErrorDebugLog } from "./error-debug-log";
import { HttpError } from "./http-error";

export function asyncRoute(messageType: string, handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  const errorDebugLog = createErrorDebugLog(messageType);
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      const httpError = error instanceof HttpError ? error : null;
      const status = httpError ? httpError.status : 500;
      errorDebugLog(`${req.method} ${req.originalUrl} responded ${status}:`, (error as Error)?.message);
      if (res.headersSent) {
        return;
      }
      const body = httpError ? {code: httpError.code || httpError.name, message: httpError.message} : errorResponse(error);
      res.status(status).json({request: {messageType}, error: body});
    }
  };
}
