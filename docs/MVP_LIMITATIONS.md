# MVP Limitations

## Status

These constraints apply to the controlled M1 experiment and the proposed local MVP.

They are intentionally restrictive.

## Initial supported scope

The first controlled fixture uses:

- a local Git repository;
- exact base and head commits;
- JavaScript ESM;
- Node.js 24 during local development;
- the built-in node:test runner;
- TAP output;
- one implementation file;
- one test file;
- one deterministic test command;
- one explicitly selected test-envelope path;
- no external runtime dependencies.

## Unsupported in M1

M1 does not support:

- TypeScript compilation;
- transpilers or bundlers;
- snapshots;
- test setup files or helpers;
- external fixtures;
- package manifest or lockfile changes;
- production or development dependency changes;
- runtime changes;
- network services;
- databases or containers;
- monorepos or workspaces;
- Git submodules or Git LFS;
- shallow-clone recovery;
- Windows-native execution;
- GitHub Actions;
- unknown third-party pull requests.

## Security limitation

Git worktrees isolate repository state. They do not sandbox executed code.

A test command runs with the permissions of the current user and may be able to read user files, access the network, execute child processes, consume resources, access local credentials, or modify files outside its worktree.

M1 must execute only code created for the controlled experiment.

## Evidence limitation

A positive observation describes only the selected commits, command, test envelope, environment, and recorded outcomes.

It does not establish complete correctness, production readiness, security, performance, or behavior outside the selected tests.

## Hybrid-state limitation

The first experiment permits only one explicitly selected test file to move from head to base.

If that test requires a new API, helper, dependency, configuration, fixture format, runtime, or build step, the case is unsupported.

## Failure interpretation limitation

Exit code alone cannot establish test discrimination.

The experiment must verify that the intended test was discovered, executed, and failed at its intended assertion.

## Expansion rule

A limitation may be removed only after:

1. a dedicated fixture exists;
2. expected and failure behavior are defined;
3. deterministic tests pass;
4. the security impact is reviewed;
5. documentation is updated;
6. added complexity is justified by user value.
