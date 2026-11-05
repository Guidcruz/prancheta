import { parentPort, workerData } from 'node:worker_threads';
import type { BalanceContext } from './league.ts';
import { runJob, type Job } from './run.ts';

/*
 * Worker thread of the /balance (run.ts): receives the context once and runs the jobs it is sent,
 * one at a time, answering each with its result.
 */
const ctx = workerData as BalanceContext;
parentPort!.on('message', (message: { id: number; job: Job }) => {
  parentPort!.postMessage({ id: message.id, result: runJob(ctx, message.job) });
});
