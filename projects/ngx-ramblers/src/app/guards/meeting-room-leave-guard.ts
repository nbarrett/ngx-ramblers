import { CanDeactivateFn } from "@angular/router";
import { MeetingRoomLeaveCheck } from "../models/video-meeting.model";

export const MeetingRoomLeaveGuard: CanDeactivateFn<MeetingRoomLeaveCheck> = component => component.confirmNavigationAway();
