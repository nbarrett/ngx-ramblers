export function walkNotificationActorName(eventMemberId: string, recipientMemberId: string, actorName: string): string {
  return eventMemberId === recipientMemberId ? "you" : actorName;
}
