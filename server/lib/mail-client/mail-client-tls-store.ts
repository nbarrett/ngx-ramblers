import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { dateTimeNow } from "../shared/dates";
import { MailClientTlsCertificate, MailClientTlsChallenge, MailClientTlsLease } from "./mail-client-tls.model";

export async function storedMailClientCertificate(hostname: string): Promise<MailClientTlsCertificate | null> {
  return mongoose.connection.db.collection<MailClientTlsCertificate>("mailClientTlsCertificates").findOne({_id: hostname});
}

export async function saveMailClientCertificate(certificate: MailClientTlsCertificate): Promise<void> {
  await mongoose.connection.db.collection<MailClientTlsCertificate>("mailClientTlsCertificates").replaceOne({_id: certificate._id}, certificate, {upsert: true});
}

export async function acquireMailClientCertificateLease(hostname: string): Promise<string> {
  const owner = randomUUID();
  await mongoose.connection.db.collection<MailClientTlsLease>("mailClientTlsLeases").findOneAndUpdate(
    {_id: hostname, expiresAt: {$lt: dateTimeNow().toMillis()}},
    {$set: {owner, expiresAt: dateTimeNow().plus({minutes: 5}).toMillis()}},
    {upsert: true}
  );
  return owner;
}

export async function releaseMailClientCertificateLease(hostname: string, owner: string): Promise<void> {
  await mongoose.connection.db.collection<MailClientTlsLease>("mailClientTlsLeases").updateOne({_id: hostname, owner}, {$set: {expiresAt: 0}});
}

export async function saveMailClientChallenge(token: string, keyAuthorization: string): Promise<void> {
  await mongoose.connection.db.collection<MailClientTlsChallenge>("mailClientTlsChallenges").updateOne(
    {_id: token}, {$set: {keyAuthorization, expiresAt: dateTimeNow().plus({minutes: 10}).toMillis()}}, {upsert: true}
  );
}

export async function expireMailClientChallenge(token: string): Promise<void> {
  await mongoose.connection.db.collection<MailClientTlsChallenge>("mailClientTlsChallenges").updateOne({_id: token}, {$set: {expiresAt: 0}});
}

export async function mailClientChallenge(token: string): Promise<MailClientTlsChallenge | null> {
  return mongoose.connection.db.collection<MailClientTlsChallenge>("mailClientTlsChallenges").findOne({_id: token, expiresAt: {$gt: dateTimeNow().toMillis()}});
}
