import expect from "expect";
import { describe, it } from "mocha";
import { GmailMessage } from "./gmail-inbox.model";
import { isGmailCalendarPart, parseAuthenticationResults, parseGmailMessage } from "./gmail-inbox-reader";

function messageWithHeaders(headers: { name: string; value: string }[]): GmailMessage {
  return {id: "m1", payload: {headers}};
}

describe("parseAuthenticationResults", () => {

  it("reports all passes for a genuine Gmail-authenticated message", () => {
    const message = messageWithHeaders([{
      name: "Authentication-Results",
      value: "mx.google.com; dkim=pass header.i=@staging-lite.ngx-ramblers.org.uk; spf=pass smtp.mailfrom=bi.d.mailin.fr; dmarc=pass (p=NONE) header.from=staging-lite.ngx-ramblers.org.uk"
    }]);
    expect(parseAuthenticationResults(message)).toEqual({dmarcPass: true, dkimPass: true, spfPass: true});
  });

  it("does not report dmarc pass for a spoof that fails authentication", () => {
    const message = messageWithHeaders([{
      name: "Authentication-Results",
      value: "mx.google.com; dkim=none; spf=softfail smtp.mailfrom=evil.example.com; dmarc=fail (p=NONE) header.from=ngx-ramblers.org.uk"
    }]);
    expect(parseAuthenticationResults(message)).toEqual({dmarcPass: false, dkimPass: false, spfPass: false});
  });

  it("is case-insensitive and reads the ARC-Authentication-Results header too", () => {
    const message = messageWithHeaders([{
      name: "ARC-Authentication-Results",
      value: "i=1; mx.google.com; DMARC=PASS header.from=ngx-ramblers.org.uk; DKIM=PASS"
    }]);
    const result = parseAuthenticationResults(message);
    expect(result.dmarcPass).toBe(true);
    expect(result.dkimPass).toBe(true);
  });

  it("reports no passes when no authentication headers are present", () => {
    expect(parseAuthenticationResults(messageWithHeaders([{name: "Subject", value: "hello"}])))
      .toEqual({dmarcPass: false, dkimPass: false, spfPass: false});
  });

  it("does not treat a bestguesspass-style token as a dmarc pass", () => {
    const message = messageWithHeaders([{
      name: "Authentication-Results",
      value: "mx.google.com; dmarc=bestguesspass header.from=ngx-ramblers.org.uk"
    }]);
    expect(parseAuthenticationResults(message).dmarcPass).toBe(false);
  });

});

describe("isGmailCalendarPart", () => {

  it("recognises calendar parts without a filename", () => {
    expect(isGmailCalendarPart({mimeType: "text/calendar", filename: ""})).toEqual(true);
    expect(isGmailCalendarPart({
      mimeType: "application/octet-stream",
      headers: [{name: "Content-Type", value: "text/calendar; method=REPLY; charset=UTF-8"}]
    })).toEqual(true);
    expect(isGmailCalendarPart({mimeType: "application/pdf", filename: "notes.pdf"})).toEqual(false);
  });

});

describe("parseGmailMessage calendar parts", () => {

  it("keeps a text/calendar part as an attachment even when Gmail omitted the filename", () => {
    const ics = "BEGIN:VCALENDAR\nMETHOD:REPLY\nEND:VCALENDAR";
    const message = parseGmailMessage({
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          {name: "From", value: "guest@example.com"},
          {name: "Subject", value: "Accepted: Committee meeting"}
        ],
        parts: [
          {mimeType: "text/plain", body: {data: Buffer.from("accepted").toString("base64url")}},
          {mimeType: "text/calendar", filename: "", body: {data: Buffer.from(ics).toString("base64url")}}
        ]
      }
    });
    expect(message.attachments).toEqual([expect.objectContaining({
      filename: "",
      contentType: "text/calendar"
    })]);
  });

});
