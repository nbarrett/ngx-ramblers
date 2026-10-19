import * as L from "leaflet";
import {Subject} from "rxjs";
import {MapEditComponent} from "./map-edit";
import {DEFAULT_OS_STYLE, MapProvider} from "../../../models/map.model";
import {SystemConfig} from "../../../models/system.model";

describe("walk thumbnail map initialisation", () => {
  function preview() {
    const configEvents = new Subject<SystemConfig>();
    const config = {value: null as SystemConfig | null};
    const component = Object.create(MapEditComponent.prototype) as MapEditComponent;
    const createBaseLayer = vi.fn(() => L.layerGroup());
    Object.assign(component, {
      preview: true,
      locationDetails: {latitude: 51.2, longitude: 0.7},
      systemConfigService: {systemConfig: () => config.value, events: () => configEvents},
      mapTiles: {
        hasOsApiKey: () => !!config.value?.externalSystems?.osMaps?.apiKey,
        createBaseLayer,
        crsForStyle: () => L.CRS.EPSG3857,
        maxZoomForStyle: () => 14,
        matchingZoom: () => 7
      },
      markerStyle: {smallPreviewPinIcon: () => L.divIcon()},
      logger: {info: vi.fn(), error: vi.fn()},
      renderWaypoints: vi.fn()
    });
    return {component, config, configEvents, createBaseLayer};
  }

  it("waits for site settings before choosing OS Explorer rather than locking in OpenStreetMap", async () => {
    const {component, config, configEvents, createBaseLayer} = preview();
    const initialisation = component["prepareLocationsAndConfigure"]();
    expect(createBaseLayer).not.toHaveBeenCalled();
    config.value = {externalSystems: {osMaps: {apiKey: "fictional-key"}}} as SystemConfig;
    configEvents.next(config.value);
    await initialisation;
    expect(createBaseLayer).toHaveBeenCalledWith(MapProvider.OS, DEFAULT_OS_STYLE);
    expect(component.options.zoom).toBe(7);
  });

  it("does not create a map after the thumbnail is removed while settings are loading", async () => {
    const {component, configEvents, createBaseLayer} = preview();
    const initialisation = component["prepareLocationsAndConfigure"]();
    component["destroyed"] = true;
    configEvents.next({} as SystemConfig);
    await initialisation;
    expect(createBaseLayer).not.toHaveBeenCalled();
  });
});
