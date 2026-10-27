import { NextFunction, Request, Response } from "express";

export function normaliseAwsFileRequest(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD") {
    req.url = req.url.replace(/^\/{2,}(api\/aws\/s3\/)/, "/$1");
  }
  next();
}
