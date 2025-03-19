import { PublishSelectedWalks } from "./publishSelectedWalks";
import { PublishWalksInDraftState } from "./publishWalksInDraftState";

export class Publish {

  static selectedWalks() {
    return new PublishSelectedWalks("PublishSelectedWalks");
  }

  static walksInDraftState() {
    return new PublishWalksInDraftState("PublishWalksInDraftState");
  }

}

