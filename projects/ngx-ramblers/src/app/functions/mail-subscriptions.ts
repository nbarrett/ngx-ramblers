import { ListSetting, MailSubscription } from "../models/mail.model";
import { Member } from "../models/member.model";

export function ensureMemberMailSubscriptions(member: Member): MailSubscription[] {
  if (!member) {
    return [];
  } else if (!member.mail) {
    member.mail = {subscriptions: [], email: member.email, id: null};
    return member.mail.subscriptions;
  } else if (!member.mail.subscriptions) {
    member.mail.subscriptions = [];
    return member.mail.subscriptions;
  } else {
    return member.mail.subscriptions;
  }
}

export function subscriptionsMatchingListSettings(
  subscriptions: MailSubscription[],
  listSettings: ListSetting[] | null,
  predicate: (item: ListSetting) => boolean
): MailSubscription[] {
  const existing = subscriptions ?? [];
  return (listSettings ?? []).filter(predicate).map(listSetting => {
    const found = existing.find(subscription => subscription.id === listSetting.id);
    if (found) {
      return found;
    } else {
      const created: MailSubscription = {id: listSetting.id, subscribed: false};
      existing.push(created);
      return created;
    }
  });
}

export function subscribableMailSubscriptions(member: Member, listSettings: ListSetting[] | null): MailSubscription[] {
  return subscriptionsMatchingListSettings(
    ensureMemberMailSubscriptions(member),
    listSettings,
    (item: ListSetting) => item.memberSubscribable
  );
}
