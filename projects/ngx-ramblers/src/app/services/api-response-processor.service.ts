import { inject, Injectable } from "@angular/core";
import { cloneDeep } from "es-toolkit/compat";
import { isArray } from "es-toolkit/compat";
import { ApiAction, ApiResponse, Identifiable } from "../models/api-response.model";
import { Logger } from "./logger-factory.service";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})
export class ApiResponseProcessor {

  public stringUtils: StringUtilsService = inject(StringUtilsService);

  processResponse<T extends Identifiable>(logger: Logger, existingItems: T[], apiResponse: ApiResponse): T[] {
    let tempItems: T[] = cloneDeep(existingItems) || [];
    const responseItems: T[] = isArray(apiResponse.response) ? apiResponse.response : [apiResponse.response];
    logger.info("Received", this.stringUtils.pluraliseWithCount(responseItems.length, apiResponse.action + " notification"), "- applying response to", this.stringUtils.pluraliseWithCount(tempItems.length, "existing item"), responseItems);
    if (apiResponse.action === ApiAction.QUERY) {
      logger.info("replacing", this.stringUtils.pluraliseWithCount(tempItems?.length, "item"), "with", this.stringUtils.pluraliseWithCount(responseItems?.length, apiResponse.action + " item"));
      tempItems = responseItems;
    } else {
      responseItems.forEach(notifiedItem => {
        const existingItem: T = existingItems.find(member => member.id === notifiedItem.id);
        if (existingItem) {
          if (apiResponse.action === ApiAction.DELETE) {
            logger.info("deleting", notifiedItem);
            tempItems = tempItems.filter(member => member.id !== notifiedItem.id);
          } else {
            const index = tempItems.indexOf(tempItems.find(item => item.id === existingItem.id));
            logger.info("replacing", notifiedItem, "at index position", index);
            tempItems[index] = notifiedItem;
          }
        } else {
          logger.info("adding", notifiedItem, "following", apiResponse.action);
          tempItems.push(notifiedItem);
        }
      });
    }
    logger.info("Returning", tempItems.length, "items following response processing");
    return tempItems;
  }

}
