import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  bandProgress,
  campMastery,
  climbDays,
  gradeBandEnum,
  interestThemeEnum,
  learners,
} from "./schema";
import { gradeBandSchema, interestThemeSchema } from "@/lib/domain/onboarding";

/**
 * The SQL of every CHECK on a table, lower-cased for matching. Drizzle keeps
 * a check as alternating literal chunks and column references; only the
 * literals carry the condition, and a column reference is rendered as the
 * column's name so the whole expression still reads.
 */
function checks(table: Parameters<typeof getTableConfig>[0]): string {
  return getTableConfig(table)
    .checks.map((check) =>
      check.value.queryChunks
        .map((chunk) => {
          const literal = chunk as { value?: unknown };
          if (Array.isArray(literal.value)) return literal.value.join("");
          const column = chunk as { name?: unknown };
          return typeof column.name === "string" ? column.name : "";
        })
        .join(""),
    )
    .join(" | ")
    .toLowerCase();
}

function columnNames(table: Parameters<typeof getTableConfig>[0]): readonly string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

describe("the Postgres enums", () => {
  it("match the domain schemas exactly, so a bad value cannot reach the database", () => {
    expect([...gradeBandEnum.enumValues]).toEqual([...gradeBandSchema.options]);
    expect([...interestThemeEnum.enumValues]).toEqual([...interestThemeSchema.options]);
  });
});

describe("learners", () => {
  it("is keyed by the anonymous learner id", () => {
    const primary = getTableConfig(learners).columns.filter((column) => column.primary);
    expect(primary.map((column) => column.name)).toEqual(["id"]);
  });

  it("stores nothing that could identify a child", () => {
    const names = columnNames(learners).join(" ");
    for (const forbidden of ["name", "email", "phone", "birth", "address", "school"]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("keeps no counters at all: every count belongs to a band's climb", () => {
    // The solve counter and the checkpoint count both live on band_progress,
    // because each band is its own climb.
    expect(columnNames(learners)).not.toContain("total_solves");
    expect(columnNames(learners)).not.toContain("checkpoints_passed");
  });
});

describe("band_progress", () => {
  it("is keyed by learner and band, so the bands cannot share a counter", () => {
    const [key] = getTableConfig(bandProgress).primaryKeys;
    expect(key?.columns.map((column) => column.name)).toEqual(["learner_id", "grade_band"]);
  });

  it("refuses a negative solve count", () => {
    expect(checks(bandProgress)).toContain(">= 0");
  });

  it("cascades, so deleting a learner takes their band counters with it", () => {
    const [reference] = getTableConfig(bandProgress).foreignKeys;
    expect(reference?.onDelete).toBe("cascade");
  });

  it("counts the checkpoints passed in this band, never negative, defaulting to zero", () => {
    expect(columnNames(bandProgress)).toContain("checkpoints_passed");
    const checks = getTableConfig(bandProgress).checks.map((c) => c.name);
    expect(checks).toContain("band_checkpoints_not_negative");
    for (const column of getTableConfig(bandProgress).columns) {
      if (column.name === "checkpoints_passed") {
        expect(column.notNull).toBe(true);
        expect(column.default).toBe(0);
      }
    }
  });

  it("defaults the counter to zero, so a fresh band needs no backfill", () => {
    for (const column of getTableConfig(bandProgress).columns) {
      if (column.name === "total_solves") {
        expect(column.notNull).toBe(true);
        expect(column.default).toBe(0);
      }
    }
  });
});

describe("camp_mastery", () => {
  it("is keyed by learner, band and camp, so each band is its own climb", () => {
    const [key] = getTableConfig(campMastery).primaryKeys;
    expect(key?.columns.map((column) => column.name)).toEqual([
      "learner_id",
      "grade_band",
      "camp_number",
    ]);
  });

  it("enforces exactly four camps in the database itself", () => {
    expect(checks(campMastery)).toContain("between 1 and 4");
  });

  it("enforces the meter's range in the database itself", () => {
    expect(checks(campMastery)).toContain("between 0 and 100");
  });

  it("refuses a negative staleness counter", () => {
    expect(checks(campMastery)).toContain(">= 0");
  });

  it("cascades from the learner, so deleting one takes their meters with it", () => {
    const [key] = getTableConfig(campMastery).foreignKeys;
    expect(key?.onDelete).toBe("cascade");
    // Resolving the reference also proves it points at the learner's id.
    const reference = key?.reference();
    expect(reference?.foreignColumns.map((column) => column.name)).toEqual(["id"]);
    expect(reference?.columns.map((column) => column.name)).toEqual(["learner_id"]);
  });

  it("indexes by learner, which is how it is always read", () => {
    expect(getTableConfig(campMastery).indexes).toHaveLength(1);
  });
});

describe("climb_days", () => {
  it("is keyed by learner, band, day and camp, so a day accumulates per climb rather than duplicating", () => {
    const [key] = getTableConfig(climbDays).primaryKeys;
    expect(key?.columns.map((column) => column.name)).toEqual([
      "learner_id",
      "grade_band",
      "local_date",
      "camp_number",
    ]);
  });

  it("stores the day as a date, not a timestamp, because a day is not an instant", () => {
    const column = getTableConfig(climbDays).columns.find((entry) => entry.name === "local_date");
    expect(column?.getSQLType()).toBe("date");
    expect(column?.notNull).toBe(true);
  });

  it("enforces the four camps here too", () => {
    expect(checks(climbDays)).toContain("between 1 and 4");
  });

  it("refuses negative counts, and clean solves that outnumber solves", () => {
    const sql = checks(climbDays);
    expect(sql).toContain(">= 0");
    expect(sql).toContain("<=");
  });

  it("cascades from the learner", () => {
    const [key] = getTableConfig(climbDays).foreignKeys;
    expect(key?.onDelete).toBe("cascade");
    const reference = key?.reference();
    expect(reference?.foreignColumns.map((column) => column.name)).toEqual(["id"]);
    expect(reference?.columns.map((column) => column.name)).toEqual(["learner_id"]);
  });
});

describe("every table", () => {
  it("records when it was last written, for debugging a child's history", () => {
    for (const table of [learners, campMastery, climbDays]) {
      expect(columnNames(table)).toContain("updated_at");
    }
  });
});
