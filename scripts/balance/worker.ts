import { parentPort, workerData } from 'node:worker_threads';
import { runJob, type Job, type RunContext } from './run.ts';

/*
 * Worker thread of the /balance (run.ts): receives the context once and runs the jobs it is sent,
 * one at a time, answering each with its result. A job that throws is an uncaught exception
 * here: the main thread gets it as the worker's "error" and stops the run (exit code 3).
 */
const ctx = workerData as RunContext;
parentPort!.on('message', (message: { id: number; job: Job }) => {
  parentPort!.postMessage({ id: message.id, result: runJob(ctx, message.job) });
});
