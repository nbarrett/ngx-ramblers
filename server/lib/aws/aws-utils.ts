import { AwsInfo, AwsUploadErrorResponse } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";

export function isAwsUploadErrorResponse(response: AwsInfo | AwsUploadErrorResponse): response is AwsUploadErrorResponse {
  return (response as AwsUploadErrorResponse)?.error !== undefined;
}
