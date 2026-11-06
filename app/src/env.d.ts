/**
 * `PRANCHETA_ENV` of the build, replaced at build time by app/vite.config.ts (`define`): `'test'`
 * in the test build (docs/03-test-plan.md, 3), `''` otherwise. Only this one variable reaches the
 * bundle. Undeclared where nothing replaced it (Node scripts): read it behind `typeof`, as
 * lib/save/db.ts does.
 */
declare const __PRANCHETA_ENV__: string | undefined;
