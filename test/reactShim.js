/**
 * React for tests, with `<ViewTransition>` filled in.
 *
 * The app runs on Next's vendored React (19.3 canary), which exports
 * `ViewTransition`; the `react` in package.json is 19.2 and does not. Rather
 * than alias tests onto the vendored copy — which requires the real `react`
 * internally and so lands two Reacts in one process, with a null hook
 * dispatcher — this re-exports the installed React and adds the one missing
 * piece as a passthrough.
 *
 * A passthrough is the honest stand-in: a view transition is a browser
 * animation with nothing to assert in jsdom, and the components under test
 * only need it to render their children.
 *
 * Plain JavaScript because `@types/react` uses `export =`, which cannot be
 * re-exported with `export *`. There is nothing here worth type-checking.
 */
import * as ActualReact from "react-actual";

export * from "react-actual";
export default ActualReact;

export const ViewTransition =
  ActualReact.ViewTransition ?? (({ children }) => children);
