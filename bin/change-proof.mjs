#!/usr/bin/env node

import { runCli } from "../src/cli/run-cli.mjs";

process.exitCode = await runCli({
  argumentsList: process.argv.slice(2),
  stdout: process.stdout,
  stderr: process.stderr,
  currentWorkingDirectory: process.cwd(),
});
