# Security Policy

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities, exposed credentials, customer data, payment flows, authentication bypasses, or report-access weaknesses.

Use GitHub's **Report a vulnerability** option in the repository Security tab to submit a private security advisory. Include:

- affected route, file, or workflow;
- reproduction steps;
- expected and observed behavior;
- potential impact;
- any proposed remediation.

Do not access, modify, retain, or disclose customer data beyond the minimum necessary to demonstrate the issue.

## Credential incidents

Any credential found in source code, logs, commit messages, workflow output, screenshots, or issue content must be treated as compromised. The response sequence is:

1. revoke or rotate the credential at the vendor;
2. verify the replacement is stored only in the deployment secret manager;
3. inspect vendor activity and application logs for misuse;
4. remove the exposed value from current files;
5. consider rewriting Git history after rotation when the repository exposure warrants it.

Deleting the value from the latest commit is not sufficient because Git history remains accessible.

## Supported version

Only the current production release on `main` is supported. Security fixes should be applied through a reviewed pull request with the repository quality and security checks passing.
