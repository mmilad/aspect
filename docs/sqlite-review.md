# SQLite lifecycle and concurrency review — 2026-09-08

Implementation status: addressed by the database-controller pass. Production callers now use a queued, process-local controller; SQL and SQLite types live in the private adapter. Numbered migrations, WAL, bounded lock waiting, initialization cleanup, and atomic mutation/rollup replace the failure paths below. See [architecture](./architecture.md#database-access) and the controller/adapter regression tests. The findings and reproduction below describe the pre-refactor implementation.

Scope: review and flagging, without changing runtime behavior. Follow-up: `task_cd92be00-ff9f-4d2b-9fd5-afeb33764ead`, linked to the Queryable Domain Model aspect. This follows the accepted decision to retain SQLite and consider Postgres later.

## How connections work today

`packages/db/src/client.ts` opens a synchronous SQLite handle, runs schema/status/workspace migrations, then optionally ensures presets and JSON schemas. Web `withDb`, MCP `withDb`, and the CLI normally close their handle in `finally`. Workflow HTTP routes repeat this lifecycle separately. There is no shared database controller spanning these callers. MCP has an in-process promise queue; web requests, other MCP processes, and CLI processes do not share it.

An open idle connection is not itself a write lock. SQLite locks depend on statements and transactions. Opening/closing more frequently cannot by itself solve contention. WAL permits readers alongside one writer; writers still serialize. See [SQLite WAL documentation](https://www.sqlite.org/wal.html) and [locking documentation](https://www.sqlite.org/lockingv3.html).

## Findings

1. **P1: ordinary reads require write access during connection initialization.** `client.ts:103-105` runs migrations on every connection. `migrate-status.ts:9` executes UPDATEs even on an already migrated database; accepted decisions and answered questions can be rewritten unchanged, and the legacy nodes UPDATE at line 76 has no WHERE clause. A concurrent writer can therefore break a request before its actual SELECT. Replace repeated data migrations with versioned, atomic migration execution; keep steady-state connection initialization free of data writes. Preset bootstrapping also needs a concurrency-safe lifecycle.

2. **P1: no explicit contention policy.** `client.ts:102` constructs `DatabaseSync` without a timeout, and no busy-timeout or WAL configuration exists in the code searched. A fresh database in the current runtime reports `busy_timeout=0` and `journal_mode=delete`. Brief contention immediately becomes an exception. Configure a bounded wait policy and evaluate WAL for local-file use. Retry only operations known to be safe, with a bounded whole-transaction policy where necessary. A synchronous timeout blocks that Node event loop; it must not be treated as an asynchronous queue or an unlimited cure. The MCP queue protects only its own process.

3. **P2: failed initialization does not close the newly opened connection.** `client.ts:101-107` and `117-127` do not catch migration or preset/schema initialization failures to close the handle. Caller `finally` blocks start only after open resolves, so they cannot clean up this failure. Close the owned connection before rethrowing the original error. This is a handle-lifecycle defect; this review does not establish that leaked handles caused the user's specific incident.

4. **P2: entity creation can report failure after committing, masking the cause.** `repositories/entities.ts:121-129` commits, then awaits parent rollup inside the transaction's try block. A rollup error enters `ROLLBACK` after the transaction has ended, replacing the original error with a rollback error while the entity remains persisted. Separate transaction error handling from post-commit work and define how failed rollups are repaired/reported. Fault-inject a rollup failure to verify truthful results and preserved error context.

5. **P2: generated entity keys are allocated before the write transaction.** `repositories/entities.ts:76-81` calculates the next task/feature key before `BEGIN` at line 101. Independent processes can select the same next key. Default slugs then collide on the unique slug index; custom slugs do not make key allocation atomic. Allocate under an immediate write transaction or use an atomic counter, with concurrent-process regression coverage.

6. **P2 architecture drift: storage is only partially replaceable behind an interface.** The core `EntityStore` and query adapter provide a useful boundary, but web orchestration accepts `DatabaseSync`, and `apps/web/lib/project-workspace.ts:14-17` executes SQL directly. The DB package also owns workflow execution and rollup, beyond pure storage. Move application SQL behind repository operations and define the transaction/lifecycle boundary before replacing SQLite; a driver substitution alone will not suffice.

## Evidence and limits

An isolated temporary database, using the project's actual `createDatabase` function and bundled runtime (SQLite 3.53.3), produced:

```text
journal_mode: delete
busy_timeout: 0
Connection A: BEGIN IMMEDIATE
Connection B, raw SQLite: SELECT count(*) FROM entities succeeds
Connection C, createDatabase: database is locked (~2 ms)
Re-run status migration with one accepted decision: total_changes increases by 1
```

The temporary reproduction did not touch the live planning database. Graph orientation and recording the follow-up used the normal planning operations. The user's live failure was not captured, so this confirms a concrete failure mechanism rather than attribution of every reported lock.

The unused `transactionAsync` helper can hold locks across arbitrary awaited work, but no call sites were found; it is not an established current cause. Existing concrete transaction bodies inspected do not hold a transaction across LLM network calls.

The package-manager wrapper attempted dependency installation and stopped with a no-TTY error. Existing local `tsx` worked for the reproduction and planning fallback. Full typecheck/test/build were not run for this review; no production code was changed.

## Follow-up acceptance checks

- Repeat concurrent read/open/write tests with independent connections and independent processes against an already initialized database.
- Verify brief contention recovers within a bound, sustained contention fails clearly, and ordinary reads do not run migrations or catalog writes.
- Inject initialization and post-commit rollup failures; verify handle cleanup and accurate persisted-state/error reporting.
- Create tasks/features concurrently and verify distinct keys, valid links, and no lost writes.
- Verify fresh and existing database migration paths, including simultaneous startup, then run project typecheck, tests, and build.
- Remove application SQL coupling through repository operations without changing product behavior.
