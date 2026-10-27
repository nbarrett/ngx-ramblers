import expect from "expect";
import { describe, it } from "mocha";
import express, { Request, Response } from "express";
import sinon from "sinon";
import { Server } from "node:http";
import { AddressInfo } from "node:net";
import { normaliseAwsFileRequest } from "./aws-file-request";

describe("normaliseAwsFileRequest", () => {
  it("repairs legacy file paths before the existing access middleware and file handler", () => {
    const next = sinon.spy();
    const req = {method: "GET", url: "//api/aws/s3/email-attachments/example.pdf?disposition=download", originalUrl: "//api/aws/s3/email-attachments/example.pdf?disposition=download"} as Request;
    normaliseAwsFileRequest(req, {} as Response, next);
    expect(req.url).toBe("/api/aws/s3/email-attachments/example.pdf?disposition=download");
    expect(req.originalUrl).toBe("//api/aws/s3/email-attachments/example.pdf?disposition=download");
    expect(next.calledOnce).toBe(true);
  });

  it("repairs HEAD requests without changing slashes inside object keys or query values", () => {
    const req = {method: "HEAD", url: "///api/aws/s3/email-attachments/nested//example.docx?value=https://group.example.org.uk"} as Request;
    normaliseAwsFileRequest(req, {} as Response, () => null);
    expect(req.url).toBe("/api/aws/s3/email-attachments/nested//example.docx?value=https://group.example.org.uk");
  });

  it("leaves write requests and unrelated routes unchanged", () => {
    const requests = [
      {method: "POST", url: "//api/aws/s3/file-upload"},
      {method: "GET", url: "//api/database/config"},
      {method: "GET", url: "/api/aws/s3/email-attachments/example.pdf"},
      {method: "GET", url: "//external.example.org.uk/api/aws/s3/example.pdf"}
    ];
    requests.forEach(request => {
      const req = {...request} as Request;
      normaliseAwsFileRequest(req, {} as Response, () => null);
      expect(req.url).toBe(request.url);
    });
  });
  it("serves original file bytes through the normal middleware and preserves access denials", async () => {
    const app = express();
    const file = Buffer.from("%PDF-1.7\nexample file bytes");
    app.use(normaliseAwsFileRequest);
    app.use("/api/aws", (req, res, next) => {
      if (req.headers.authorization === "Bearer example") {
        next();
      } else {
        res.sendStatus(403);
      }
    });
    app.get("/api/aws/s3/email-attachments/example.pdf", (_req, res) => res.type("application/pdf").send(file));
    app.use((_req, res) => res.type("text/html").send("<html>Website fallback</html>"));
    const server = await new Promise<Server>(resolve => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}//api/aws/s3/email-attachments/example.pdf`;
      const denied = await fetch(url);
      expect(denied.status).toBe(403);
      const response = await fetch(url, {headers: {Authorization: "Bearer example"}});
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(Buffer.from(await response.arrayBuffer())).toEqual(file);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

});
