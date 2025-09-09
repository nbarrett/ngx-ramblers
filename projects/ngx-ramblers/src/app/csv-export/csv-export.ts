import { Component, inject, Input } from "@angular/core";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DOCUMENT } from "@angular/common";
import isString from "lodash-es/isString";
import isBoolean from "lodash-es/isBoolean";

export interface CsvOptions {
  filename: string;
  fieldSeparator: string;
  quoteStrings: string;
  decimalSeparator: string;
  showLabels: boolean;
  showTitle: boolean;
  title: string;
  useBom: boolean;
  headers: string[];
  keys: string[];
  removeNewLines: boolean;
}

export class CsvConfigConsts {
  public static EOL = "\r\n";
  public static BOM = "\ufeff";
  public static DEFAULT_FIELD_SEPARATOR = ",";
  public static DEFAULT_DECIMAL_SEPARATOR = ".";
  public static DEFAULT_QUOTE = "\"";
  public static DEFAULT_SHOW_TITLE = false;
  public static DEFAULT_TITLE = "CSV Report";
  public static DEFAULT_FILENAME = "export.csv";
  public static DEFAULT_SHOW_LABELS = false;
  public static DEFAULT_USE_BOM = true;
  public static DEFAULT_HEADER: string[] = [];
  public static DEFAULT_KEY: string[] = [];
  public static DEFAULT_REMOVE_NEW_LINES = false;
}

export const ConfigDefaults: CsvOptions = {
  filename: CsvConfigConsts.DEFAULT_FILENAME,
  fieldSeparator: CsvConfigConsts.DEFAULT_FIELD_SEPARATOR,
  quoteStrings: CsvConfigConsts.DEFAULT_QUOTE,
  decimalSeparator: CsvConfigConsts.DEFAULT_DECIMAL_SEPARATOR,
  showLabels: CsvConfigConsts.DEFAULT_SHOW_LABELS,
  showTitle: CsvConfigConsts.DEFAULT_SHOW_TITLE,
  title: CsvConfigConsts.DEFAULT_TITLE,
  useBom: CsvConfigConsts.DEFAULT_USE_BOM,
  headers: CsvConfigConsts.DEFAULT_HEADER,
  keys: CsvConfigConsts.DEFAULT_KEY,
  removeNewLines: CsvConfigConsts.DEFAULT_REMOVE_NEW_LINES
};

@Component({
    selector: "app-csv-export",
    template: ""
})
export class CsvExportComponent {

  private logger: Logger = inject(LoggerFactory).createLogger("CsvExportComponent", NgxLoggerLevel.ERROR);
  private document = inject<Document>(DOCUMENT);
  private _options: CsvOptions = ConfigDefaults;
  private data: any[];
  private csv = "";

  @Input("data") set acceptData(data: any[]) {
    this.data = typeof data !== "object" ? JSON.parse(data) : data;
    this.logger.off("input:data:", data);
  }

  @Input("filename") set acceptFileName(filename: string) {
    this._options.filename = filename;
    this.logger.info("input:filename:", filename);
  }

  @Input("options") set acceptOptions(options: CsvOptions) {
    this._options = {...ConfigDefaults, ...options, filename: this._options.filename};
    this.logger.off("input:options:", options, "this._options", this._options);
  }

  generateCsv(): void {
    this.logger.info("generateCsv:options:", this._options);

    if (this._options.useBom) {
      this.csv += CsvConfigConsts.BOM;
    }

    if (this._options.showTitle) {
      this.csv += this._options.title + "\r\n\n";
    }

    this.generateHeaders();
    this.generateBody();

    if (this.csv === "") {
      this.logger.warn("Invalid data");
      return;
    }

    const blob = new Blob([this.csv], {type: "text/csv;charset=utf8;"});

    const navigatorAny: any = navigator;
    if (navigatorAny.msSaveBlob) {
      const filename = this._options.filename.replace(/ /g, "_") + ".csv";
      navigatorAny.msSaveBlob(blob, filename);
    } else {
      const uri = "data:attachment/csv;charset=utf-8," + encodeURI(this.csv);
      const link: HTMLAnchorElement = this.document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("visibility", "hidden");
      link.download = this._options.filename.replace(/ /g, "_") + ".csv";
      this.document.body.appendChild(link);
      link.click();
      this.logger.info("link:", link, "this._options.filename:", this._options.filename);
      this.document.body.removeChild(link);
    }
  }

  private generateHeaders(): void {
    if (this._options.headers.length > 0) {
      let row = "";
      for (const column of this._options.headers) {
        row += column + this._options.fieldSeparator;
      }

      row = row.slice(0, -1);
      this.csv += row + CsvConfigConsts.EOL;
    }
  }

  private generateBody() {

    for (const dataRow of this.data) {
      let row = "";
      if (this._options.keys && this._options.keys.length > 0) {
        for (const key of this._options.keys) {
          row += this.formatData(dataRow[key]) + this._options.fieldSeparator;
        }
        row = row.slice(0, -1);
        this.csv += row + CsvConfigConsts.EOL;

      } else {
        for (const data of dataRow) {
          row += this.formatData(data) + this._options.fieldSeparator;
        }
        row = row.slice(0, -1);
        this.csv += row + CsvConfigConsts.EOL;
      }
    }
  }

  private formatData(data: any) {

    if (this._options.decimalSeparator === "locale" && this.isFloat(data)) {
      return data.toLocaleString();
    }

    if (this._options.decimalSeparator !== "." && this.isFloat(data)) {
      return data.toString().replace(".", this._options.decimalSeparator);
    }

    if (isString(data)) {
      data = data.replace(/"/g, "\"\"");
      if (this._options.quoteStrings || data.indexOf(",") > -1
        || data.indexOf("\n") > -1 || data.indexOf("\r") > -1) {
        data = this._options.quoteStrings + data + this._options.quoteStrings;
      }
      return data;
    }

    if (isBoolean(data)) {
      return data ? "TRUE" : "FALSE";
    }
    return data;
  }

  private isFloat(input: any) {
    return +input === input && (!isFinite(input) || Boolean(input % 1));
  }
}
