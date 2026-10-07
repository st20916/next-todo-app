import { describe, expect, it } from "vitest";
import { aggregateProgress, calcProgress } from "@/lib/progress";

describe("calcProgress", () => {
  it.each([
    [0, 0, 0],
    [1, 3, 33],
    [1, 2, 50],
    [2, 3, 67],
    [3, 3, 100],
    [0, 4, 0],
  ])("done=%i total=%i -> %i%%", (done, total, percent) => {
    expect(calcProgress(done, total).percent).toBe(percent);
  });

  it("returns 0% (not NaN) when there are no todos", () => {
    expect(calcProgress(0, 0)).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("aggregateProgress (weighted, AC11)", () => {
  it("weekly A 1/1 + weekly B 0/3 -> 25%, not the 50% simple average", () => {
    const result = aggregateProgress([
      { done: 1, total: 1 },
      { done: 0, total: 3 },
    ]);
    expect(result).toEqual({ done: 1, total: 4, percent: 25 });
  });

  it("returns 0% for no plans", () => {
    expect(aggregateProgress([]).percent).toBe(0);
  });

  it("returns 0% when every plan is empty", () => {
    expect(aggregateProgress([{ done: 0, total: 0 }, { done: 0, total: 0 }]).percent).toBe(0);
  });
});
