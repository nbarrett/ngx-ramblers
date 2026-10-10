import { MemberRoutePreferences, RoutePreferenceAction, RoutePreferenceChange } from "../models/member.model";
import { uniq } from "es-toolkit/compat";

export function routePreferencesAfterChange(preferences: MemberRoutePreferences, change: RoutePreferenceChange): MemberRoutePreferences {
  if (change.action === RoutePreferenceAction.FAVOURITE) {
    return {...preferences, favouriteKeys: change.key ? uniq([...preferences.favouriteKeys, change.key]) : preferences.favouriteKeys};
  } else if (change.action === RoutePreferenceAction.UNFAVOURITE) {
    return {...preferences, favouriteKeys: preferences.favouriteKeys.filter(key => key !== change.key)};
  } else if (change.action === RoutePreferenceAction.HIDE) {
    return {...preferences, hiddenKeys: change.key ? uniq([...preferences.hiddenKeys, change.key]) : preferences.hiddenKeys};
  } else {
    return {...preferences, hiddenKeys: []};
  }
}
