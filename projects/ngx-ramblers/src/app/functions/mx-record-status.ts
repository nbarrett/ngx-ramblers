import { MxExistingRecord, MxRecordStatus } from "../models/cloudflare-email-routing.model";

export const CLOUDFLARE_INBOUND_MX: {content: string; priority: number}[] = [
  {content: "route1.mx.cloudflare.net", priority: 16},
  {content: "route2.mx.cloudflare.net", priority: 99},
  {content: "route3.mx.cloudflare.net", priority: 2}
];

const requiredContents = new Set(CLOUDFLARE_INBOUND_MX.map(mx => mx.content));

export function buildMxRecordStatus(subdomain: string, existingRecords: MxExistingRecord[]): MxRecordStatus {
  const expectedRecords = CLOUDFLARE_INBOUND_MX.map(mx => ({
    content: mx.content,
    priority: mx.priority,
    exists: existingRecords.some(record => record.content === mx.content)
  }));
  const extraRecords = existingRecords.filter(record => !requiredContents.has(record.content));
  return {
    subdomain,
    allPresent: expectedRecords.every(record => record.exists),
    expectedRecords,
    existingRecords,
    extraRecords
  };
}
