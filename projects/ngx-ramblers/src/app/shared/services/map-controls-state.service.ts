import { inject, Injectable } from "@angular/core";
import { MapProvider } from "../../models/map.model";
import { UiActionsService } from "../../services/ui-actions.service";
import { StoredValue } from "../../models/ui-actions";
import { MapTilesService } from "../../services/maps/map-tiles.service";
import { MapControlsState } from "../components/map-controls";
import { isUndefined } from "es-toolkit/compat";
import { asNumber } from "../../functions/numbers";

@Injectable({
  providedIn: "root"
})
export class MapControlsStateService {
  private uiActions = inject(UiActionsService);
  private mapTiles = inject(MapTilesService);

  queryInitialState(defaults: Partial<MapControlsState> = {}): MapControlsState {
    const storedProvider = this.uiActions.initialValueFor(StoredValue.MAP_PROVIDER, null) as MapProvider;
    const storedStyle = this.uiActions.initialValueFor(StoredValue.MAP_OS_STYLE, null) as string;
    const storedSmooth = this.uiActions.initialBooleanValueFor(StoredValue.MAP_SMOOTH_SCROLL, true);
    const storedHeight = this.uiActions.initialValueFor(StoredValue.MAP_HEIGHT, 520) as unknown as number;
    const storedShow = this.uiActions.initialBooleanValueFor(StoredValue.MAP_SHOW_CONTROLS, true);
    const storedAuto = this.uiActions.initialBooleanValueFor(StoredValue.MAP_AUTO_SHOW_ALL, false);

    const hasKey = this.mapTiles.hasOsApiKey();

    let provider: MapProvider;
    if (storedProvider === "os" || storedProvider === "osm") {
      provider = storedProvider;
    } else {
      provider = hasKey ? "os" : "osm";
    }

    if (provider === "os" && !hasKey) {
      provider = "osm";
      this.uiActions.saveValueFor(StoredValue.MAP_PROVIDER, "osm");
    }

    const defaultOsStyle = hasKey ? "Leisure_27700" : "outdoor";
    let osStyle = defaults.osStyle || defaultOsStyle;
    if (storedStyle && provider === "os") {
      osStyle = storedStyle;
    }

    const parsedHeight = asNumber(storedHeight);
    const mapHeight = !isNaN(parsedHeight) ? Math.min(900, Math.max(300, parsedHeight))
      : (!isUndefined(defaults.mapHeight) ? defaults.mapHeight : 520);

    return {
      provider,
      osStyle,
      mapHeight,
      smoothScroll: !isUndefined(defaults.smoothScroll) ? storedSmooth : undefined,
      autoShowAll: !isUndefined(defaults.autoShowAll) ? storedAuto : undefined
    };
  }

  saveProvider(provider: MapProvider) {
    this.uiActions.saveValueFor(StoredValue.MAP_PROVIDER, provider);
  }

  saveOsStyle(style: string) {
    this.uiActions.saveValueFor(StoredValue.MAP_OS_STYLE, style);
  }

  saveHeight(height: number) {
    this.uiActions.saveValueFor(StoredValue.MAP_HEIGHT, height);
  }

  saveSmoothScroll(value: boolean) {
    this.uiActions.saveValueFor(StoredValue.MAP_SMOOTH_SCROLL, value);
  }

  saveAutoShowAll(value: boolean) {
    this.uiActions.saveValueFor(StoredValue.MAP_AUTO_SHOW_ALL, value);
  }

  saveShowControls(value: boolean) {
    this.uiActions.saveValueFor(StoredValue.MAP_SHOW_CONTROLS, value);
  }

  saveZoom(zoom: number) {
    this.uiActions.saveValueFor(StoredValue.MAP_ZOOM, zoom);
  }
}
