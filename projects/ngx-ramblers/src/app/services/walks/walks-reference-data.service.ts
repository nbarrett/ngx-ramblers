import { Injectable } from "@angular/core";
import { faBeer, faBuilding, faChurch, faCoffee, faCar, faLandmark, faMapMarkerAlt, faMapPin, faQuestion, faTrain, faUtensils } from "@fortawesome/free-solid-svg-icons";
import { isString, isUndefined } from "es-toolkit/compat";
import { WalkAccessMode } from "../../models/walk-edit-mode.model";
import { WalkEventType } from "../../models/walk-event-type.model";
import { VenueType, VenueTypeValue } from "../../models/event-venue.model";
import { EventType, WalkFilter } from "../../models/walk.model";
import { FilterCriteria } from "../../models/api-request.model";

@Injectable({
  providedIn: "root"
})

export class WalksReferenceService {

  static walkAccessModes = {
    view: {caption: "view", title: "View"} as WalkAccessMode,
    add: {caption: "add", title: "Add new"} as WalkAccessMode,
    edit: {caption: "edit", title: "Edit existing", walkWritable: true} as WalkAccessMode,
    lead: {caption: "lead", title: "Lead this", initialiseWalkLeader: true, walkWritable: true} as WalkAccessMode
  };

  walksFilter: WalkFilter[] = [
    {value: FilterCriteria.FUTURE_EVENTS, description: "Walks Today Onwards", selected: true},
    {value: FilterCriteria.PAST_EVENTS, description: "Past Walks"},
    {value: FilterCriteria.ALL_EVENTS, description: "All Walks"},
    {value: FilterCriteria.NO_CONTACT_DETAILS, description: "Walks With No Leader", localWalkPopulationOnly: true},
    {value: FilterCriteria.NO_EVENT_TITLE, description: "Walks With No Details", localWalkPopulationOnly: true},
    {value: FilterCriteria.MISSING_LOCATION, description: "Walks With Missing Location", localWalkPopulationOnly: true},
    {value: FilterCriteria.DELETED_EVENTS, description: "Deleted Walks", adminOnly: true, localWalkPopulationOnly: true}
  ];

  walkEventTypeMappings = {
    awaitingLeader: {
      eventType: EventType.AWAITING_LEADER,
      statusChange: true,
      description: "Awaiting walk leader"
    } as WalkEventType,
    awaitingWalkDetails: {
      eventType: EventType.AWAITING_WALK_DETAILS,
      mustHaveLeader: true,
      statusChange: true,
      description: "Awaiting walk details from leader",
      notifyLeader: true,
      notifyCoordinator: true
    } as WalkEventType
    , walkDetailsRequested: {
      eventType: EventType.WALK_DETAILS_REQUESTED,
      mustHaveLeader: true,
      description: "Walk details requested from leader",
      notifyLeader: true,
      notifyCoordinator: true
    } as WalkEventType,
    walkDetailsUpdated: {
      eventType: EventType.WALK_DETAILS_UPDATED,
      description: "Walk details updated",
      notifyLeader: true,
      notifyCoordinator: true
    } as WalkEventType,
    walkDetailsCopied: {
      eventType: EventType.WALK_DETAILS_COPIED,
      description: "Walk details copied"
    },
    awaitingApproval: {
      eventType: EventType.AWAITING_APPROVAL,
      mustHaveLeader: true,
      mustPassValidation: true,
      statusChange: true,
      readyToBe: "approved",
      description: "Awaiting confirmation of walk details",
      notifyLeader: true,
      notifyCoordinator: true
    } as WalkEventType,
    approved: {
      eventType: EventType.APPROVED,
      mustHaveLeader: true,
      mustPassValidation: true,
      showDetails: true,
      statusChange: true,
      readyToBe: "published",
      description: "Approved",
      notifyLeader: true,
      notifyCoordinator: true
    } as WalkEventType,
    deleted: {
      eventType: EventType.DELETED,
      statusChange: true,
      description: "Deleted",
      notifyLeader: true,
      notifyCoordinator: true
    } as WalkEventType,
    locationGeocoded: {
      eventType: EventType.LOCATION_GEOCODED,
      description: "Location geocoded"
    } as WalkEventType,
    finishTimeFixed: {
      eventType: EventType.FINISH_TIME_FIXED,
      description: "Finish time fixed"
    } as WalkEventType
  };

  private walkEventTypesArray: WalkEventType[] = [
    this.walkEventTypeMappings.awaitingLeader,
    this.walkEventTypeMappings.awaitingWalkDetails,
    this.walkEventTypeMappings.walkDetailsRequested,
    this.walkEventTypeMappings.walkDetailsUpdated,
    this.walkEventTypeMappings.walkDetailsCopied,
    this.walkEventTypeMappings.awaitingApproval,
    this.walkEventTypeMappings.approved,
    this.walkEventTypeMappings.deleted,
    this.walkEventTypeMappings.locationGeocoded,
    this.walkEventTypeMappings.finishTimeFixed
  ];

  venueTypes(): VenueType[] {
    return [
      {type: VenueTypeValue.PUB, displayName: "Pub", icon: faBeer},
      {type: VenueTypeValue.CAFE, displayName: "Cafe", icon: faCoffee},
      {type: VenueTypeValue.RESTAURANT, displayName: "Restaurant", icon: faUtensils},
      {type: VenueTypeValue.CHURCH, displayName: "Church", icon: faChurch},
      {type: VenueTypeValue.HALL, displayName: "Hall", icon: faBuilding},
      {type: VenueTypeValue.CAR_PARK, displayName: "Car Park", icon: faCar},
      {type: VenueTypeValue.STATION, displayName: "Station", icon: faTrain},
      {type: VenueTypeValue.POINT_OF_INTEREST, displayName: "Point of Interest", icon: faLandmark},
      {type: VenueTypeValue.LOCATION, displayName: "Location", icon: faMapMarkerAlt},
      {type: VenueTypeValue.OTHER, displayName: "Other", icon: faQuestion}
    ];
  }

  toWalkEventType(eventType: EventType | string): WalkEventType {
    if (eventType) {
      const returnValue = this.walkEventTypesArray.find(walkEventType => (walkEventType.eventType === eventType) || (walkEventType.description === eventType));
      if (!returnValue) {
        throw new Error("WalkEventType could not be resolved from eventType " + eventType + ". Must be one of: " +
          this.walkEventTypesArray.map(walkEventType => walkEventType.eventType).join(", "));
      }
      return returnValue;
    }
  }

  private isEventType(eventType: EventType | string): eventType is EventType {
    return !isUndefined(eventType as EventType);
  }

  toEventType(eventType: EventType | string): EventType {
    if (isString(eventType)) {
      return this.toWalkEventType(eventType).eventType;
    } else {
      return eventType;
    }
  }

  walkStatuses(): WalkEventType[] {
    return this.walkEventTypesArray.filter((eventType) => eventType.statusChange);
  }

  walkEventTypes(): WalkEventType[] {
    return this.walkEventTypesArray;
  }
}
