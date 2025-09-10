import { UrlMatchResult, UrlSegment } from "@angular/router";
import { isMongoId } from "./mongo-utils";
import { last } from "es-toolkit/compat";

function relativePathFrom(urlSegments: UrlSegment[]) {
  return new UrlSegment(urlSegments.map(urlSegment => urlSegment.path).join("/"), {});
}

export function returnMatch(matched: boolean, urlSegments: UrlSegment[]) {
  const relativePath = relativePathFrom(urlSegments);
  return matched ? ({
    posParams: {relativePath},
    consumed: urlSegments
  }) : null;
}

export function hasDynamicPath(urlSegments: UrlSegment[]): UrlMatchResult {
  return returnMatch(urlSegments.length > 0, urlSegments);
}

export function hasDynamicPathAndNonNumericLastPathSegment(urlSegments: UrlSegment[]): UrlMatchResult {
  const firstMatch = returnMatch(urlSegments.length > 0, urlSegments);
  if (firstMatch?.consumed && !hasNumericLastPathSegment(urlSegments)?.consumed) {
    return firstMatch;
  } else {
    return null;
  }
}

export function hasMongoId(urlSegments: UrlSegment[]): UrlMatchResult {
  return returnMatch((urlSegments.length === 1) && isMongoId(urlSegments[0].path), urlSegments);
}

export function hasNumericLastPathSegment(urlSegments: UrlSegment[]): UrlMatchResult {
  return returnMatch(+last(urlSegments) > 0, urlSegments);
}

export function isNumericRamblersId(value: string) {
  return +value > 100000000;
}
