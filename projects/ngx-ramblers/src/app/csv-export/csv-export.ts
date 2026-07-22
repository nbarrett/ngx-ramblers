import { Component, inject, Input } from "@angular/core";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DOCUMENT } from "@angular/common";
import { isBoolean, isString } from "es-toolkit";

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

export function csvContentFrom(data: any[], options: CsvOptions): string {
  const prefix = `${options.useBom ? CsvConfigConsts.BOM : ""}${options.showTitle ? options.title + "\r\n\n" : ""}`;
  return `${prefix}${csvHeadersFrom(options)}${csvBodyFrom(data, options)}`;
}

function csvHeadersFrom(options: CsvOptions): string {
  return options.headers.length > 0 ? options.headers.join(options.fieldSeparator) + CsvConfigConsts.EOL : "";
}

function csvBodyFrom(data: any[], options: CsvOptions): string {
  return (data || []).map(dataRow => {
    const values = options.keys && options.keys.length > 0
      ? options.keys.map(key => formatCsvData(dataRow[key], options))
      : dataRow.map((value: any) => formatCsvData(value, options));
    return values.join(options.fieldSeparator) + CsvConfigConsts.EOL;
  }).join("");
}

function formatCsvData(data: any, options: CsvOptions) {
  if (options.decimalSeparator === "locale" && isFloatValue(data)) {
    return data.toLocaleString();
  }
  if (options.decimalSeparator !== "." && isFloatValue(data)) {
    return data.toString().replace(".", options.decimalSeparator);
  }
  if (isString(data)) {
    const escaped = data.replace(/"/g, "\"\"");
    return options.quoteStrings || escaped.indexOf(",") > -1 || escaped.indexOf("\n") > -1 || escaped.indexOf("\r") > -1
      ? options.quoteStrings + escaped + options.quoteStrings
      : escaped;
  }
  if (isBoolean(data)) {
    return data ? "TRUE" : "FALSE";
  }
  return data;
}

function isFloatValue(input: any) {
  return +input === input && (!isFinite(input) || Boolean(input % 1));
}

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
    this.data = isString(data) ? JSON.parse(data) : data;
    this.logger.off("input:data:", data);
  }

  @Input("filename") set acceptFileName(filename: string) {
    this._options = {...this._options, filename};
    this.logger.info("input:filename:", filename);
  }

  @Input("options") set acceptOptions(options: CsvOptions) {
    this._options = {...ConfigDefaults, ...options, filename: this._options.filename};
    this.logger.off("input:options:", options, "this._options", this._options);
  }

  generateCsv(data?: any[], options?: CsvOptions): void {
    if (data) {
      this.data = data;
    }
    if (options) {
      this._options = {...ConfigDefaults, ...options};
    }
    this.logger.info("generateCsv:options:", this._options);
    this.csv = csvContentFrom(this.data, this._options);

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
}
