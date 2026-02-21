import { venue } from "../models/venue";
import * as crudController from "./crud-controller";
import { StoredVenue } from "../../../../projects/ngx-ramblers/src/app/models/event-venue.model";
import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import * as transforms from "./transforms";
import { dateTimeNowAsValue } from "../../shared/dates";
import { postcodeLookupFromPostcodesIo } from "../../addresses/postcode-lookup";
import { isArray } from "es-toolkit/compat";

const controller = crudController.create<StoredVenue>(venue);
const debugLog = debug(envConfig.logNamespace("venue"));
debugLog.enabled = false;

async function geocodeFromPostcode(postcode: string): Promise<{ lat: number; lon: number } | null> {
  const trimmedPostcode = (postcode || "").trim();
  if (!trimmedPostcode) {
    return null;
  }
  try {
    const result = await postcodeLookupFromPostcodesIo(trimmedPostcode);
    const response = isArray(result?.response) ? result.response[0] : result?.response;
    if (response?.latlng?.lat && response?.latlng?.lng) {
      debugLog("geocodeFromPostcode: success for", trimmedPostcode, "->", response.latlng);
      return { lat: response.latlng.lat, lon: response.latlng.lng };
    }
    debugLog("geocodeFromPostcode: no coordinates found for", trimmedPostcode);
    return null;
  } catch (error) {
    debugLog("geocodeFromPostcode: error for", trimmedPostcode, error);
    return null;
  }
}

export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findByConditions = controller.findByConditions;
export const update = controller.update;
export const findById = controller.findById;

export async function findOrCreate(req: Request, res: Response) {
  const venueData = req.body as StoredVenue;
  debugLog("findOrCreate: received venue data:", venueData);

  if (!venueData.name) {
    return res.status(400).json({message: "Venue name is required"});
  }

  try {
    let existingVenue = null;
    if (venueData.id) {
      existingVenue = await venue.findById(venueData.id);
      debugLog("findOrCreate: looked up by storedVenueId:", venueData.id, "found:", !!existingVenue);
    }

    if (!existingVenue) {
      const normalizedName = venueData.name.trim().toLowerCase();
      const normalizedPostcode = (venueData.postcode || "").trim().toLowerCase();

      existingVenue = await venue.findOne({
        $expr: {
          $and: [
            {$eq: [{$toLower: {$trim: {input: "$name"}}}, normalizedName]},
            {$eq: [{$toLower: {$trim: {input: {$ifNull: ["$postcode", ""]}}}}, normalizedPostcode]}
          ]
        }
      });
      debugLog("findOrCreate: looked up by name+postcode, found:", !!existingVenue);
    }

    if (existingVenue) {
      debugLog("findOrCreate: found existing venue:", existingVenue._id);
      existingVenue.usageCount = (existingVenue.usageCount || 0) + 1;
      existingVenue.lastUsed = dateTimeNowAsValue();
      existingVenue.updatedAt = dateTimeNowAsValue();
      if (venueData.name) {
        existingVenue.name = venueData.name;
      }
      if (venueData.postcode) {
        existingVenue.postcode = venueData.postcode;
      }
      if (venueData.type) {
        existingVenue.type = venueData.type;
      }
      if (venueData.url) {
        existingVenue.url = venueData.url;
      }
      if (venueData.lat) {
        existingVenue.lat = venueData.lat;
      }
      if (venueData.lon) {
        existingVenue.lon = venueData.lon;
      }
      if (venueData.address1) {
        existingVenue.address1 = venueData.address1;
      }
      if (venueData.address2) {
        existingVenue.address2 = venueData.address2;
      }

      const postcodeToGeocode = venueData.postcode || existingVenue.postcode;
      if (postcodeToGeocode && !existingVenue.lat && !existingVenue.lon) {
        const coords = await geocodeFromPostcode(postcodeToGeocode);
        if (coords) {
          existingVenue.lat = coords.lat;
          existingVenue.lon = coords.lon;
          debugLog("findOrCreate: auto-geocoded existing venue to", coords);
        }
      }

      await existingVenue.save();
      return res.status(200).json(transforms.toObjectWithId(existingVenue));
    }

    debugLog("findOrCreate: creating new venue");
    const venueDocData: Partial<StoredVenue> = {
      ...venueData,
      usageCount: 1,
      lastUsed: dateTimeNowAsValue(),
      createdAt: dateTimeNowAsValue()
    };

    if (venueData.postcode && (!venueData.lat || !venueData.lon)) {
      const coords = await geocodeFromPostcode(venueData.postcode);
      if (coords) {
        venueDocData.lat = coords.lat;
        venueDocData.lon = coords.lon;
        debugLog("findOrCreate: auto-geocoded new venue to", coords);
      }
    }

    const newVenue = new venue(venueDocData);
    const savedVenue = await newVenue.save();
    return res.status(201).json(transforms.toObjectWithId(savedVenue));

  } catch (error) {
    debugLog("findOrCreate: error:", error);
    return res.status(500).json({message: "Failed to find or create venue", error: String(error)});
  }
}

export async function updateCoordinates(req: Request, res: Response) {
  const {id, lat, lon} = req.body;
  debugLog("updateCoordinates: id:", id, "lat:", lat, "lon:", lon);

  try {
    const updatedVenue = await venue.findByIdAndUpdate(
      id,
      {lat, lon, updatedAt: dateTimeNowAsValue()},
      {new: true}
    );

    if (!updatedVenue) {
      return res.status(404).json({message: "Venue not found"});
    }

    return res.status(200).json(transforms.toObjectWithId(updatedVenue));
  } catch (error) {
    debugLog("updateCoordinates: error:", error);
    return res.status(500).json({message: "Failed to update coordinates", error: String(error)});
  }
}
