// convex/crons.ts
//
// `crons.interval` gives the documented "at most one run of each cron job is
// executing at any moment" guarantee, which is what makes `queue.pair` a true
// single writer (convex-clerk-nextjs.md §4.8.4). All three targets are internal
// mutations, so Convex retries them on transient/OCC errors and no user ever sees
// a write conflict from them.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("pair queued players", { seconds: 5 }, internal.queue.pair, {});
crons.interval("sweep abandoned games", { seconds: 20 }, internal.games.sweepAbandoned, {});
crons.interval("gc presence", { minutes: 5 }, internal.games.gcPresence, {});
export default crons;
