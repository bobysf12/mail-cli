import { describe, expect, test } from "bun:test";
import { normalizeAndValidateRRule, toGoogleRecurrence } from "../src/lib/rrule.js";

describe("rrule helpers", () => {
  test("normalizes prefix", () => {
    const value = normalizeAndValidateRRule("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(value).toBe("FREQ=WEEKLY;BYDAY=MO");
  });

  test("returns google recurrence format", () => {
    const value = toGoogleRecurrence("FREQ=DAILY;COUNT=3");
    expect(value).toEqual(["RRULE:FREQ=DAILY;COUNT=3"]);
  });

  test("throws on invalid rrule", () => {
    expect(() => normalizeAndValidateRRule("FREQ=INVALID")).toThrow();
  });
});
