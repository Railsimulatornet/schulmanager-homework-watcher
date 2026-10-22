# Schulmanager Homework Watcher

[![Release + Docker Image](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/github-release.yml/badge.svg?branch=main)](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/github-release.yml)
[![Security Scan](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/security-scan.yml/badge.svg?branch=main)](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/security-scan.yml)
[![CodeQL](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Deutsch](#deutsch) · [English](#english)

## Deutsch

Der Schulmanager Homework Watcher prüft regelmäßig die Hausaufgaben, die mit deinem eigenen Schulmanager-Zugang sichtbar sind. Er vergleicht die Abrufe, dokumentiert Änderungen und kann dich per E-Mail benachrichtigen.

Dies ist eine Community-Lösung und kein offizielles Produkt von Schulmanager oder UGREEN. Die Nutzung erfolgt auf eigene Verantwortung.

### Funktionen

- Neue und entfernte Einträge im überwachten Zeitraum erkennen
- Den Zeitpunkt „erstmals erkannt“ festhalten
- HTML- und Text-E-Mails mit Berichten und Anhängen versenden
- SMTP, Darstellung und Anhänge mit einer Testmail prüfen
- Abrufe nach Zeitplan oder manuell starten
- Snapshots, Mail-Vorschauen und Berichte lokal aufbewahren und alte Dateien rotieren
- Vorgebautes Docker-Image für `linux/amd64` und `linux/arm64`

### Voraussetzungen

- UGREEN NAS mit UGOS Pro und Docker-App oder ein Linux-Host mit Docker Compose
- AMD64- oder ARM64-Prozessor
- Dein eigener Eltern- oder Schülerzugang zu Schulmanager
- Internetzugang zu Schulmanager und optional ein erreichbarer SMTP-Server
- Ein dauerhaft beschreibbarer Projektordner für `data/`

Die vorhandenen Mail- und Protokolltexte der Anwendung sind auf Deutsch. Diese README beschreibt die Einrichtung vollständig auf Deutsch und Englisch.

### Schnellstart

1. Lade das Paket unter [Releases](https://github.com/Railsimulatornet/schulmanager-homework-watcher/releases/latest) herunter oder verwende den Repository-Inhalt.
2. Kopiere den Projektordner auf deinen Host, zum Beispiel nach `/volume2/docker/schulmanager-homework-watcher`.
3. Lege die Konfiguration an. Eine vorhandene `.env` bleibt erhalten:

```bash
cd /volume2/docker/schulmanager-homework-watcher
test -f .env || cp .env.example .env
```

4. Trage deine Schulmanager- und SMTP-Daten in `.env` ein und passe Zeitplan sowie Überwachungsfenster an.
5. Lade und starte den Container aus dem gleichen Ordner:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

In UGOS kannst du unter **Docker → Projekt → Erstellen** den vorhandenen Projektordner auswählen, die `docker-compose.yaml` importieren und das Projekt bereitstellen. Für den normalen Betrieb wird das veröffentlichte Image verwendet.

### Konfiguration

Die vollständige Vorlage liegt in [.env.example](.env.example). Diese Beispielwerte entsprechen dem mitgelieferten Überwachungsfenster und Zeitplan:

```env
TZ=Europe/Berlin
SCHULMANAGER_BASE_URL=https://login.schulmanager-online.de
SCHULMANAGER_USERNAME=deine-mailadresse@example.de
SCHULMANAGER_PASSWORD=DEIN_PASSWORT

ONLY_CURRENT_WEEK=false
HOMEWORK_LOOKBACK_DAYS=10
HOMEWORK_LOOKAHEAD_DAYS=7
CRON_SCHEDULE=0,30 6-21 * * *
RUN_ON_START=true
RETENTION_DAYS=31

MAIL_ENABLED=true
MAIL_MODE=changes
MAIL_ON_ERROR=true
SMTP_HOST=smtp.example.de
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=absender@example.de
SMTP_PASS=DEIN_SMTP_PASSWORT
MAIL_FROM=absender@example.de
MAIL_TO=empfaenger@example.de
```

| Einstellung | Bedeutung |
| --- | --- |
| `SCHULMANAGER_USERNAME` / `SCHULMANAGER_PASSWORD` | Eigener Schulmanager-Zugang |
| `ONLY_CURRENT_WEEK` | Mit `true` auf die aktuelle Woche begrenzen |
| `HOMEWORK_LOOKBACK_DAYS` / `HOMEWORK_LOOKAHEAD_DAYS` | Bei `ONLY_CURRENT_WEEK=false` das rollierende Zeitfenster festlegen |
| `CRON_SCHEDULE` | Automatischer Abruf im Cron-Format |
| `TZ` | Zeitzone für Zeitplan, Mails und Protokoll |
| `RUN_ON_START` | Mit `true` direkt nach dem Containerstart abrufen |
| `RETENTION_DAYS` | Aufbewahrung alter Laufzeitdateien in Tagen |
| `MAIL_ENABLED` | Mailversand aktivieren |
| `MAIL_MODE` | `changes` für Änderungen; `always` für jeden erfolgreichen Abruf |
| `MAIL_ON_ERROR` | Bei aktiviertem Mailversand zusätzlich Fehlermails senden |
| `SMTP_SECURE` | `false` für eine Verbindung mit möglichem STARTTLS, etwa Port `587`; `true` für direktes TLS passend zum Server |
| `SMTP_USER` / `SMTP_PASS` | SMTP-Anmeldung, wenn vom Mailserver verlangt |
| `MAIL_FROM` / `MAIL_TO` | Absender und Empfänger |

`CRON_SCHEDULE=0,30 6-21 * * *` bedeutet: täglich alle 30 Minuten von **06:00 bis 21:30 Uhr** in der eingestellten Zeitzone. Die übrigen Nachtstunden bleiben frei von geplanten Abrufen.

### Testmail und manueller Abruf

#### Testmail

Die Testmail verwendet Beispielaufgaben. Sie schreibt Vorschauen und einen Beispielanhang, verändert aber keine echten Snapshots oder First-Seen-Daten.

```bash
docker exec -it schulmanager-homework-watcher node src/test-mail.js
```

Bei erfolgreichem Versand erscheint eine Meldung wie:

```text
[test-mail] Testmail versendet (...). Vorschau: /app/data/mail/latest-test-mail.txt
```

Die Dateien `data/mail/latest-test-mail.txt`, `data/mail/latest-test-mail.html` und `data/mail/testmail-pseudohausaufgaben.txt` bleiben zur Kontrolle erhalten. Bei unvollständiger Mail-Konfiguration wird eine Vorschau gespeichert und der fehlende Versand im Terminal gemeldet.

#### Sofortiger Abruf

Mit diesem Befehl prüfst du den echten Zugang sofort, ohne auf den nächsten geplanten Lauf zu warten:

```bash
docker exec -it schulmanager-homework-watcher node src/run-once.js
```

Der Abruf verarbeitet die echten sichtbaren Aufgaben, aktualisiert die Nachweise und kann entsprechend `MAIL_MODE` eine Mail versenden. Er eignet sich zum Prüfen nach Konfigurationsänderungen.

### Aktualisierung

Führe im bestehenden Projektordner aus:

```bash
cd /volume2/docker/schulmanager-homework-watcher
docker compose pull
docker compose up -d --force-recreate
docker compose ps
```

In UGOS kannst du das Projekt über **Neu bereitstellen** aktualisieren und dabei den Abruf des neuesten Images aktivieren. Behalte deine `.env` und den vollständigen Ordner `data/`.

Der vorhandene UGOS-Projektname kann vom Ordnernamen abweichen. Verwende bei SSH-Aufrufen den Namen aus dem Container-Label `com.docker.compose.project` mit `docker compose -p NAME`.

#### Image und Version

```text
railsimulatornet/schulmanager-homework-watcher:latest
```

Anwendungsversion: **2.0.6**. Releases erhalten zusätzlich Versions- und Datumstags. Die Veröffentlichung prüft AMD64 und ARM64 einschließlich Laufzeit- und Trivy-Tests und überträgt anschließend dieselben geprüften Images. SBOM- und Provenance-Attestierungen gehören zum Build.

Die Laufzeitprüfung verlangt mindestens Node.js **24.22.1** innerhalb der Node-24-Reihe und prüft den Chromium-Start. Zwei ungenutzte WebKit-Codecpakete werden wegen CVE-2025-3887 aus dem Image entfernt und vor jeder Veröffentlichung auf Abwesenheit geprüft.

Der wöchentliche Wartungslauf aktualisiert nach bestandener Prüfung nur `latest`. Die Versions-Tags werden durch diesen Wochenlauf nicht verändert. Behebbare HIGH- oder CRITICAL-Funde und Scanfehler verhindern die Veröffentlichung.

### Kontrolle und Fehlersuche

Live-Logs anzeigen:

```bash
docker logs -f schulmanager-homework-watcher
```

Beispiele aus dem Protokoll:

```text
[watcher] Fertig. Änderungen: neu 0, entfernt 0
[watcher] Fehler: ...
```

Bei Login-Problemen prüfst du deinen Zugang und die Erreichbarkeit von Schulmanager. Bei Versandproblemen helfen die Testmail und die Vorschauen unter `data/mail/`.

#### Compose findet keine Konfiguration

`no configuration file provided: not found` bedeutet meist, dass der Aufruf im falschen Ordner erfolgt. Wechsle in den Projektordner oder gib die Compose-Datei vollständig an:

```bash
docker compose -f /volume2/docker/schulmanager-homework-watcher/docker-compose.yaml pull
docker compose -f /volume2/docker/schulmanager-homework-watcher/docker-compose.yaml up -d
```

Übernimm auch hierbei den bestehenden Projektnamen, falls du `-p NAME` benötigst.

### Projektstruktur und Daten

| Pfad | Inhalt |
| --- | --- |
| `.env.example` / `.env` | Vorlage und eigene Konfiguration |
| `docker-compose.yaml` | Projekt mit vorgebautem Docker-Image |
| `src/` | Anwendung, Scheduler und Mail-Funktionen |
| `data/mail/` | Text- und HTML-Vorschauen: `latest-mail.*`, `latest-test-mail.*`, `latest-error-mail.*` |
| `data/reports/` | `latest-evidence.md` sowie First-Seen-Berichte als CSV und JSON |
| `data/snapshots/` | Gespeicherte Abrufe |
| `data/logs/` | Fehler- und Debug-Informationen |
| `data/profile/` / `data/state/` | Browserprofil und persistenter Anwendungszustand |

Im rollierenden Zeitfenster heißen die First-Seen-Berichte `watch-window-first-seen.csv` und `.json`. Bei `ONLY_CURRENT_WEEK=true` werden `current-week-first-seen.csv` und `.json` verwendet. Der Zeitpunkt „erstmals erkannt“ beschreibt den ersten vom Watcher festgehaltenen Treffer.

### Dokumentation

- [Ausführliches deutsches Handbuch](docs/Schulmanager-Homework-Watcher_Handbuch_DE_v1.0.pdf)
- [Änderungsverlauf](CHANGELOG.md)
- [Releases](https://github.com/Railsimulatornet/schulmanager-homework-watcher/releases)

### Lizenz

[MIT License](LICENSE) · Copyright Roman Glos 2026.

## English

Schulmanager Homework Watcher regularly checks the homework visible through your own Schulmanager account. It compares successive checks, records changes and can notify you by email.

This is a community solution, not an official Schulmanager or UGREEN product. Use it at your own risk.

### Features

- Detect new and removed entries within the monitored date range
- Record when an entry was first seen
- Send HTML and plain-text email with reports and attachments
- Check SMTP, layout and attachments through a test email
- Run on a schedule or start a check manually
- Retain snapshots, email previews and reports locally, and rotate old files
- Prebuilt Docker image for `linux/amd64` and `linux/arm64`

### Requirements

- UGREEN NAS with UGOS Pro and the Docker app, or a Linux host with Docker Compose
- AMD64 or ARM64 processor
- Your own parent or student Schulmanager account
- Internet access to Schulmanager and an optional reachable SMTP server
- A persistent, writable project directory for `data/`

The application's existing email and log messages are in German. This README provides the complete setup instructions in German and English.

### Quick start

1. Download the package from [Releases](https://github.com/Railsimulatornet/schulmanager-homework-watcher/releases/latest), or use the repository files.
2. Copy the project directory to your host, for example to `/volume2/docker/schulmanager-homework-watcher`.
3. Create the configuration. An existing `.env` is preserved:

```bash
cd /volume2/docker/schulmanager-homework-watcher
test -f .env || cp .env.example .env
```

4. Enter your Schulmanager and SMTP details in `.env`, then adjust the schedule and monitoring window.
5. Pull and start the container from the same directory:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

In UGOS, open **Docker → Project → Create**, select the existing project directory, import `docker-compose.yaml` and deploy the project. Normal operation uses the published image.

### Configuration

The complete template is in [.env.example](.env.example). These example values use the supplied monitoring window and schedule:

```env
TZ=Europe/Berlin
SCHULMANAGER_BASE_URL=https://login.schulmanager-online.de
SCHULMANAGER_USERNAME=your-email@example.com
SCHULMANAGER_PASSWORD=YOUR_PASSWORD

ONLY_CURRENT_WEEK=false
HOMEWORK_LOOKBACK_DAYS=10
HOMEWORK_LOOKAHEAD_DAYS=7
CRON_SCHEDULE=0,30 6-21 * * *
RUN_ON_START=true
RETENTION_DAYS=31

MAIL_ENABLED=true
MAIL_MODE=changes
MAIL_ON_ERROR=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sender@example.com
SMTP_PASS=YOUR_SMTP_PASSWORD
MAIL_FROM=sender@example.com
MAIL_TO=recipient@example.com
```

| Setting | Purpose |
| --- | --- |
| `SCHULMANAGER_USERNAME` / `SCHULMANAGER_PASSWORD` | Your own Schulmanager account |
| `ONLY_CURRENT_WEEK` | Set to `true` to limit checks to the current week |
| `HOMEWORK_LOOKBACK_DAYS` / `HOMEWORK_LOOKAHEAD_DAYS` | Set the rolling date range when `ONLY_CURRENT_WEEK=false` |
| `CRON_SCHEDULE` | Scheduled checks in cron format |
| `TZ` | Time zone for the schedule, emails and logs |
| `RUN_ON_START` | Set to `true` to check immediately after container startup |
| `RETENTION_DAYS` | Retention of old runtime files in days |
| `MAIL_ENABLED` | Enable email delivery |
| `MAIL_MODE` | `changes` for changes only; `always` for each successful check |
| `MAIL_ON_ERROR` | Also send error emails when email delivery is enabled |
| `SMTP_SECURE` | `false` for a connection that may use STARTTLS, such as port `587`; `true` for implicit TLS as required by the server |
| `SMTP_USER` / `SMTP_PASS` | SMTP authentication, if required by your mail server |
| `MAIL_FROM` / `MAIL_TO` | Sender and recipient |

`CRON_SCHEDULE=0,30 6-21 * * *` means every day, every 30 minutes from **06:00 through 21:30** in the configured time zone. No scheduled checks run during the remaining overnight hours.

### Test email and manual checks

#### Test email

The test email uses sample homework. It writes previews and an example attachment without changing real snapshots or first-seen data.

```bash
docker exec -it schulmanager-homework-watcher node src/test-mail.js
```

After successful delivery, the application prints a message such as:

```text
[test-mail] Testmail versendet (...). Vorschau: /app/data/mail/latest-test-mail.txt
```

The files `data/mail/latest-test-mail.txt`, `data/mail/latest-test-mail.html` and `data/mail/testmail-pseudohausaufgaben.txt` remain available for inspection. If email configuration is incomplete, a preview is saved and the terminal reports that delivery did not take place.

#### Run a check immediately

This command checks the real account immediately without waiting for the next scheduled run:

```bash
docker exec -it schulmanager-homework-watcher node src/run-once.js
```

It processes actual visible homework, updates the recorded evidence and may send an email according to `MAIL_MODE`. Use it to check configuration changes.

### Updating

Run from the existing project directory:

```bash
cd /volume2/docker/schulmanager-homework-watcher
docker compose pull
docker compose up -d --force-recreate
docker compose ps
```

In UGOS, redeploy the project and enable downloading the latest image. Keep your `.env` and the complete `data/` directory.

The existing UGOS project name may differ from the directory name. For SSH commands, use the name from the container label `com.docker.compose.project` with `docker compose -p NAME`.

#### Image and version

```text
railsimulatornet/schulmanager-homework-watcher:latest
```

Application version: **2.0.6**. Releases also receive version and date tags. The publication process checks AMD64 and ARM64, including runtime and Trivy tests, and then transfers the same verified images. Builds include SBOM and provenance attestations.

Runtime checks require Node.js **24.22.1 or later within Node 24** and test Chromium startup. Two unused WebKit codec packages are removed from the image because of CVE-2025-3887, and their absence is checked before every publication.

After successful checks, the weekly maintenance run updates only `latest`. It does not change version tags. Fixable HIGH or CRITICAL findings and scan errors block publication.

### Checks and troubleshooting

Follow the live logs:

```bash
docker logs -f schulmanager-homework-watcher
```

Example log messages:

```text
[watcher] Fertig. Änderungen: neu 0, entfernt 0
[watcher] Fehler: ...
```

For login problems, check your credentials and access to Schulmanager. For delivery problems, use the test email and inspect the previews under `data/mail/`.

#### Compose cannot find its configuration

`no configuration file provided: not found` usually means the command was run from the wrong directory. Switch to the project directory or provide the full Compose file path:

```bash
docker compose -f /volume2/docker/schulmanager-homework-watcher/docker-compose.yaml pull
docker compose -f /volume2/docker/schulmanager-homework-watcher/docker-compose.yaml up -d
```

Use the existing project name here as well if you need `-p NAME`.

### Project structure and data

| Path | Contents |
| --- | --- |
| `.env.example` / `.env` | Template and your own configuration |
| `docker-compose.yaml` | Project using the prebuilt Docker image |
| `src/` | Application, scheduler and email functions |
| `data/mail/` | Text and HTML previews: `latest-mail.*`, `latest-test-mail.*`, `latest-error-mail.*` |
| `data/reports/` | `latest-evidence.md` and first-seen reports as CSV and JSON |
| `data/snapshots/` | Saved checks |
| `data/logs/` | Error and debug information |
| `data/profile/` / `data/state/` | Browser profile and persistent application state |

For a rolling date range, the first-seen reports are named `watch-window-first-seen.csv` and `.json`. With `ONLY_CURRENT_WEEK=true`, the names are `current-week-first-seen.csv` and `.json`. The first-seen timestamp records when the watcher first captured an entry.

### Documentation

- [Detailed German handbook](docs/Schulmanager-Homework-Watcher_Handbuch_DE_v1.0.pdf)
- [Changelog](CHANGELOG.md)
- [Releases](https://github.com/Railsimulatornet/schulmanager-homework-watcher/releases)

### License

[MIT License](LICENSE) · Copyright Roman Glos 2026.
