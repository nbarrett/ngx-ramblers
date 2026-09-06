import { LocationDetails } from "./ramblers-walks-manager";
import { WalkType } from "./walk.model";

export interface GpxDerivedValues {
  shape: WalkType;
  miles: number;
  km: number;
  ascentMetres: number;
  startLocation: LocationDetails | null;
  endLocation: LocationDetails | null;
}
