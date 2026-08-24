# Security Policy

## Reporting a vulnerability

Please do not open public issues for security problems. Report them privately via GitHub: **Security → Advisories → Report a vulnerability** on this repository.

You should get a first response within a few days. Please include reproduction steps and the affected version.

## Scope notes

* The scanner is read-only against the Google Admin SDK and persists nothing; the main assets to protect are the service account key you supply and the reports you export.
* Catalog integrity matters: a wrongly added client ID exempts an app from `--risky`. Suspected bad catalog entries are security reports, not regular bugs.
