import expect from "expect";
import { DateTime } from "luxon";
import { describe, it } from "mocha";
import {
  buildNewsletterPlanInput,
  DEFAULT_PLAN_DAYS,
  jsonObjectFrom,
  MAX_REQUEST_CHARS,
  parseNewsletterPlan
} from "./newsletter-plan";

const today = DateTime.fromISO("2026-08-02T09:30:00");
const todayMillis = today.toMillis();

describe("newsletter-plan", () => {

  describe("buildNewsletterPlanInput", () => {
    it("supplies the current date in both machine and human form", () => {
      const input = buildNewsletterPlanInput({ request: "the next six weeks" }, todayMillis);
      expect(input).toContain("2026-08-02");
      expect(input).toContain("Sunday 2 August 2026");
      expect(input).toContain("the next six weeks");
    });

    it("caps an over-long request", () => {
      const input = buildNewsletterPlanInput({ request: "x".repeat(MAX_REQUEST_CHARS + 500) }, todayMillis);
      expect(input).toContain("x".repeat(MAX_REQUEST_CHARS));
      expect(input).not.toContain("x".repeat(MAX_REQUEST_CHARS + 1));
    });

    it("copes with an empty request", () => {
      expect(buildNewsletterPlanInput({ request: "" }, todayMillis)).toContain("What they asked for:");
    });
  });

  describe("jsonObjectFrom", () => {
    it("reads a bare object", () => {
      expect(jsonObjectFrom("{\"fromDate\": \"2026-08-02\"}")).toEqual({ fromDate: "2026-08-02" });
    });

    it("reads an object wrapped in a code fence", () => {
      expect(jsonObjectFrom("```json\n{\"fromDate\": \"2026-08-02\"}\n```")).toEqual({ fromDate: "2026-08-02" });
    });

    it("reads an object with chatter around it", () => {
      expect(jsonObjectFrom("Here you go:\n{\"fromDate\": \"2026-08-02\"}\nHope that helps")).toEqual({ fromDate: "2026-08-02" });
    });

    it("returns null when there is no object", () => {
      expect(jsonObjectFrom("I could not work that out")).toEqual(null);
      expect(jsonObjectFrom("")).toEqual(null);
    });

    it("returns null when the object will not parse", () => {
      expect(jsonObjectFrom("{fromDate: not json}")).toEqual(null);
    });
  });

  describe("parseNewsletterPlan", () => {
    it("takes the dates, description and guidance it was given", () => {
      const plan = parseNewsletterPlan(JSON.stringify({
        fromDate: "2026-08-02",
        toDate: "2026-09-13",
        periodDescription: "the next six weeks",
        guidance: "highlight the coach trip"
      }), todayMillis);
      expect(plan.understood).toEqual(true);
      expect(DateTime.fromMillis(plan.fromMillis).toFormat("yyyy-MM-dd")).toEqual("2026-08-02");
      expect(DateTime.fromMillis(plan.toMillis).toFormat("yyyy-MM-dd")).toEqual("2026-09-13");
      expect(DateTime.fromMillis(plan.toMillis).hour).toEqual(23);
      expect(plan.periodDescription).toEqual("the next six weeks");
      expect(plan.guidance).toEqual("highlight the coach trip");
    });

    it("describes the period itself when no description came back", () => {
      const plan = parseNewsletterPlan(JSON.stringify({ fromDate: "2026-08-02", toDate: "2026-09-13" }), todayMillis);
      expect(plan.periodDescription).toEqual("2 August to 13 September 2026");
      expect(plan.guidance).toEqual(null);
    });

    it("falls back to a month from today when nothing usable came back", () => {
      const plan = parseNewsletterPlan("I am afraid I cannot help with that", todayMillis);
      expect(plan.understood).toEqual(false);
      expect(DateTime.fromMillis(plan.fromMillis).toFormat("yyyy-MM-dd")).toEqual("2026-08-02");
      expect(DateTime.fromMillis(plan.toMillis).toFormat("yyyy-MM-dd"))
        .toEqual(today.plus({ days: DEFAULT_PLAN_DAYS }).toFormat("yyyy-MM-dd"));
    });

    it("falls back when the period runs backwards", () => {
      const plan = parseNewsletterPlan(JSON.stringify({ fromDate: "2026-09-13", toDate: "2026-08-02" }), todayMillis);
      expect(plan.understood).toEqual(false);
    });

    it("falls back when the period is longer than a year", () => {
      const plan = parseNewsletterPlan(JSON.stringify({ fromDate: "2026-08-02", toDate: "2028-08-02" }), todayMillis);
      expect(plan.understood).toEqual(false);
    });

    it("falls back when the dates are not dates", () => {
      const plan = parseNewsletterPlan(JSON.stringify({ fromDate: "soon", toDate: "later" }), todayMillis);
      expect(plan.understood).toEqual(false);
    });

    it("keeps the guidance even when the dates were unusable", () => {
      const plan = parseNewsletterPlan(JSON.stringify({ guidance: "mention the new members walk" }), todayMillis);
      expect(plan.understood).toEqual(false);
      expect(plan.guidance).toEqual("mention the new members walk");
    });
  });
});
