# Reviews and reports

Independent-style reviews of CatchUp AI, each with the commands that produced its numbers. Every report is dated; [BUILD_STATUS.md](../BUILD_STATUS.md) is the running log of what was run since, and the [quality page](https://catchupai-chi.vercel.app/quality) shows the live counts.

| Report | What it covers |
| --- | --- |
| [LIVE_AGENT_EVALUATION_REPORT.md](LIVE_AGENT_EVALUATION_REPORT.md) | Every live-model run of the 12 agent cases, including failed attempts and provider quota errors |
| [AGENTIC_AI_AUDIT.md](AGENTIC_AI_AUDIT.md) | How agentic the copilot really is: one agent, seven tools, model-chosen order, approval gate |
| [RAG_QUALITY_REPORT.md](RAG_QUALITY_REPORT.md) | Retrieval and citation quality on the 51-question gold set, claim checking, cross-user isolation |
| [AI_SECURITY_RED_TEAM_REPORT.md](AI_SECURITY_RED_TEAM_REPORT.md) | Prompt-injection and abuse testing against the OWASP Top 10 for LLM applications |
| [SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md) | Automated security tests: row-level security, rate limits, same-origin checks |
| [BACKEND_HARDENING_REPORT.md](BACKEND_HARDENING_REPORT.md) | Route handlers, validation, error handling and limits |
| [QA_REPORT.md](QA_REPORT.md) | Test strategy and results across unit, integration and end-to-end suites |
| [OBSERVABILITY_REPORT.md](OBSERVABILITY_REPORT.md) | Logging, error tracking, uptime checks and status page |
| [INCIDENT_RESPONSE_RUNBOOK.md](INCIDENT_RESPONSE_RUNBOOK.md) | What to do when the model, database or deployment fails, including the AI kill switch |
| [PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md) | Deployment checks for the first public release |
| [FINAL_RELEASE_READINESS.md](FINAL_RELEASE_READINESS.md) | Release checklist and what remains owner-only |
| [USER_VALIDATION_REPORT.md](USER_VALIDATION_REPORT.md) | The prepared usability study (**not yet conducted**) |

The security audit and threat model stay at the top level: [SECURITY_AUDIT.md](../SECURITY_AUDIT.md), [THREAT_MODEL.md](../THREAT_MODEL.md).
