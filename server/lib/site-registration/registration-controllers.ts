import { NextFunction, Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { RegistrationDiscoveryReport, RegistrationHistoryAction, RegistrationState } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { publicRegistration, reviewerRegistration, assertRegistrationEditable, registrationSettingsProblem } from "./registration-policy";
import { recordRegistrationHistory, registrations, registrationSettings, saveRegistrationSettings } from "./registration-store";
import { findEnvironmentFromDatabase } from "../environments/environments-config";
import { startRegistration, startRegistrationAsAdmin, confirmRegistration, emailRegistrationReturnLink, registrationForToken, saveRegistrationDraft } from "./registration-service";
import { approveRegistration, REGISTRATION_STOPPED_MESSAGE, submitRegistration, submitRegistrationDraft } from "./registration-jobs";
import { stopRegistrationImport } from "./registration-import-scrape";
import { discoverRegistrationWebsite } from "./registration-content";
import { dateTimeNowAsValue } from "../shared/dates";
import { HttpError } from "../shared/http-error";
import { preparedRegistrationSettings, registrationActor } from "./registration-defaults";
import { findRamblersDirectoryLogo } from "./registration-logos";
import { registrationSiteHealth } from "./registration-site-health";

export function requireRegistrationPlatform(_req: Request, res: Response, next: NextFunction): void {
  if (process.env.PLATFORM_ADMIN_ENABLED !== "true") {
    res.status(404).json({error: "Registration is available on the platform site."});
  } else {
    next();
  }
}

export function requireRegistrationAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!(req.user as Member)?.memberAdmin) {
    res.status(403).json({error: "Platform member administrator access required."});
  } else {
    next();
  }
}

export async function registrationAvailability(_req: Request, res: Response): Promise<void> {
  res.json({enabled: (await registrationSettings()).enabled});
}

export async function lookupRegistrationLogo(req: Request, res: Response): Promise<void> {
  const groupName = isString(req.query.groupName) ? req.query.groupName : "";
  const areaName = isString(req.query.areaName) ? req.query.areaName : "";
  res.json(await findRamblersDirectoryLogo(groupName, areaName));
}

export async function beginRegistration(req: Request, res: Response): Promise<void> {
  res.json(await startRegistration(req.body));
}

export async function beginRegistrationAsAdmin(req: Request, res: Response): Promise<void> {
  const administrator = req.user as Member;
  res.json(await startRegistrationAsAdmin(req.body, administrator?.email || administrator?.userName || registrationActor(req)));
}

export async function verifyRegistration(req: Request, res: Response): Promise<void> {
  res.json({resumeToken: await confirmRegistration(req.body.token)});
}

export async function readRegistration(req: Request, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  res.json(publicRegistration(await registrationForToken(req.header("x-registration-token"))));
}

export async function updateRegistration(req: Request, res: Response): Promise<void> {
  await saveRegistrationDraft(req.header("x-registration-token"), req.body);
  await readRegistration(req, res);
}

export async function discoverRegistration(req: Request, res: Response): Promise<void> {
  const saved = await registrationForToken(req.header("x-registration-token"));
  assertRegistrationEditable(saved);
  const website = isString(req.body?.website) && req.body.website.trim() ? req.body.website.trim() : saved.website;
  const reportProgress = async (progress: RegistrationDiscoveryReport) => {
    await registrations().updateOne({id: saved.id}, {$set: {discoveryProgress: {...progress, updatedAt: dateTimeNowAsValue()}}});
  };
  try {
    const discovered = await discoverRegistrationWebsite(website, saved.group?.group_code, reportProgress);
    await registrations().updateOne({id: saved.id, state: RegistrationState.DRAFT}, {$set: {...discovered, website: discovered.website || website, updatedAt: dateTimeNowAsValue()}});
  } finally {
    await registrations().updateOne({id: saved.id}, {$set: {discoveryProgress: null}});
  }
  await readRegistration(req, res);
}

export async function queueRegistration(req: Request, res: Response): Promise<void> {
  await submitRegistration(req.header("x-registration-token"));
  await readRegistration(req, res);
}

export async function listRegistrations(_req: Request, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const rows = await registrations().find({}).sort({updatedAt: -1}).toArray();
  res.json(await Promise.all(rows.map(async row => {
    const environmentExists = row.environmentName ? !!(await findEnvironmentFromDatabase(row.environmentName)) : false;
    return {
      ...reviewerRegistration(row),
      siteHealth: environmentExists ? await registrationSiteHealth(row) : null
    };
  })));
}

export async function readRegistrationSettings(_req: Request, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  res.json(await registrationSettings());
}

export async function updateRegistrationSettings(req: Request, res: Response): Promise<void> {
  const wantedEnable = req.body?.enabled === true;
  const prepared = await preparedRegistrationSettings(req);
  const problem = registrationSettingsProblem({...prepared.settings, enabled: false});
  if (problem) {
    throw new HttpError(400, problem);
  }
  await saveRegistrationSettings(prepared.settings);
  if (wantedEnable && prepared.enableProblem) {
    throw new HttpError(400, prepared.enableProblem);
  }
  await readRegistrationSettings(req, res);
}

export async function reviewRegistration(req: Request, res: Response): Promise<void> {
  await approveRegistration(req.params.id, registrationActor(req));
  res.json({success: true});
}

