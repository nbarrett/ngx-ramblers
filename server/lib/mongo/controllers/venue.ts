import { venue } from "../models/venue";
import * as crudController from "./crud-controller";
import { StoredVenue } from "../../../../projects/ngx-ramblers/src/app/models/event-venue.model";
import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import * as transforms from "./transforms";
import { dateTimeNowAsValue } from "../../shared/dates";

const controller = crudController.create<StoredVenue>(venue);
const debugLog = debug(envConfig.logNamespace("venue"));
debugLog.enabled = false;

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
    const normalizedName = venueData.name.trim().toLowerCase();
    const normalizedPostcode = (venueData.postcode || "").trim().toLowerCase();

    const existingVenue = await venue.findOne({
      $expr: {
        $and: [
          {$eq: [{$toLower: {$trim: {input: "$name"}}}, normalizedName]},
          {$eq: [{$toLower: {$trim: {input: {$ifNull: ["$postcode", ""]}}}}, normalizedPostcode]}
        ]
      }
    });

    if (existingVenue) {
      debugLog("findOrCreate: found existing venue:", existingVenue._id);
      existingVenue.usageCount = (existingVenue.usageCount || 0) + 1;
      existingVenue.lastUsed = dateTimeNowAsValue();
      if (venueData.type && !existingVenue.type) {
        existingVenue.type = venueData.type;
      }
      if (venueData.url && !existingVenue.url) {
        existingVenue.url = venueData.url;
      }
      if (venueData.lat && !existingVenue.lat) {
        existingVenue.lat = venueData.lat;
      }
      if (venueData.lon && !existingVenue.lon) {
        existingVenue.lon = venueData.lon;
      }
      await existingVenue.save();
      return res.status(200).json(transforms.toObjectWithId(existingVenue));
    }

    debugLog("findOrCreate: creating new venue");
    const newVenue = new venue({
      ...venueData,
      usageCount: 1,
      lastUsed: dateTimeNowAsValue(),
      createdAt: dateTimeNowAsValue()
    });
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
