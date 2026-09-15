/**
 * Stands in for the `server-only` package under test. Importing the real one
 * throws by design; the point of the guard is to fail a client bundle, and
 * that is enforced by the build, not here.
 */
export {};
