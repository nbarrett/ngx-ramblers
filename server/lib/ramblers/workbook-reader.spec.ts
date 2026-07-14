import { execFile } from "child_process";
import { isObject, keys, values } from "es-toolkit/compat";
import expect from "expect";
import * as fs from "fs";
import { describe, it } from "mocha";
import * as path from "path";
import { exceljsFrom, extractWorkbook } from "./workbook-reader";
import { WorkbookExtract, WorkbookValue } from "./workbook-reader.model";

function fixture(fileName: string): Buffer {
  return fs.readFileSync(path.join(__dirname, "../../test-data", fileName));
}

const FULL_LIST = "member-bulk-load-full-list.xlsx";
const SINGLE_SHEET = "member-bulk-load-single-sheet.xlsx";
const HEADERS_ONLY = "member-bulk-load-headers-only.xlsx";
const CELL_TYPES = "member-bulk-load-cell-types.xlsx";

describe("workbook-reader", () => {

  describe("exceljs module interop", () => {

    it("takes the module directly when the CommonJS runtime hoists Workbook onto the namespace", () => {
      const commonJsShape: any = {Workbook: function Workbook() {}, ValueType: {Number: 2}};
      expect(exceljsFrom(commonJsShape)).toBe(commonJsShape);
    });

    it("unwraps default when the ESM runtime nests the module under it, as tsx does", () => {
      const inner: any = {Workbook: function Workbook() {}, ValueType: {Number: 2}};
      const esmShape: any = {default: inner};
      expect(exceljsFrom(esmShape)).toBe(inner);
      expect(exceljsFrom(esmShape).Workbook).toBeDefined();
    });

    it("resolves a usable Workbook constructor from the real module in this runtime", async () => {
      const exceljs = exceljsFrom(await import("exceljs"));
      expect(typeof exceljs.Workbook).toBe("function");
      expect(exceljs.ValueType).toBeDefined();
    });

    it("reads a workbook under tsx, the ESM runtime the dev server uses", function (done) {
      this.timeout(30000);
      const script = "import { extractWorkbook } from \"./lib/ramblers/workbook-reader\";"
        + "import * as fs from \"fs\";"
        + "extractWorkbook(fs.readFileSync(\"test-data/member-bulk-load-cell-types.xlsx\"))"
        + ".then(extract => console.log(extract.rows[0][\"Email Address\"]))"
        + ".catch(error => { console.error(error.message); process.exit(1); });";
      execFile("npx", ["tsx", "-e", script], {cwd: path.join(__dirname, "../..")}, (error, stdout) => {
        expect(error).toBe(null);
        expect(stdout).toContain("nick@example.com");
        done();
      });
    });
  });

  describe("sheet selection", () => {

    it("selects the sheet whose name contains the Full List token, ignoring earlier sheets", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(FULL_LIST));
      expect(extract.sheetNames).toEqual(["Summary", "Full List of Members", "Notes"]);
      expect(extract.matchedPreferredSheet).toBe(true);
      expect(extract.selectedSheet).toBe("Full List of Members");
    });

    it("falls back to the first sheet when no sheet name contains the Full List token", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(SINGLE_SHEET));
      expect(extract.sheetNames).toEqual(["Sheet1"]);
      expect(extract.matchedPreferredSheet).toBe(false);
      expect(extract.selectedSheet).toBe("Sheet1");
    });
  });

  describe("row extraction", () => {

    it("maps the header row to keys and returns one object per populated data row", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(FULL_LIST));
      expect(extract.rows.length).toBe(3);
      expect(extract.rows[0]).toEqual({
        "Title": "Mr",
        "Forenames": "Nicholas",
        "Initials": "N",
        "Surname": "Barrett",
        "Last Name": "Barrett",
        "Mem No.": 1234567,
        "Expiry date": "2027-03-31",
        "Type": "Individual",
        "Member Status": "Current",
        "Member Term": "Annual",
        "Postcode": "CT1 1AA",
        "Email Address": "nick@example.com",
        "Mobile Telephone": "07700900123",
        "Landline Telephone": "01227 700123",
        "Email Marketing Consent": "Yes",
        "Email Permission Last Updated": "2025-01-15"
      });
    });

    it("omits keys entirely for blank cells rather than emitting empty values", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(FULL_LIST));
      const jane = extract.rows[1];
      expect(keys(jane).length).toBe(15);
      expect("Mobile Telephone" in jane).toBe(false);
      expect("Landline Telephone" in jane).toBe(false);
      expect(jane["Joint With"]).toBe("Mr John Smith");
    });

    it("omits an empty cell whether it was written blank or as an empty string", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(FULL_LIST));
      expect("Joint With" in extract.rows[0]).toBe(false);
      expect("Mobile Telephone" in extract.rows[1]).toBe(false);
    });

    it("skips a fully blank row instead of emitting an empty object", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(FULL_LIST));
      expect(extract.rows.length).toBe(3);
      expect(extract.rows.map(row => row["Surname"])).toEqual(["Barrett", "  Smith ", "Turing"]);
    });

    it("preserves numeric cells as numbers so membership numbers are not pre-stringified", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(FULL_LIST));
      expect(extract.rows[0]["Mem No."]).toBe(1234567);
      expect(typeof extract.rows[0]["Mem No."]).toBe("number");
      expect(extract.rows[2]["Mem No."]).toBe(42);
    });

    it("preserves surrounding whitespace, leaving trimming to the caller", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(FULL_LIST));
      expect(extract.rows[1]["Forenames"]).toBe("  Jane  ");
      expect(extract.rows[1]["Surname"]).toBe("  Smith ");
    });

    it("returns a real Excel date cell as an Excel serial number, not a Date or formatted string", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(FULL_LIST));
      const expiryDate: unknown = extract.rows[2]["Expiry date"];
      expect(typeof expiryDate).toBe("number");
      expect(expiryDate instanceof Date).toBe(false);
      expect(Math.floor(expiryDate as number)).toBe(46934);
    });

    it("returns no rows for a sheet containing only a header row", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(HEADERS_ONLY));
      expect(extract.selectedSheet).toBe("Full List");
      expect(extract.rows).toEqual([]);
    });

    it("produces identical rows whether the sheet was matched by token or by first-sheet fallback", async () => {
      const matched: WorkbookExtract = await extractWorkbook(fixture(FULL_LIST));
      const fallback: WorkbookExtract = await extractWorkbook(fixture(SINGLE_SHEET));
      expect(fallback.rows).toEqual(matched.rows);
    });
  });

  describe("cell type normalisation", () => {

    it("flattens a hyperlinked cell to its display text so auto-linked email addresses survive", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(CELL_TYPES));
      expect(extract.rows[0]["Email Address"]).toBe("nick@example.com");
    });

    it("flattens a formula cell to its cached result", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(CELL_TYPES));
      expect(extract.rows[1]["Type"]).toBe("Joint");
    });

    it("flattens a rich text cell to its concatenated plain text", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(CELL_TYPES));
      expect(extract.rows[2]["Surname"]).toBe("Turing");
    });

    it("converts a date cell to the Excel serial number the previous reader produced", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(CELL_TYPES));
      expect(extract.rows[0]["Expiry date"]).toBe(46477);
    });

    it("never leaks a raw cell object into a row value", async () => {
      const extract: WorkbookExtract = await extractWorkbook(fixture(CELL_TYPES));
      const rowValues: WorkbookValue[] = extract.rows.flatMap(row => values(row));
      expect(rowValues.length).toBeGreaterThan(0);
      rowValues.forEach(value => expect(isObject(value)).toBe(false));
      rowValues.forEach(value => expect(String(value)).not.toContain("[object Object]"));
    });
  });
});
