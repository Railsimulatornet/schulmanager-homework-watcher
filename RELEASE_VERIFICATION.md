# Release-Prüfung / Release verification – v3.0.1

## Grundlage / Basis

Die bereitgestellte, vom Maintainer im Alltag getestete 3.0.1-Erweiterung ist die Funktionsbasis. Die Sicherheits- und Veröffentlichungsprüfungen aus v2.0.6 wurden übernommen. Produktionszugänge, Browserprofile, echte `.env`-Dateien und Laufzeitdaten gehören nicht zum Quellpaket.

The supplied 3.0.1 extension, field-tested by the maintainer, is the functional baseline. Security and publication checks from v2.0.6 are retained. Production credentials, browser profiles, real `.env` files and runtime data are not part of the source package.

## Vorbereitungsbericht / Preparation report

Der mitgelieferte Prüfbericht vom 22.10.2026 dokumentiert folgende Ergebnisse. Diese Angaben beschreiben die Release-Vorbereitung; sie ersetzen nicht die GitHub-Prüfung des endgültigen Veröffentlichungsimages.

The supplied preparation report dated 2026-10-22 records the following results. They describe release preparation and do not replace GitHub verification of the final published image.

- 19/19 Watcher-Regressionstests im isolierten AMD64-Testimage / watcher regression tests in an isolated AMD64 test image.
- 32/32 Tests der Scan- und Veröffentlichungshelfer / scan and publication helper tests.
- Chromium-Start, Formular-/Render-Test sowie dotenv- und Nodemailer-Kompatibilität / Chromium launch, form/render test and dependency compatibility.
- Node.js 24.22.1 und Entfernung der zwei betroffenen GStreamer-Pakete / Node.js 24.22.1 and removal of the two affected GStreamer packages.
- `npm ci`, Abhängigkeitsprüfung und npm-Audit ohne gemeldete Funde / dependency installation and audit without reported findings.
- Trivy: keine behebbaren HIGH-/CRITICAL-Funde im AMD64-Testimage / no fixable HIGH/CRITICAL findings in the AMD64 test image.
- JSON-, YAML-, JavaScript- und Shell-Syntax sowie ShellCheck / syntax checks and ShellCheck.
- Sechs anonymisierte Testfixtures mit synthetischen Daten / six anonymized fixtures with synthetic data.

## Freigabe / Publication

Vor dem Merge müssen die GitHub-Prüfungen des Pull Requests erfolgreich sein. Der Release-Workflow baut das endgültige Multiarch-Archiv, prüft es nativ auf AMD64 und ARM64 mit Trivy und Chromium und veröffentlicht nur nach passenden Prüfnachweisen für dasselbe Archiv. CodeQL prüft JavaScript/TypeScript und GitHub Actions im Pull Request und auf `main`.

Pull request checks must pass before merging. The release workflow builds the final multiarchitecture archive, verifies it natively on AMD64 and ARM64 with Trivy and Chromium, and publishes only with matching verification receipts for that same archive. CodeQL checks JavaScript/TypeScript and GitHub Actions on the pull request and `main`.

## Grenzen / Limitations

Kein automatisierter Test verwendet echte Schulmanager-Zugangsdaten oder einen produktiven SMTP-Zugang. Die Release-Vorbereitung umfasst keinen erneuten Zugriff auf das produktive NAS. Ein fehlerfreier Scan ist keine Garantie für vollständige Fehler- oder Schwachstellenfreiheit. Zeitabhängige Basisimages und Paketquellen können später andere Image-Bytes ergeben; geprüft wird jeweils der konkret gebaute Kandidat.

Automated tests do not use real Schulmanager credentials or a production SMTP account. Release preparation does not include a fresh inspection of the production NAS. A clean scan does not guarantee the absence of all bugs or vulnerabilities. Time-dependent base images and package repositories may produce different image bytes later; each actual build candidate is verified separately.
