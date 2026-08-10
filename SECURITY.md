# Security Policy

## Supported versions

Change Proof is a public pre-release beta.

| Version or branch | Security support |
| --- | --- |
| Current `0.1.0-beta.x` release line | Supported while it is the current public beta |
| Current `main` branch | Active development |
| Older pre-release lines | No long-term support commitment |

Security support during beta is best-effort. The project does not currently promise a fixed remediation SLA.

## Security boundary

Change Proof is designed for trusted repositories and trusted commands.

The tool executes explicitly configured repository code at exact Git states. Git worktrees isolate repository state, but they are not a security sandbox.

Change Proof does not provide:

- container isolation;
- process isolation;
- filesystem isolation;
- credential isolation;
- network isolation;
- safe execution of untrusted pull-request code.

The Change Proof process does not install dependencies or perform remote Git fetches as part of an evidence run. It does not discover commands, tests, dependencies, or environment variables automatically.

Configured repository code is outside that guarantee. Code executed by the configured command can use the operating-system permissions and resources available to that process, including filesystem, process, credential, and network resources where accessible.

Do not run Change Proof against code or commands that you do not trust.

## Reporting a vulnerability

Use GitHub Private Vulnerability Reporting for security vulnerabilities in Change Proof.

Open the repository's **Security** section and choose **Report a vulnerability**. This creates a private report for the maintainer.

Do not disclose vulnerability details, proof-of-concept payloads, credentials, or exploit instructions in a public issue, discussion, or pull request.

If GitHub Private Vulnerability Reporting is temporarily unavailable, open a public issue containing only a request for a private security contact. Do not include vulnerability details in that issue.

A useful private report should include:

- the affected Change Proof version or commit;
- the affected operating system and Node.js version;
- the security impact;
- required preconditions;
- minimal reproduction steps;
- whether the issue is reliably reproducible;
- any known mitigation or proposed fix.

Do not include real credentials, tokens, private repository contents, personal data, or other unnecessary sensitive information in a reproduction.

## Issues considered security-relevant

Examples include vulnerabilities that could cause Change Proof itself to violate its documented security boundaries, such as:

- deleting or modifying paths outside temporary resources owned by the current invocation;
- path traversal that escapes an owned workspace;
- symlink, gitlink, file-type, or path-boundary handling that bypasses a fail-closed check;
- shell interpretation or command injection where arguments are documented as literal;
- unexpected inheritance or disclosure of ambient environment data contrary to the execution contract;
- exposing raw command output or sensitive execution material through reports where the reporting contract excludes it;
- unsafe cleanup behavior that can delete caller-owned data;
- privilege or credential exposure introduced by Change Proof GitHub Actions workflows;
- package-integrity or executable-substitution issues affecting the distributed `@changeproof/cli` package;
- bypasses of resource bounds that create a security-relevant denial-of-service condition.

This list is illustrative rather than exhaustive.

## Known limitations that are not vulnerabilities by themselves

The following are explicit product limitations and are not security vulnerabilities on their own:

- configured repository code can perform arbitrary actions allowed by the host operating system;
- Change Proof is not a sandbox for untrusted code;
- repository test code may access the network or external services;
- a malicious trusted command can modify data available to that process;
- unsupported platform or framework behavior without a security boundary violation;
- an incorrect or disputed behavioral verdict without a security impact;
- absence of automatic dependency, test, command, or environment discovery.

A bug inside one of these areas may still be security-relevant if it causes Change Proof to violate a stronger guarantee that the project actually makes.

## Repository security posture

The public repository uses GitHub Private Vulnerability Reporting.

The protected `main` branch requires the project CI check, blocks force-push and deletion, applies protection to administrators, and requires review conversations to be resolved.

GitHub Actions defaults to read-only repository permissions. Workflows that need stronger permissions must declare only the permissions required for that workflow.

The one-time bootstrap npm publication and later steady-state publishing are separate release-security gates. Long-lived npm publication credentials are not part of the intended steady-state design.

## Coordinated disclosure

Please allow the maintainer an opportunity to reproduce, assess, and remediate a reported vulnerability before public disclosure.

The project does not currently promise a bug bounty, automatic CVE assignment, or a fixed response/remediation SLA.

When appropriate, GitHub repository security advisories may be used to coordinate a fix and disclosure.