async function queueRetry(saved: {id: string; state: RegistrationState; environmentName?: string; reviewedAt?: number; importedAt?: number; reviewNotifiedAt?: number; leaseUntil?: number}, by: string): Promise<void> {
  if (![RegistrationState.FAILED, RegistrationState.BROKEN, RegistrationState.REVIEW].includes(saved.state) || saved.leaseUntil > dateTimeNowAsValue()) {
    throw new Error("Only a failed, broken or review registration with no active job can be retried.");
  }
  const environmentExists = saved.environmentName ? !!(await findEnvironmentFromDatabase(saved.environmentName)) : false;
  if (!environmentExists) {
    await registrations().updateOne({id: saved.id, state: saved.state, leaseUntil: {$lte: dateTimeNowAsValue()}}, {$set: {
      state: RegistrationState.QUEUED,
      provisionedAt: null, importedAt: null, reviewedAt: null, reviewNotifiedAt: null, invitedAt: null, error: null, progress: []
    }});
  } else {
    await registrations().updateOne({id: saved.id, state: saved.state, leaseUntil: {$lte: dateTimeNowAsValue()}}, {$set: {
      state: saved.reviewedAt ? RegistrationState.APPROVING : RegistrationState.QUEUED,
      importedAt: saved.reviewedAt ? saved.importedAt : null, reviewNotifiedAt: saved.reviewedAt ? saved.reviewNotifiedAt : null, error: null, progress: []
    }});
  }
  await recordRegistrationHistory(saved.id, RegistrationHistoryAction.RUN_AGAIN, by);
}

export async function rediscoverRegistration(req: Request, res: Response): Promise<void> {
  const saved = await registrations().findOne({id: req.params.id});
  if (!saved) {
    throw new HttpError(404, "That registration no longer exists.");
  }
  const reportProgress = async (progress: RegistrationDiscoveryReport) => {
    await registrations().updateOne({id: saved.id}, {$set: {discoveryProgress: {...progress, updatedAt: dateTimeNowAsValue()}}});
  };
  try {
    const discovered = await discoverRegistrationWebsite(saved.website, saved.group?.group_code, reportProgress);
    await registrations().updateOne({id: saved.id}, {$set: {...discovered, website: discovered.website || saved.website, updatedAt: dateTimeNowAsValue()}});
  } finally {
    await registrations().updateOne({id: saved.id}, {$set: {discoveryProgress: null}});
  }
  await recordRegistrationHistory(saved.id, RegistrationHistoryAction.PAGES_FOUND_AGAIN, registrationActor(req));
  const rediscovered = await registrations().findOne({id: saved.id});
  if (rediscovered.state === RegistrationState.DRAFT) {
    await submitRegistrationDraft(rediscovered);
  } else {
    await queueRetry(rediscovered, registrationActor(req));
  }
  res.json({success: true});
}

export async function retryRegistration(req: Request, res: Response): Promise<void> {
  const saved = await registrations().findOne({id: req.params.id});
  await queueRetry(saved, registrationActor(req));
  res.json({success: true});
}

export async function retryOwnRegistration(req: Request, res: Response): Promise<void> {
  const saved = await registrationForToken(req.header("x-registration-token"));
  await queueRetry(saved, saved.email);
  await readRegistration(req, res);
}

export async function deleteRegistration(req: Request, res: Response): Promise<void> {
  const saved = await registrations().findOne({id: req.params.id});
  if (!saved) {
    throw new Error("That registration request was not found.");
  } else if ([RegistrationState.QUEUED, RegistrationState.PROVISIONING, RegistrationState.IMPORTING, RegistrationState.APPROVING].includes(saved.state)) {
    throw new Error("Wait until the current job finishes, then delete the leftover request.");
  } else {
    await registrations().deleteOne({id: saved.id});
    res.json({success: true});
  }
}

export async function sendRegistrationReturnLink(req: Request, res: Response): Promise<void> {
  const email = await emailRegistrationReturnLink(req.params.id, registrationActor(req));
  res.json({email});
}

export async function stopRegistration(req: Request, res: Response): Promise<void> {
  const stopped = await registrations().findOneAndUpdate(
    {id: req.params.id, state: {$in: [RegistrationState.QUEUED, RegistrationState.PROVISIONING, RegistrationState.IMPORTING, RegistrationState.APPROVING]}},
    {$set: {state: RegistrationState.FAILED, error: REGISTRATION_STOPPED_MESSAGE, leaseOwner: null, leaseUntil: 0, updatedAt: dateTimeNowAsValue()}},
    {returnDocument: "after"}
  );
  if (!stopped) {
    throw new Error("Only a queued or running build can be stopped.");
  } else {
    await recordRegistrationHistory(stopped.id, RegistrationHistoryAction.STOPPED, registrationActor(req));
    await stopRegistrationImport(stopped.id, REGISTRATION_STOPPED_MESSAGE);
    res.json({success: true});
  }
}

export async function markRegistrationBroken(req: Request, res: Response): Promise<void> {
  const result = await registrations().updateOne({id: req.params.id, state: RegistrationState.REVIEW}, {$set: {state: RegistrationState.BROKEN, error: "Returned by the platform reviewer."}});
  if (!result.matchedCount) {
    throw new Error("Only a site awaiting review can be returned as broken.");
  }
  await recordRegistrationHistory(req.params.id, RegistrationHistoryAction.MARKED_BROKEN, registrationActor(req));
  res.json({success: true});
}

export function registrationError(error: Error, _req: Request, res: Response, _next: NextFunction): void {
  res.status(400).json({error: error.message});
}
