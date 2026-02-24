import { RRule } from "rrule";

export function normalizeAndValidateRRule(input: string): string {
  const trimmed = input.trim();
  const normalized = trimmed.replace(/^RRULE:/i, "");
  RRule.fromString(normalized);
  return normalized;
}

export function toGoogleRecurrence(input: string | null | undefined): string[] | undefined {
  if (!input) return undefined;
  return [`RRULE:${normalizeAndValidateRRule(input)}`];
}
