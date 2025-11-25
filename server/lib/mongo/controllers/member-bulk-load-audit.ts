import { Request, Response } from "express";
import { PipelineStage } from "mongoose";
import { memberBulkLoadAudit } from "../models/member-bulk-load-audit";
import { MemberBulkLoadDateMap } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

type MemberBulkLoadDateMapResult = {
  dateMap: MemberBulkLoadDateMap;
};

export async function memberBulkLoadDateMap(req: Request, res: Response) {
  const pipeline: PipelineStage[] = [
    {$sort: {createdDate: -1}},
    {$unwind: "$members"},
    {$group: {
      _id: "$members.membershipNumber",
      lastBulkLoadDate: {$first: "$createdDate"}
    }},
    {$group: {
      _id: null,
      entries: {
        $push: {
          k: "$_id",
          v: "$lastBulkLoadDate"
        }
      }
    }},
    {$project: {
      _id: 0,
      dateMap: {$arrayToObject: "$entries"}
    }}
  ];
  const results = await memberBulkLoadAudit.aggregate<MemberBulkLoadDateMapResult>(pipeline);
  const dateMap = results[0]?.dateMap || {};
  res.json(dateMap);
}
