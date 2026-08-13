import { Request, Response } from "express";
import { videoMeeting } from "../models/video-meeting";
import * as crudController from "./crud-controller";
import * as transforms from "./transforms";
import { VideoMeeting } from "../../../../projects/ngx-ramblers/src/app/models/video-meeting.model";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";

const controller = crudController.create<VideoMeeting>(videoMeeting);

export const create = controller.create;
export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findById = controller.findById;

export async function findByRoom(req: Request, res: Response): Promise<void> {
  try {
    const result = await videoMeeting.findOne({room: req.params.room}).lean().exec();
    res.status(200).json({
      action: ApiAction.QUERY,
      response: transforms.toObjectWithId(result)
    });
  } catch (error) {
    res.status(500).json({
      message: "Video meeting query failed",
      request: req.params.room,
      error: transforms.parseError(error)
    });
  }
}
