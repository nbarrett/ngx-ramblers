import { ImportedRouteNumberCounter } from "../../models/os-maps-imported-route";
import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("assign-immutable-imported-route-numbers");
const ROUTES_COLLECTION = "osMapsImportedRoutes";
const COUNTERS_COLLECTION = "counters";
const ROUTE_NUMBER_COUNTER_ID = "imported-route-number";

export async function up(db: Db, _client: MongoClient) {
  debugLog("Assigning immutable route numbers starting at 1");
  const routes = await db.collection(ROUTES_COLLECTION)
    .find({})
    .sort({importedAt: 1, routeId: 1})
    .toArray();
  const counter = await db.collection<ImportedRouteNumberCounter>(COUNTERS_COLLECTION).findOne({_id: ROUTE_NUMBER_COUNTER_ID});
  const highestNumber = Math.max(counter?.seq || 0, ...routes.map(route => route.number || 0));
  const progress = {assigned: 0, kept: 0, next: highestNumber + 1};
  await routes.reduce(async (previous, route) => {
    await previous;
    if (route.number) {
      progress.kept += 1;
    } else {
      await db.collection(ROUTES_COLLECTION).updateOne(
        {_id: route._id},
        {$set: {number: progress.next}}
      );
      progress.assigned += 1;
      progress.next += 1;
    }
  }, Promise.resolve());
  await db.collection<ImportedRouteNumberCounter>(COUNTERS_COLLECTION).updateOne(
    {_id: ROUTE_NUMBER_COUNTER_ID},
    {$max: {seq: progress.next - 1}},
    {upsert: true}
  );
  debugLog("Route numbers ready: assigned=%d kept=%d next=%d", progress.assigned, progress.kept, progress.next);
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("No down migration - immutable route numbers stay in place");
}
