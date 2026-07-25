import { AnswersQuestions, Interaction, UsesAbilities } from "@serenity-js/core";
import { BrowseTheWeb } from "@serenity-js/web";
import debug from "debug";
import { jointWalkLeaderNames } from "../../../../../../../projects/ngx-ramblers/src/app/functions/walks/joint-walk-leaders";
import { envConfig } from "../../../../../env-config/env-config";
import { pluraliseWithCount } from "../../../../../shared/string-utils";

const debugLog = debug(envConfig.logNamespace("SelectWalkLeaders"));
debugLog.enabled = true;

type SelectWalkLeadersOutcome = {
  ok: boolean;
  reason?: string;
  matched?: string[];
  primary?: string;
  available?: string[];
};

export class SelectWalkLeaders extends Interaction {

  static named(walkLeaders: string): SelectWalkLeaders {
    return new SelectWalkLeaders(walkLeaders || "");
  }

  constructor(private readonly walkLeaders: string) {
    super(`#actor selects walk leaders ${walkLeaders || "(none)"}`);
  }

  async performAs(actor: UsesAbilities & AnswersQuestions): Promise<void> {
    const desiredNames = jointWalkLeaderNames(this.walkLeaders);
    debugLog("selecting walk leaders:", desiredNames);
    const page = await BrowseTheWeb.as(actor).currentPage();
    const outcome = await page.executeScript((names: string[]) => {
      const normalise = (value: string) => (value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const nameMatches = (localName: string, tableName: string) => {
        const local = normalise(localName);
        const table = normalise(tableName);
        if (!local || !table) {
          return false;
        }
        if (local === table) {
          return true;
        }
        const localTokens = local.split(" ").filter(token => !!token);
        const tableTokens = table.split(" ").filter(token => !!token);
        if (localTokens.length < 2 || tableTokens.length < 2) {
          return local.includes(table) || table.includes(local);
        }
        const localFirst = localTokens[0];
        const tableFirst = tableTokens[0];
        const firstCompatible = localFirst === tableFirst
          || localFirst.startsWith(tableFirst)
          || tableFirst.startsWith(localFirst);
        if (!firstCompatible) {
          return false;
        }
        const localSurname = localTokens.slice(1).join(" ");
        const tableSurname = tableTokens.slice(1).join(" ");
        if (localSurname === tableSurname) {
          return true;
        }
        if (localSurname.length === 1 && tableSurname.startsWith(localSurname)) {
          return true;
        }
        if (tableSurname.length === 1 && localSurname.startsWith(tableSurname)) {
          return true;
        }
        const localLast = localTokens[localTokens.length - 1];
        const tableLast = tableTokens[tableTokens.length - 1];
        if (localLast.length === 1 && tableLast.startsWith(localLast)) {
          return true;
        }
        if (tableLast.length === 1 && localLast.startsWith(tableLast)) {
          return true;
        }
        return false;
      };

      const waitForLeaders = (attemptsLeft: number): Promise<SelectWalkLeadersOutcome> => {
        const table = document.querySelector("table#ramled-group-nominated, table[data-table-id='ramled-group-nominated']");
        if (!table) {
          if (attemptsLeft <= 0) {
            return Promise.resolve({ok: false, reason: "Walk leaders table not found on basic information"});
          }
          return new Promise(resolve => window.setTimeout(() => resolve(waitForLeaders(attemptsLeft - 1)), 250));
        }

        const rows = Array.from(table.querySelectorAll("tbody tr"));
        const leaders = rows.map(row => {
          const checkbox = row.querySelector("input[type='checkbox']") as HTMLInputElement | null;
          const primary = row.querySelector("input[type='radio']") as HTMLInputElement | null;
          const cells = row.querySelectorAll("td");
          const name = (cells[1]?.textContent || "").trim();
          return {name, checkbox, primary};
        }).filter(leader => !!leader.checkbox && !!leader.primary && !!leader.name) as {
          name: string;
          checkbox: HTMLInputElement;
          primary: HTMLInputElement;
        }[];

        if (leaders.length === 0) {
          if (attemptsLeft <= 0) {
            return Promise.resolve({ok: false, reason: "No walk leaders loaded in the Walks Manager group list"});
          }
          return new Promise(resolve => window.setTimeout(() => resolve(waitForLeaders(attemptsLeft - 1)), 250));
        }

        const desired = (names || []).map(name => name.trim()).filter(name => !!name);
        if (desired.length === 0) {
          return Promise.resolve({ok: false, reason: "No walk leader names were provided to select"});
        }

        const missing = desired.filter(name => !leaders.some(leader => nameMatches(name, leader.name)));
        if (missing.length > 0) {
          return Promise.resolve({
            ok: false,
            reason: `${pluraliseWithCount(missing.length, "walk leader")} not found in Walks Manager group list: ${missing.join(", ")}. Available: ${leaders.map(leader => leader.name).join(", ")}`,
            available: leaders.map(leader => leader.name)
          });
        }

        leaders.forEach(leader => {
          const shouldSelect = desired.some(name => nameMatches(name, leader.name));
          if (shouldSelect !== leader.checkbox.checked) {
            leader.checkbox.click();
          }
        });

        const primaryName = desired[0];
        const primaryLeader = leaders.find(leader => nameMatches(primaryName, leader.name));
        if (primaryLeader && !primaryLeader.primary.checked && !primaryLeader.primary.disabled) {
          primaryLeader.primary.click();
        }

        leaders.forEach(leader => {
          leader.checkbox.dispatchEvent(new Event("change", {bubbles: true}));
          leader.primary.dispatchEvent(new Event("change", {bubbles: true}));
        });

        const matched = leaders
          .filter(leader => leader.checkbox.checked)
          .map(leader => leader.name);

        return Promise.resolve({
          ok: true,
          matched,
          primary: primaryLeader?.name || matched[0]
        });
      };

      return waitForLeaders(120);
    }, desiredNames) as SelectWalkLeadersOutcome;

    if (!outcome.ok) {
      throw new Error(outcome.reason || "Failed to select walk leaders");
    }
    debugLog("selected walk leaders:", outcome.matched, "primary:", outcome.primary);
  }
}
