import http = require("http");
import https = require("https");
import isEmpty = require("lodash/isEmpty");
import querystring = require("querystring");
import { envConfig } from "../env-config/env-config";
import { MessageHandlerOptions } from "../../../projects/ngx-ramblers/src/app/models/server-models";
import { isArray } from "lodash";

export function optionalParameter(key: string, value: any): string {
  if (key && value) {
    const appliedValue = isArray(value) ? value.join(",") : value;
    return `${key}=${appliedValue}`;
  } else {
    return "";
  }
}

function createRequestAudit(options: MessageHandlerOptions) {
  const requestAudit = {
    request: {
      parameters: options.req.params,
      url: options.req.url, apiRequest: undefined,
      body: undefined

    }
  };
  if (!isEmpty(options.body)) {
    requestAudit.request.body = options.body;
  }
  if (envConfig.dev) {
    requestAudit.request.apiRequest = options.apiRequest;
  }
  return requestAudit;
}

export function httpRequest(options: MessageHandlerOptions) {
  return new Promise((resolve, reject) => {
    options.debug("sending request using API request options", options.apiRequest);
    const requestAudit = createRequestAudit(options);
    const request = https.request(options.apiRequest, (response: http.IncomingMessage) => {
      const data = [];
      options.res.httpVersion = response.httpVersion;
      options.res.trailers = response.trailers;
      options.res.headers = response.headers;
      response.on("data", chunk => {
        data.push(chunk);
      });
      response.on("end", () => {
        const returnValue = {apiStatusCode: response.statusCode, response: undefined};
        let debugPrefix;
        if ((options.successStatusCodes || [200]).includes(response.statusCode)) {
          debugPrefix = response.statusCode !== 200 ? `REMAPPED ${response.statusCode} -> 200` : `SUCCESS 200`;
          options.res.statusCode = 200;
        } else {
          debugPrefix = `ERROR ${response.statusCode}`;
          options.res.statusCode = response.statusCode;
        }
        if (response.statusCode === 204) {
          returnValue.response = {message: "request was successful but no data was returned"};
        } else {
          const rawData = Buffer.concat(data).toString();
          try {
            options.debug("parsing raw data", rawData);
            const parsedDataJSON = isEmpty(rawData) ? {} : JSON.parse(rawData);
            returnValue.response = parsedDataJSON.errors ? parsedDataJSON : (options.mapper ? options.mapper(parsedDataJSON) : parsedDataJSON);
          } catch (err) {
            options.res.statusCode = 500;
            const message = rawData;
            options.debug(message, rawData, err);
            const rejectedResponse = {...requestAudit, message, response: {error: err.message}};
            options.debug("ERROR:", rejectedResponse);
            reject(rejectedResponse);
          }
        }
        const resolvedResponse = {...requestAudit, ...returnValue};
        options.debug(debugPrefix, ":", JSON.stringify(resolvedResponse));
        resolve(resolvedResponse);
      });
    });
    request.on("error", error => {
      const rejectedResponse = {
        ...requestAudit,
        message: "request.on error event occurred",
        response: {error}
      };
      options.debug("ERROR:", JSON.stringify(rejectedResponse));
      reject(rejectedResponse);
    });
    if (!isEmpty(options.body)) {
      options.debug("sending body", options.body);
      const formData = querystring.stringify(options.body);
      options.debug("writing formData", formData);
      request.write(formData);
    }
    request.end();
  });
}
