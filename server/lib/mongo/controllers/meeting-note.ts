import { Request, Response } from "express";
import { meetingNote } from "../models/meeting-note";
import * as crudController from "./crud-controller";
import * as transforms from "./transforms";
import { MeetingNote } from "../../../../projects/ngx-ramblers/src/app/models/video-meeting.model";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";

const controller = crudController.create<MeetingNote>(meetingNote);

export const create = controller.create;
export const all = controller.all;
export const update = controller.update;
export const deleteOne = controller.deleteOne;
export const findById = controller.findById;

export async function findByRoom(req: Request, res: Response): Promise<void> {
  try {
    const room = req.params.room;
    const results = await meetingNote.find({room}).sort({createdAt: 1}).lean().exec();
    res.status(200).json({
      action: ApiAction.QUERY,
      response: results.map(result => transforms.toObjectWithId(result))
    });
  } catch (error) {
    res.status(500).json({
      message: "Meeting notes query failed",
      request: req.params.room,
      error: transforms.parseError(error)
    });
  }
}
