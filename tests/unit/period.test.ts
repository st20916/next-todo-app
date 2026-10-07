import { describe, expect, it } from "vitest";
import { addDays, isWithinPeriod } from "@/lib/period";

const start = "2026-10-05";
const end = "2026-10-11";

describe("isWithinPeriod", () => {
  it("includes the start date", () => expect(isWithinPeriod(start, start, end)).toBe(true));
  it("includes the end date", () => expect(isWithinPeriod(end, start, end)).toBe(true));
  it("accepts a date in the middle", () => expect(isWithinPeriod("2026-10-08", start, end)).toBe(true));
  it("rejects the day before start", () => expect(isWithinPeriod("2026-10-04", start, end)).toBe(false));
  it("rejects the day after end", () => expect(isWithinPeriod("2026-10-12", start, end)).toBe(false));
  it("treats a missing date as allowed (weekly backlog)", () => {
    expect(isWithinPeriod(undefined, start, end)).toBe(true);
    expect(isWithinPeriod(null, start, end)).toBe(true);
  });
});

describe("addDays", () => {
  it("rolls over month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
