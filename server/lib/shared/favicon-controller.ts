import { NextFunction, Request, Response } from "express";
import { resolveClientPath } from "./path-utils";

const ramblersFaviconPath = resolveClientPath("dist/ngx-ramblers/favicon.svg");

export function ramblersFavicon(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(ramblersFaviconPath, error => {
    if (error) {
      next(error);
    }
  });
}
