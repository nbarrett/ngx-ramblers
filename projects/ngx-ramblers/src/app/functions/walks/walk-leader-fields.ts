import { ExtendedGroupEvent, GroupEvent } from "../../models/group-event.model";
import { Contact } from "../../models/ramblers-walks-manager";
import { isArray } from "es-toolkit/compat";
import { jointWalkLeaderNames, normalisedWalkLeaderName } from "./joint-walk-leaders";

export type WebsiteWalkLeaderDisplayName = string;
export type WalksManagerContactNameForCsv = string;
export type WalksManagerListedWalkLeaderName = string;

export function websiteWalkLeaderDisplayName(walk: ExtendedGroupEvent): WebsiteWalkLeaderDisplayName {
  return (walk?.fields?.contactDetails?.displayName || "").trim();
}

export function walkLeaderDisplayName(walk: ExtendedGroupEvent): WebsiteWalkLeaderDisplayName {
  return websiteWalkLeaderDisplayName(walk) || (walk?.groupEvent?.walk_leader?.name || "").trim();
}

export function walksManagerContactNamesForCsv(walk: ExtendedGroupEvent): WalksManagerContactNameForCsv {
  return normalisedWalkLeaderName(walk?.fields?.publishing?.ramblers?.contactName) || "";
}

export function walkLeaderFirstNameForAlbumThanks(walk: ExtendedGroupEvent): string {
  const contactName = walksManagerContactNamesForCsv(walk);
  if (contactName) {
    const firstFromContact = jointWalkLeaderNames(contactName)[0]?.split(/\s+/).filter(Boolean)[0];
    if (firstFromContact) {
      return firstFromContact;
    }
  }
  const displayName = websiteWalkLeaderDisplayName(walk);
  if (!displayName) {
    return "";
  }
  const spaced = displayName.split(/\s+/).filter(Boolean);
  if (spaced.length > 1) {
    return spaced[0];
  }
  return displayName;
}

export function walksManagerWalkLeaderNameFromGroupEvent(groupEvent: GroupEvent): WalksManagerListedWalkLeaderName {
  const contact = groupEvent?.walk_leader as Contact | Contact[] | null;
  const walkLeader = isArray(contact) ? contact[0] : contact;
  return normalisedWalkLeaderName(walkLeader?.name || "");
}

export function remoteWalksManagerContactNameForCompare(
  listedFromWalksManager: WalksManagerListedWalkLeaderName,
  priorFromHistory: WalksManagerContactNameForCsv
): WalksManagerContactNameForCsv {
  return listedFromWalksManager || priorFromHistory || "";
}
