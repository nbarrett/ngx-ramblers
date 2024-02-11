import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject } from "rxjs";
import { GridReferenceLookupResponse, PostcodeLookupApiResponse } from "../../models/address-model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class AddressQueryService {

  private BASE_URL = "/api/addresses";
  private postcodeNotifications = new Subject<PostcodeLookupApiResponse>();
  private logger: Logger;
  private gridReferenceDigits = 5;
  private gridCodes: string[][] = [
    ["SV", "SQ", "SL", "SF", "SA", "NV", "NQ", "NL", "NF", "NA", "HV", "HQ", "HL"],
    ["SW", "SR", "SM", "SG", "SB", "NW", "NR", "NM", "NG", "NB", "HW", "HR", "HM"],
    ["SX", "SS", "SN", "SH", "SC", "NX", "NS", "NN", "NH", "NC", "HX", "HS", "HN"],
    ["SY", "ST", "SO", "SJ", "SD", "NY", "NT", "NO", "NJ", "ND", "HY", "HT", "HO"],
    ["SZ", "SU", "SP", "SK", "SE", "NZ", "NU", "NP", "NK", "NE", "HZ", "HU", "HP"],
    ["TV", "TQ", "TL", "TF", "TA", "OV", "OQ", "OL", "OF", "OA", "JV", "JQ", "JL"],
    ["TW", "TR", "TM", "TG", "TB", "OW", "OR", "OM", "OG", "OB", "JW", "JR", "JM"]
  ];

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(AddressQueryService, NgxLoggerLevel.OFF);
  }

  gridReferenceFrom(eastings: string, northings: string): string {
    return `${this.gridCodeFrom(eastings, northings)} ${eastings.substring(1, 1 + this.gridReferenceDigits)} ${northings.substring(1, 1 + this.gridReferenceDigits)}`;
  }

  gridCodeFrom(eastings: string, northings: string): string {
    return this.gridCodes[+eastings.substring(0, 1)][+northings.substring(0, 1)];
  }

  postcodeLookup(postcode: string): Promise<PostcodeLookupApiResponse> {
    const params = this.commonDataService.toHttpParams({postcode});
    this.logger.debug("postcodeLookup:postcode", postcode, "params:", params.toString());
    return this.commonDataService.responseFrom(this.logger, this.http.get<PostcodeLookupApiResponse>(`${this.BASE_URL}/postcodes`, {params}), this.postcodeNotifications);
  }

  gridReferenceLookup(postcode: string): Promise<GridReferenceLookupResponse> {
    return this.postcodeLookup(postcode)
      .then(postcodeLookupApiResponse => {
        const gridReference = postcodeLookupApiResponse.response.error ? undefined : this.gridReferenceFrom(postcodeLookupApiResponse?.response?.eastings, postcodeLookupApiResponse?.response?.northings);
        this.logger.debug("gridReferenceLookup:postcode", postcode, this.gridReferenceDigits, "digit gridReference:", gridReference);
        return {gridReference, error: postcodeLookupApiResponse.response.error, postcode};
      });
  }
}
