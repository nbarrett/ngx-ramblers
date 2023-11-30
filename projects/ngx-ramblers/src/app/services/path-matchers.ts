import { UrlMatchResult, UrlSegment } from "@angular/router";
import { isMongoId } from "./mongo-utils";

function relativePathFrom(urlSegments: UrlSegment[]) {
  const urlSegment = new UrlSegment(urlSegments.map(urlSegment => urlSegment.path).join("/"), {});
  // console.log("urlSegments:", urlSegments, "urlSegment:", urlSegment);
  return urlSegment;
}

function returnMatch(matched: boolean, urlSegments: UrlSegment[]) {
  const relativePath = relativePathFrom(urlSegments);
  return matched ? ({
    posParams: {relativePath},
    consumed: urlSegments
  }) : null;
}

export function hasDynamicPath(urlSegments: UrlSegment[]): UrlMatchResult {
  return returnMatch(urlSegments.length > 0, urlSegments);
}

export function hasMongoId(urlSegments: UrlSegment[]): UrlMatchResult {
  return returnMatch((urlSegments.length === 1) && isMongoId(urlSegments[0].path), urlSegments);
}

export function isNumericRamblersId(value: string) {
  return +value > 100000000;
}

export function hasRamblersIdOrUrl(urlSegments: UrlSegment[]): UrlMatchResult {
  return returnMatch((urlSegments.length === 1) && isNumericRamblersId(urlSegments[0]?.path), urlSegments);
}

