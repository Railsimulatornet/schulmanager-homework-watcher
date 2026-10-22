# Schulmanager Homework Watcher

[![Release + Docker Image](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/github-release.yml/badge.svg?branch=main)](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/github-release.yml)
[![Security Scan](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/security-scan.yml/badge.svg?branch=main)](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/security-scan.yml)
[![CodeQL](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/Railsimulatornet/schulmanager-homework-watcher/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Version **3.0.1** · [Deutsch](#deutsch) · [English](#english)

## Deutsch

Dies ist eine Community-Lösung und kein offizielles Produkt von Schulmanager oder UGREEN. Die Nutzung erfolgt mit dem eigenen Eltern- oder Schülerkonto.

Version **3.0.1** enthält die lokal getestete modulare Erweiterung sowie die Sicherheitskorrekturen von 2.0.6.
Überwacht die im eigenen Schulmanager-Konto sichtbaren Daten, dokumentiert Änderungen und versendet getrennte deutsche HTML-/Text-Mails mit Nachweisen.

## Bereiche und Mailsteuerung

Alle Einstellungen stehen in `.env`. Die vorhandenen Zugangsdaten und SMTP-Einstellungen bleiben dort.

| Bereich | Erfassen | Änderungsmail | Vorgabe |
|---|---|---|---|
| Hausaufgaben | `WATCH_HOMEWORK` | `MAIL_HOMEWORK` | beide `true` |
| Fehlzeiten mit Status | `WATCH_ABSENCES` | `MAIL_ABSENCES` | beide `true` |
| Einträge | `WATCH_ENTRIES` | `MAIL_ENTRIES` | beide `true` |
| Stundengenaue Historie | `WATCH_HISTORY` | `MAIL_HISTORY` | erfassen `true`, Mail `false` |
| Klassenarbeiten | `WATCH_EXAMS` | `MAIL_EXAMS` | beide `true` |
| Stundenplanänderungen | `WATCH_TIMETABLE` | `MAIL_TIMETABLE` | beide `true` |

`WATCH_*=false` pausiert den Abruf. `MAIL_*=false` behält Erfassung und Nachweise bei, unterdrückt aber den Versand des Bereichs. `MAIL_ENABLED=false` schaltet den gesamten Versand aus. Nach einer Änderung der `.env` den Container über das bestehende Compose-Projekt neu erstellen; ein einfacher Neustart übernimmt die geänderten Umgebungswerte nicht.

`MAIL_MODE=changes` bleibt die empfohlene Einstellung. Hausaufgaben unterstützen weiterhin den bisherigen Modus `always`. Neue Module senden ausschließlich echte Änderungen. Die separate Historienmail ist standardmäßig aus, weil sich ihre Meldungen mit Fehlzeiten überschneiden können. Der erste erfolgreiche Abruf jedes neuen Moduls setzt einen Ausgangsstand ohne Änderungsmail.

## Zeitplan und Belastung

```dotenv
TZ=Europe/Berlin
CRON_SCHEDULE=*/5 6-22 * * *
RUN_ON_START=true
RETENTION_DAYS=31
ERROR_MAIL_COOLDOWN_MINUTES=360
```

Der Zeitplan läuft von **06:00 bis 22:55 Uhr**, weil die Stunde 22 eingeschlossen ist. Eine Anmeldung je Lauf; Bereiche werden nacheinander abgerufen. Eine gemeinsame Dateisperre verhindert gleichzeitige reguläre und manuelle Läufe.

Bei 429 werden 30 Minuten pausiert, bei Zeitüberschreitungen, Loginproblemen und 5xx typischerweise 15 Minuten, bei sonstigen Fehlern 10 Minuten. 401/429/503 unterbrechen den weiteren Lauf. Derselbe Fehler wird pro Bereich frühestens nach sechs Stunden erneut gemailt; ein geänderter Fehlerstatus darf früher gemeldet werden. Es gibt keine zusätzliche Wiederherstellungsmail. Ein leerer bisher gefüllter Bereich muss dreimal erfolgreich leer abgerufen werden, bevor Entfernungen übernommen werden. Fehlerantworten überschreiben den letzten gültigen Stand nicht.

## Nachweise und Grenzen

- Hausaufgaben behalten ihre bisherigen Übersichten, CSV/JSON, Snapshots, Mailvorschauen und Erstbeobachtungen.
- Die neuen Module dokumentieren neu, geändert, entfernt und wieder vorhanden; Vorher/Nachher steht in den Änderungssnapshots und Nachweisen.
- `firstSeenAt` ist die erste **Beobachtung durch den Watcher**, kein Veröffentlichungszeitpunkt des Schulmanagers. Zwischen zwei Abrufen entstandene und wieder entfernte Inhalte können unbemerkt bleiben.
- Fehlzeitenstatus berücksichtigt Entschuldigung, Attest und genehmigte Beurlaubung. Offene/abgelehnte Beurlaubungsanträge haben derzeit kein eigenes Modul.
- Einträge liefern keine eigene stabile Server-ID. Die Zuordnung nutzt Datum, Typ, Fach und Lehrkraft; Textänderungen bleiben zugeordnet. Gleichzeitig geänderte Identitätsmerkmale oder mehrere gleichartige Einträge können als Entfernung/Neuzugang erscheinen.
- Einzelne Stunden werden über Datum/Stunde zugeordnet; mehrdeutige parallele Stunden brauchen weitere Merkmale. Auch hier ist eine Zuordnung nicht in jedem Fall eindeutig.
- Historie und Stundenplan verwenden das rollierende Fenster aus `HOMEWORK_LOOKBACK_DAYS` und `HOMEWORK_LOOKAHEAD_DAYS`. Fehlzeiten, Einträge und Prüfungen beziehen sich auf das aktuelle Schuljahr. Ein Bereichs-/Schuljahreswechsel setzt einen neuen Ausgangsstand. Das Herauswandern aus dem Zeitfenster erzeugt keine Löschmail.
- Aufbewahrung: 31 Tage als Vorgabe. Alte Snapshots werden rotiert; Erstbeobachtungen aktiver Objekte bleiben erhalten, ihre sehr alten Originalsnapshots können bereits rotiert sein. Für längere Nachweise `RETENTION_DAYS` erhöhen und Backups vorhalten. Lokale Dateien sind kein manipulationssicheres Archiv.

## Dateien

```text
data/
  state/                 bisheriger Hausaufgabenstand, Sperre und Fehlerstatus
  snapshots/             bisherige Hausaufgaben-Snapshots
  reports/               bisherige Übersichten/Nachweise
  mail/                  aktuelle HTML-/Text-Vorschauen je Bereich
  modules/<bereich>/
    state.json           Zustand und Beobachtungszeitpunkte
    snapshots/           Abrufe inklusive Änderungen und Vorher/Nachher
    reports/             aktuelle CSV-/JSON-Übersicht und Nachweis
  outbox/<bereich>/      noch ausstehende Mails mit eingefrorenen Anhängen
  profile/               optionales Browserprofil des Login-Helfers
```

Ein SMTP-Fehler verliert die Änderungsmail nicht: der Postausgang wird vor Übernahme des neuen Zustands geschrieben. Pro Bereich wird höchstens eine wartende Mail je erfolgreichem Lauf versendet. Die Message-ID bleibt bei Wiederholungen gleich. Bei einem Verbindungsabbruch nach SMTP-Annahme ist eine doppelte Zustellung technisch nicht vollständig auszuschließen. Bei deaktiviertem Mailbereich bleiben bereits wartende Mails bis zur Reaktivierung erhalten.

## Betrieb im vorhandenen UGOS-Projekt

**Vor jedem Build/Deploy eines bestehenden UGOS-Projekts die tatsächlichen Labels auslesen.** Der Verzeichnisname ist kein verlässlicher Projektname.

```bash
CONTAINER=schulmanager-homework-watcher
PROJECT=$(docker inspect "$CONTAINER" --format '{{index .Config.Labels "com.docker.compose.project"}}')
SERVICE=$(docker inspect "$CONTAINER" --format '{{index .Config.Labels "com.docker.compose.service"}}')
COMPOSE=/volume2/docker/schulmanager-homework-watcher/docker-compose.yaml
# Erst nach erfolgreicher Veröffentlichung und Sicherung von .env und data/ ausführen.
# In der bestehenden Compose-Datei den Image-Tag auf 3.0.1 setzen; Projekt,
# Service-Namen, Umgebungswerte und Datenpfade nicht durch eine Vorlage ersetzen.
test -n "$PROJECT" && test -n "$SERVICE" && test -f "$COMPOSE" || exit 1
docker compose -p "$PROJECT" -f "$COMPOSE" pull "$SERVICE"
docker compose -p "$PROJECT" -f "$COMPOSE" up -d --no-build "$SERVICE"
```

Die Release-Compose-Datei verweist auf `railsimulatornet/schulmanager-homework-watcher:3.0.1`. Bis dieses Image tatsächlich veröffentlicht ist, ist dieses ZIP als Quellpaket zu behandeln. Der Container läuft mit UID 1001/GID 10, ohne zusätzliche Fähigkeiten, ohne Rechteausweitung und mit schreibgeschütztem Root-Dateisystem. Nur `data/` und das temporäre Verzeichnis sind beschreibbar. Beim Wechsel von einem älteren root-basierten Image müssen die vorhandenen Daten für UID 1001/GID 10 schreibbar sein. Die Gruppenzuordnung und Datenrechte auf dem eigenen Host vor dem Update prüfen.

### Bedienung

```bash
# Einmaliger Abruf (beachtet Sperre und Abrufpausen)
docker exec schulmanager-homework-watcher node src/run-once.js
# Testmail, ausdrücklich unabhängig vom normalen Änderungsversand
docker exec schulmanager-homework-watcher node src/test-mail.js
# Optionales Browserprofil vorbereiten; für den regulären API-Abruf nicht nötig
docker exec schulmanager-homework-watcher node src/login.js
# Status und datensparsame Laufmeldungen
docker logs --tail 50 schulmanager-homework-watcher
```

Das Produktionsimage enthält bewusst kein npm; deshalb innerhalb des Containers `node` verwenden. Für Entwicklung sind die bisherigen npm-Skripte weiterhin vorhanden. Die Zugangsdaten werden nur zur Anmeldung/SMTP verwendet; keine Rohantworten der Anmeldung protokollieren. Nachweise enthalten notwendigerweise persönliche Schulangaben und gehören ausschließlich in das lokale geschützte `data/` und an die selbst konfigurierten Empfänger.

## Tests und Sicherheit

`npm ci --ignore-scripts && npm test` prüft die Module mit anonymisierten Strukturen sowie Diff, leere Antworten, Teilfehler, Loginpause, Laufsperre, HTML/CSV und Postausgang. Die Laufzeitprüfung verlangt Node.js **24.22.1 oder neuer innerhalb Node 24** und prüft den Chromium-Start auf nativen AMD64- und ARM64-Runnern. Beide prüfen dasselbe OCI-Archiv. Die nicht benötigten GStreamer-Pakete zu CVE-2025-3887 werden entfernt und auf Abwesenheit geprüft. Trivy blockiert behebbare HIGH-/CRITICAL-Funde; CodeQL prüft JavaScript und Actions. Die Linux-CI prüft die prozessübergreifende Sperre.

Die Mailvorlagen haben Textversionen, eingebettete einfache CSS-Regeln und feste Outlook-Hüllen. Die endgültige Darstellung im tatsächlich eingesetzten Mailprogramm muss am empfangenen Beispiel beurteilt werden.

## Backup und Rückkehr

Vor einem späteren produktiven Wechsel ein vollständiges, geschützt aufbewahrtes Backup von `.env` und `data/` erstellen. Diese Daten dürfen nicht veröffentlicht werden.

Für eine Rückkehr zuerst das aktuelle Projekt und alle neuen Daten sichern, danach den bestehenden Service mit dem zuvor ausgelesenen Projektnamen stoppen. Das gewünschte Backup zunächst in ein getrenntes Verzeichnis entpacken. Die ursprüngliche Compose-Konfiguration und den zugehörigen Stand bewusst wiederherstellen; neue Daten nicht durch unkontrolliertes Entpacken überschreiben. Alte Images mit anderer UID benötigen passende Datenrechte. Die neuen Modulverzeichnisse werden von v2 nicht genutzt und sollten trotzdem erhalten bleiben.

Für einen späteren produktiven Wechsel erst die Veröffentlichung und AMD64-/ARM64-Prüfungen abschließen. Danach den fest veröffentlichten Versionstag beziehen und den Service mit dem aus den Labels ermittelten Projektnamen neu erstellen. `.env`, `data/` und Volumepfade erhalten.

Die vollständige Variablenvorlage steht in [.env.example](.env.example). Die Lizenz steht in [LICENSE](LICENSE).

## English

This is a community project, not an official Schulmanager or UGREEN product. Use your own parent or student account.

Version **3.0.1** builds on the tested local modular watcher and adopts the security fixes from 2.0.6. It collects data visible to your own Schulmanager account, records changes, and sends separate German HTML/text emails. `firstSeenAt` means first observed by this watcher, not published by Schulmanager.

### Areas and notifications

| Area | Collect | Change email | Default |
| --- | --- | --- | --- |
| Homework | `WATCH_HOMEWORK` | `MAIL_HOMEWORK` | both on |
| Absences with status | `WATCH_ABSENCES` | `MAIL_ABSENCES` | both on |
| Entries | `WATCH_ENTRIES` | `MAIL_ENTRIES` | both on |
| Hour-by-hour history | `WATCH_HISTORY` | `MAIL_HISTORY` | collection on, email off |
| Exams | `WATCH_EXAMS` | `MAIL_EXAMS` | both on |
| Timetable changes | `WATCH_TIMETABLE` | `MAIL_TIMETABLE` | both on |

`WATCH_*=false` pauses collection for that area. `MAIL_*=false` keeps collecting and recording evidence while suppressing its email. `MAIL_ENABLED=false` stops all sending. `MAIL_MODE=changes` is recommended; homework still supports `always`. The first successful check of a new area creates a silent baseline.

### Schedule and load

`TZ`, `CRON_SCHEDULE`, and `RUN_ON_START` control scheduling. The sample schedule `*/5 6-22 * * *` runs from 06:00 through 22:55. One login is used per run; areas are checked in sequence. A shared lock prevents simultaneous scheduled and manual runs. Lookback/lookahead form a rolling window for homework, history, and timetable. Absences, entries, and exams cover the school year. Leaving the rolling window does not trigger a removal email.

HTTP 429 normally pauses fetching for 30 minutes; timeouts, login failures, and 5xx for 15 minutes; other failures for 10 minutes. HTTP 401/429/503 may stop the remainder of a run. Identical errors per area are emailed at most once per configured cooldown (six hours by default). A changed error status may be reported sooner. A previously populated area must return empty successfully three times before removals are accepted. Error responses never overwrite valid state; an area failure does not block independent areas while the session is usable.

### Evidence and limitations

Homework retains its earlier overview, CSV/JSON, snapshots, mail previews, and first-observation times. Other areas record new, changed, removed, and returned items with before/after values. Each area has separate state, snapshots, reports, previews, and email controls. Approved leave is reflected in absence status; pending or rejected leave requests do not have their own area.

Entries have no stable server ID. Matching uses date, type, subject, and teacher, so simultaneous changes to identity fields or multiple similar entries can appear as removal and addition. Timetable lessons use date/period and stable source IDs, with prior state used to retain `firstSeenAt` when a slot splits into multiple substitutions. Contradictory rows sharing the same source ID fail the affected area rather than saving a false diff. Content added and removed between checks cannot be observed.

### Files and mail delivery

`data/state/` holds previous homework state, locks, and error status; `data/snapshots/` and `data/reports/` hold homework evidence; `data/mail/` holds current HTML/text previews. Each `data/modules/<area>/` has its own state, snapshots, and reports. `data/outbox/<area>/` holds pending messages with frozen attachments. `data/profile/` is an optional browser profile.

If SMTP fails, the prepared change email remains in the outbox. A disconnect after SMTP accepted a message can still cause duplicate delivery. Pending messages for a disabled email area remain until it is enabled again. All persistent data can contain personal school information and must remain private.

### Existing UGOS projects and commands

Before **every** build or deployment of an existing UGOS Compose project, read the real project and service from the container labels `com.docker.compose.project` and `com.docker.compose.service`. Never infer the project name from the directory. Always run Compose with `-p "$PROJECT" -f "$COMPOSE"`. After backing up `.env` and `data/` and confirming publication, set the existing service's image tag to `3.0.1`, then run `pull "$SERVICE"` and `up -d --no-build "$SERVICE"` with those project/file options. Do not replace existing service names or data paths with example values. Recreating the container is required for updated `.env` values to take effect.

The release Compose file names `railsimulatornet/schulmanager-homework-watcher:3.0.1`. Until that image is published, use this ZIP as a source package. The container runs as UID 1001/GID 10 with a read-only root filesystem, all capabilities dropped, and no privilege escalation. Only `data/` and `/tmp` are writable. When upgrading from an older root-based image, existing data must be writable by UID 1001/GID 10; check group mapping and data permissions before updating.

```bash
docker exec schulmanager-homework-watcher node src/run-once.js
docker exec schulmanager-homework-watcher node src/test-mail.js
docker exec schulmanager-homework-watcher node src/login.js
docker logs --tail 50 schulmanager-homework-watcher
```

The browser login helper is optional for regular API fetching. npm is deliberately removed from the production image, so container commands use `node`. Credentials are used only for login and SMTP; do not log raw login responses. Before a later production update, back up private `.env` and `data/`, wait for actual publication and both architecture checks, then use the versioned image tag while retaining the existing data paths.

### Tests and security

`npm ci --ignore-scripts && npm test` covers anonymized module fixtures, diffs, empty responses, partial errors, login pauses, mail rendering, outbox, and the timetable collision. Linux CI also tests the cross-process lock. Release workflows build one OCI archive for AMD64 and ARM64, run on native runners, require Node.js 24.22.1 or later **within Node 24**, test Chromium startup, and check that the unused GStreamer packages affected by CVE-2025-3887 are absent. Trivy blocks fixable HIGH/CRITICAL findings; CodeQL analyzes JavaScript and Actions. Publication requires both architecture checks.

The complete configuration template is [.env.example](.env.example). License: [MIT](LICENSE).
