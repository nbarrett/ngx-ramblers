import { Injectable, inject } from "@angular/core";
import { MapControlsStateService } from "./map-controls-state.service";
import { UiActionsService } from "../../services/ui-actions.service";
import { StoredValue } from "../../models/ui-actions";

export interface MapVisibilityState {
  showControls: boolean;
}

export interface MapVisibilityCallbacks {
  onToggleControls?: (showControls: boolean) => void;
}

@Injectable({
  providedIn: "root"
})
export class MapVisibilityService {
  private mapControlsService = inject(MapControlsStateService);
  private uiActions = inject(UiActionsService);

  getInitialState(): MapVisibilityState {
    return {
      showControls: this.uiActions.initialBooleanValueFor(StoredValue.MAP_SHOW_CONTROLS, true)
    };
  }

  toggleControls(currentState: MapVisibilityState, callbacks?: MapVisibilityCallbacks): MapVisibilityState {
    const newShowControls = !currentState.showControls;
    this.mapControlsService.saveShowControls(newShowControls);

    if (callbacks?.onToggleControls) {
      callbacks.onToggleControls(newShowControls);
    }

    return {
      ...currentState,
      showControls: newShowControls
    };
  }

}