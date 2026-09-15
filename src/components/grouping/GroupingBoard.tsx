"use client";

import { ArrayFrame } from "./ArrayFrame";
import { PlaceValueMat } from "./PlaceValueMat";
import type { GroupingTask, Workspace } from "@/lib/domain/grouping";
import type { GroupingAction } from "@/lib/domain/groupingSession";
import type { InterestPalette } from "@/lib/theme/interestTheme";

/**
 * The board for whichever grouping family the task belongs to.
 *
 * Both the camp and the checkpoint need the same pairing, and the fiddly part
 * is that task and workspace must be narrowed *together* — a place-value task
 * can never be shown on an array frame.
 */
export function GroupingBoard({
  task,
  workspace,
  palette,
  locked,
  dispatch,
}: {
  readonly task: GroupingTask;
  readonly workspace: Workspace;
  readonly palette: InterestPalette;
  readonly locked: boolean;
  readonly dispatch: (action: GroupingAction) => void;
}) {
  if (task.kind === "array" && workspace.kind === "array") {
    return (
      <ArrayFrame
        task={task}
        strips={workspace.strips}
        palette={palette}
        locked={locked}
        onPlace={(length) => { dispatch({ type: "place-strip", length, now: Date.now() }); }}
        onRemove={(at) => { dispatch({ type: "remove-strip", at, now: Date.now() }); }}
      />
    );
  }
  if (task.kind === "place-value" && workspace.kind === "place-value") {
    return (
      <PlaceValueMat
        task={task}
        counts={workspace.counts}
        palette={palette}
        locked={locked}
        onPlace={(unit) => { dispatch({ type: "place-unit", unit, now: Date.now() }); }}
        onRemove={(unit) => { dispatch({ type: "remove-unit", unit, now: Date.now() }); }}
      />
    );
  }
  return null;
}
