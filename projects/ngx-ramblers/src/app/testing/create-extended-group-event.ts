import { InputSource } from "../models/group-event.model";
import { LocationDetails, RamblersEventType, WalkStatus } from "../models/ramblers-walks-manager";
import { DateUtilsService } from "../services/date-utils.service";

export function createExtendedGroupEvent(dateUtilsService: DateUtilsService, dateValue: number, expectedEvent: any, walkLeaderMemberId: string, startLocation?: LocationDetails) {
    return {
        fields: {
            contactDetails: {
                email: "",
                contactId: "",
                memberId: walkLeaderMemberId,
                displayName: "",
                phone: ""
            },
            attendees: [],
            links: [],
            meetup: null,
            milesPerHour: 0,
            notifications: [],
            publishing: null,
            riskAssessment: [],
            migratedFromId: null,
            inputSource: InputSource.MANUALLY_CREATED,
        },
        groupEvent: {
            item_type: RamblersEventType.GROUP_WALK,
            start_date_time: dateUtilsService.isoDateTime(dateValue),
            title: "",
            group_code: "",
            area_code: "",
            group_name: "",
            description: "",
            additional_details: "",
            end_date_time: "",
            meeting_date_time: "",
            start_location: startLocation,
            meeting_location: null,
            end_location: null,
            distance_km: 0,
            distance_miles: 0,
            ascent_feet: 0,
            ascent_metres: 0,
            difficulty: null,
            shape: "",
            duration: 0,
            walk_leader: null,
            url: "",
            external_url: "",
            status: WalkStatus.DRAFT,
            cancellation_reason: "",
            accessibility: [],
            facilities: [],
            transport: [],
            media: [],
            linked_event: "",
            date_created: "",
            date_updated: ""
        },
        events: [expectedEvent]
    };
}
