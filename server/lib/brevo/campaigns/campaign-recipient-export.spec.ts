import expect from "expect";
import { parseRecipientExportCsv } from "./campaign-recipient-export";

describe("parseRecipientExportCsv", () => {

  it("reads semicolon Brevo headers", () => {
    const csv = [
      "Email_ID;Delivered_Date;Open_Date;Unsubscribe_Date;Hard_Bounce_Date;Soft_Bounce_Date;Clicked_Links_Count;Complaint_date;https://group.example.org.uk/walks",
      "alex.reed@example.com;01-10-2026 11:58:00;;; ; ;1;;clicked"
    ].join("\n");
    expect(parseRecipientExportCsv(csv)).toEqual([{
      email: "alex.reed@example.com",
      deliveredDate: "01-10-2026 11:58:00",
      openDate: "",
      unsubscribeDate: "",
      hardBounceDate: "",
      softBounceDate: "",
      clickedCount: 1,
      clickedLinks: ["https://group.example.org.uk/walks"]
    }]);
  });

  it("reads comma-separated exports with Email header", () => {
    const csv = [
      "Email,Delivered_Date,Open_Date,Unsubscribe_Date,Hard_Bounce_Date,Soft_Bounce_Date,Clicked_Links_Count",
      "jordan.blake@example.com,01-10-2026 12:01:00,,,,,"
    ].join("\n");
    const rows = parseRecipientExportCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toEqual("jordan.blake@example.com");
    expect(rows[0].deliveredDate).toEqual("01-10-2026 12:01:00");
  });

  it("reads Email ID headers with spaces", () => {
    const csv = [
      "Email ID,Delivered_Date",
      "sam.lee@example.com,14-08-2026 20:23:00"
    ].join("\n");
    const rows = parseRecipientExportCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toEqual("sam.lee@example.com");
    expect(rows[0].deliveredDate).toEqual("14-08-2026 20:23:00");
  });

  it("keeps quoted commas, quotes and multiline fields in their own columns", () => {
    const csv = [
      "Email,Name,Notes,Delivered_Date,Open_Date",
      "alex.reed@example.com,\"Reed, Alex\",\"Line one\nLine \"\"two\"\"\",01-10-2026 12:01:00,02-10-2026 09:00:00"
    ].join("\n");
    const [row] = parseRecipientExportCsv(csv);
    expect(row.email).toEqual("alex.reed@example.com");
    expect(row.deliveredDate).toEqual("01-10-2026 12:01:00");
    expect(row.openDate).toEqual("02-10-2026 09:00:00");
  });

  it("handles a byte order mark and delimiters inside quoted column headings", () => {
    const csv = "\uFEFFEmail_ID;\"https://group.example.org.uk/?tags=a,b,c\";Delivered_Date\r\nalex.reed@example.com;clicked;01-10-2026 12:01:00";
    expect(parseRecipientExportCsv(csv)[0].deliveredDate).toEqual("01-10-2026 12:01:00");
  });

  it("does not treat a sent date as delivery evidence", () => {
    const [row] = parseRecipientExportCsv("Email,Sent_Date\nalex.reed@example.com,01-10-2026 12:01:00");
    expect(row.deliveredDate).toEqual("");
  });
});
