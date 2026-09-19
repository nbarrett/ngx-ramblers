import { AnswersQuestions, Check, Duration, PerformsActivities, Task, UsesAbilities, Wait } from "@serenity-js/core";
import { not } from "@serenity-js/assertions";
import { Enter, isSelected, isVisible, Scroll } from "@serenity-js/web";
import { WalkMeetingPoint } from "../../../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { ClickWhenReady } from "../../common/click-when-ready";

export class EnterMeetingPoint extends Task {

  static of(meetingPoint: WalkMeetingPoint): EnterMeetingPoint {
    return new EnterMeetingPoint(meetingPoint);
  }

  constructor(private readonly meetingPoint: WalkMeetingPoint) {
    super(`#actor enters the meeting point ${[meetingPoint?.description, meetingPoint?.postcode].filter(item => !!item).join(", ")}`);
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const searchTerm = this.meetingPoint.postcode || [this.meetingPoint.latitude, this.meetingPoint.longitude].filter(item => !!item).join(", ");
    await actor.attemptsTo(
      Scroll.to(WalksPageElements.separateMeetingPointLabel),
      Check.whether(WalksPageElements.separateMeetingPointCheckbox, not(isSelected()))
        .andIfSo(ClickWhenReady.on(WalksPageElements.separateMeetingPointLabel)),
      Wait.upTo(Duration.ofSeconds(10)).until(WalksPageElements.walkMeetingTimeField, isVisible()),
      ...(this.meetingPoint.time ? [Enter.theValue(this.meetingPoint.time).into(WalksPageElements.walkMeetingTimeField)] : []),
      Scroll.to(WalksPageElements.meetingPointTab),
      ClickWhenReady.on(WalksPageElements.meetingPointTab),
      Wait.upTo(Duration.ofSeconds(10)).until(WalksPageElements.meetingPointSearchField, isVisible()),
      Enter.theValue(searchTerm).into(WalksPageElements.meetingPointSearchField),
      Wait.upTo(Duration.ofSeconds(15)).until(WalksPageElements.firstLocationSuggestion, isVisible()),
      ClickWhenReady.on(WalksPageElements.firstLocationSuggestion),
      ...[
        {value: this.meetingPoint.postcode, field: WalksPageElements.meetingPointPostcodeField},
        {value: this.meetingPoint.description, field: WalksPageElements.meetingPointDescriptionField}
      ].filter(item => !!item.value).flatMap(item => [
        Scroll.to(item.field),
        Wait.upTo(Duration.ofSeconds(10)).until(item.field, isVisible()),
        Enter.theValue(item.value).into(item.field)
      ]));
  }
}
