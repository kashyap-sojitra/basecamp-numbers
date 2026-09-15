import type { JumpProblem } from "@/lib/domain/numberLine";
import { spokenTradeTask } from "@/lib/domain/tradeCopy";
import type { TradeTask } from "@/lib/math/tradeTasks";
import type { GroupingTask } from "@/lib/domain/grouping";
import type { WordProblemFraming } from "./types";

/**
 * The words a screen reads aloud. Prefers the word problem when it has
 * arrived, and otherwise speaks the bare sum in full English — "8 plus 7
 * equals what?" reads far better than "8 + 7 = ?".
 */
export function spokenJump(
  problem: JumpProblem,
  framing: WordProblemFraming | null,
): string {
  const sum = `${String(problem.start)} ${
    problem.operation === "add" ? "plus" : "minus"
  } ${String(problem.change)} equals what?`;
  return framing === null ? sum : `${framing.story} ${framing.question} ${sum}`;
}

export function spokenGrouping(
  task: GroupingTask,
  framing: WordProblemFraming | null,
): string {
  const ask =
    task.kind === "array"
      ? `${String(task.rows)} rows of ${String(task.cols)}. How many altogether?`
      : `Build the number ${String(task.target)}.`;
  return framing === null ? ask : `${framing.story} ${framing.question} ${ask}`;
}

/** Camp 4 read aloud: the story if there is one, then what the mat is asking. */
export function spokenTrade(
  task: Pick<TradeTask, "units" | "start">,
  framing: WordProblemFraming | null,
): string {
  return spokenTradeTask(task.units, task.start, framing?.story ?? null);
}
