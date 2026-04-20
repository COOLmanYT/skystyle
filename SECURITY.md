# Security Policy

## Supported Versions

Security fixes are applied only to the **latest version of the project on the `main` branch**.

Older commits or forks may not receive security updates.

| Version        | Supported |
| -------------- | --------- |
| main / latest  | ✅ Yes    |
| older versions | ❌ No     |

---

## Scope

### In scope

* The source code in this repository (`COOLmanYT/skystyle`)
* The production deployment of this project
* Application logic implemented in this repository (including API routes, weather aggregation, and AI integrations)

### Out of scope

* Vulnerabilities in **Vercel infrastructure**
* Vulnerabilities in **Supabase infrastructure**
* Vulnerabilities in **third-party APIs** (weather providers, AI providers, etc.)
* Social engineering, physical attacks, or denial-of-service (DoS/DDoS)
* Misconfiguration of user-supplied API keys (BYOK feature)

---

## Reporting a Vulnerability

If you believe you have discovered a security vulnerability, please report it **privately**.

### Preferred: Email

Send details to:

**official.coolman.yt[@]gmail.com**

Please include:

* A clear description of the vulnerability
* Steps to reproduce the issue
* Potential impact
* Affected file(s), endpoint(s), or feature(s)
* Screenshots, logs, or proof-of-concept if possible

### Alternative reporting

You may also submit a report through GitHub:

https://github.com/COOLmanYT/skystyle/security/advisories/new

---

## When is a GitHub Issue OK?

Please **do not open a public GitHub issue** for vulnerabilities that could be exploited (for example: authentication bypass, injection attacks, data exposure, or privilege escalation).

Public issues are acceptable for:

* Security hardening suggestions
* Dependency update suggestions
* General security improvement ideas that do not expose an active vulnerability

---

## Coordinated Disclosure / What to Expect

After a vulnerability report is submitted:

* The report will be reviewed and validated.
* If confirmed, a fix will be developed.
* The vulnerability may remain private until a fix is released.

While response times may vary, an acknowledgement will generally be provided **within a reasonable time after the report is received**.

Updates will be provided using the same contact method used to report the issue unless otherwise requested.

---

## Safe Harbour

If you act **in good faith** and avoid privacy violations, service disruption, or data destruction, no legal action will be taken against you for responsibly disclosing a security vulnerability.

Security research should:

* Respect user privacy
* Avoid accessing or modifying data that does not belong to you
* Avoid actions that could degrade service availability
* Avoid automated attacks or denial-of-service testing

Responsible disclosure helps improve the security of this project and is appreciated.
