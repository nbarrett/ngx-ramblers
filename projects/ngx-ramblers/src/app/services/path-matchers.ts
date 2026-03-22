import { UrlMatchResult, UrlSegment } from "@angular/router";
import { isMongoId } from "./mongo-utils";
import { last } from "es-toolkit/compat";
import { PathSegment, RouteParam } from "../models/content-text.model";

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

export function hasEditSubPath(urlSegments: UrlSegment[]): UrlMatchResult {
  if (urlSegments.length >= 3 && urlSegments[urlSegments.length - 2].path === PathSegment.EDIT) {
    return {
      consumed: urlSegments,
      posParams: {
        [RouteParam.WALK_ID]: urlSegments[urlSegments.length - 1]
      }
    };
  } else {
    return null;
  }
}

export function hasTrailingNewPath(urlSegments: UrlSegment[]): UrlMatchResult {
  if (urlSegments.length === 2 && last(urlSegments).path === PathSegment.NEW) {
    return {
      consumed: urlSegments,
      posParams: {
        [RouteParam.AREA]: urlSegments[0]
      }
    };
  } else {
    return null;
  }
}

export function hasTrailingEditPath(urlSegments: UrlSegment[]): UrlMatchResult {
  if (urlSegments.length >= 3 && last(urlSegments).path === PathSegment.EDIT) {
    return {
      consumed: urlSegments,
      posParams: {
        [RouteParam.ID]: urlSegments[urlSegments.length - 2]
      }
    };
  } else {
    return null;
  }
}

export function hasSendNotificationPath(urlSegments: UrlSegment[]): UrlMatchResult {
  if (urlSegments.length >= 3 && urlSegments[urlSegments.length - 2].path === PathSegment.SEND_NOTIFICATION) {
    return {
      consumed: urlSegments,
      posParams: {
        [RouteParam.COMMITTEE_EVENT_ID]: urlSegments[urlSegments.length - 1]
      }
    };
  } else if (urlSegments.length >= 2 && last(urlSegments).path === PathSegment.SEND_NOTIFICATION) {
    return {
      consumed: urlSegments,
      posParams: {}
    };
  } else {
    return null;
  }
}

export function hasViewSubPath(urlSegments: UrlSegment[]): UrlMatchResult {
  if (urlSegments.length >= 3 && urlSegments[urlSegments.length - 2].path === PathSegment.VIEW) {
    return {
      consumed: urlSegments,
      posParams: {
        [RouteParam.WALK_ID]: urlSegments[urlSegments.length - 1]
      }
    };
  } else {
    return null;
  }
}
