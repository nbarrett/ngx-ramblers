import http = require("http");
import https = require("https");
import isEmpty = require("lodash/isEmpty");
import querystring = require("querystring");
import { envConfig } from "../env-config/env-config";
import { keys } from "lodash-es";
import { ContentType, MessageHandlerOptions } from "./server-models";
import { ApiResponse } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";

export function optionalParameter(key: string, value: any): string {
  return key && value ? `${key}=${value}` : "";
}

function createAuditedApiResponse<I, O>(options: MessageHandlerOptions<I, O>): ApiResponse {
  const requestAudit: ApiResponse = {
    request: options.req ? {
      parameters: options.req.params,
      url: options.req.url,
    } : {}
  };
  if (!isEmpty(options.body)) {
    requestAudit.request.body = options.body;
  }
  if (envConfig.dev) {
    requestAudit.serverApiRequest = options.apiRequest;
  }
  return requestAudit;
}

function parseJson<I, O>(options: MessageHandlerOptions<I, O>, rawData: string) {
  options.debug("parsing raw data", rawData);
  try {
    return isEmpty(rawData) ? {} : JSON.parse(rawData);
  } catch (e) {
    options.debug("error parsing JSON", e);
    return {error: rawData};
  }
}

export function httpRequest<I, O>(options: MessageHandlerOptions<I, O>): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    options.debug("sending request using API request options", options.apiRequest);
    const apiResponse: ApiResponse = createAuditedApiResponse(options);
    const request = https.request(options.apiRequest, (response: http.IncomingMessage) => {
      const data = [];
      response.on("data", chunk => {
        data.push(chunk);
      });
      response.on("end", () => {
        let debugPrefix: string;
        if (options.res && (options.successStatusCodes || [200]).includes(response.statusCode)) {
          debugPrefix = response.statusCode !== 200 ? `Remapped ${response.statusCode} -> 200` : `Success 200`;
          options.res.status(200);
        } else {
          debugPrefix = `Error ${response.statusCode}`;
          if (options.res) {
            options.res.statusCode = response.statusCode;
          }
        }
        if (response.statusCode === 204) {
          apiResponse.response = {message: "Request was successful but no data was returned"};
        } else {
          const rawData = Buffer.concat(data).toString();
          try {
            const parsedDataJSON = parseJson(options, rawData);
            apiResponse.response = (parsedDataJSON.errors || parsedDataJSON.error) ? parsedDataJSON : (options.mapper ? options.mapper(parsedDataJSON) : parsedDataJSON);
          } catch (err) {
            if (options.res) {
              options.res.status(500);
            }
            const message = rawData;
            options.debug(message, rawData, err);
            apiResponse.message = message;
            apiResponse.response = {error: err.message};
            options.debug("Error:", apiResponse);
            reject(apiResponse);
          }
        }
        options.debug(debugPrefix, ":", JSON.stringify(apiResponse));
        resolve(apiResponse);
      });
    });
    request.on("error", error => {
      const rejectedResponse = {
        ...apiResponse,
        message: "request.on error event occurred",
        response: {error}
      };
      options.debug("ERROR:", JSON.stringify(rejectedResponse));
      reject(rejectedResponse);
    });
    if (options.body) {
      options.debug("sending body", options.body);
      const formData = options.apiRequest.headers["Content-Type"] === ContentType.APPLICATION_JSON ? JSON.stringify(options.body) : querystring.stringify(options.body);
      options.debug("writing formData", formData);
      request.write(formData);
    } else {
      options.debug("no body supplied in options containing keys:", keys(options));
    }
    request.end();
  });
}
