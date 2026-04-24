# Schulmanager Homework Watcher

Docker-Container zur Überwachung sichtbarer Hausaufgaben im Schulmanager mit E-Mail-Benachrichtigung.

## Funktionen

- regelmäßiger Abruf der sichtbaren Hausaufgaben
- Vergleich mit vorherigen Abrufen
- Erkennung von **neuen** und **entfernten** Einträgen
- Dokumentation des Zeitpunkts **„erstmals erkannt“**
- Versand von **HTML- und Text-E-Mails**
- **Testmail-Funktion** zur Prüfung von SMTP, Darstellung und Anhängen
- automatische Aufbewahrung und Rotation alter Laufzeitdaten

---

## Wichtiger Hinweis

Diese Lösung ist eine Community-Lösung und **kein offizielles Produkt** von Schulmanager oder UGREEN.

Die Nutzung erfolgt **auf eigene Verantwortung**.

Dieses Projekt ist dafür gedacht, mit **dem eigenen Zugang** sichtbare Hausaufgaben automatisiert zu prüfen und Änderungen nachvollziehbar zu dokumentieren.

---

## Geeignet für

- **UGREEN NAS** mit **UGOS Pro** und Docker-App
- Linux-Server mit Docker / Docker Compose

---

## Projektstruktur

```text
schulmanager-homework-watcher/
├─ docker-compose.yaml
├─ Dockerfile
├─ package.json
├─ README.md
├─ .env.example
├─ src/
├─ data/
│  ├─ mail/
│  ├─ reports/
│  ├─ snapshots/
│  └─ logs/
└─ secrets/
```

## Einrichtung

### 1. Projekt entpacken

Projekt in einen Ordner kopieren, zum Beispiel:

```bash
/volume2/docker/schulmanager-homework-watcher/
```

### 2. `.env` anlegen

Die Datei `.env.example` nach `.env` kopieren und mit den eigenen Daten befüllen.

### 3. Container bauen und starten

Im Projektordner ausführen:

```bash
docker compose down
docker compose up -d --build
```

## Typischer Fehler

### `no configuration file provided: not found`

Dieser Fehler tritt meist auf, wenn du **nicht im Projektordner** bist oder Compose die `docker-compose.yaml` nicht findet.

### Lösung

Zuerst in den Projektordner wechseln:

```bash
cd /volume2/docker/schulmanager-homework-watcher
docker compose up -d --build
```

Alternativ mit vollständigem Pfad zur Compose-Datei:

```bash
docker compose -f /volume2/docker/schulmanager-homework-watcher/docker-compose.yaml up -d --build
```

## Testmail

Mit der Testmail-Funktion lassen sich SMTP-Versand, Darstellung und Anhänge prüfen.

Die Testmail verändert **keine echten Watcher-Daten**.

### Testmail ausführen

```bash
docker exec -it schulmanager-homework-watcher node src/test-mail.js
```

### Erwartetes Ergebnis

Im Terminal erscheint eine Meldung ähnlich wie:

```text
[test-mail] Testmail versendet (...). Vorschau: /app/data/mail/latest-test-mail.txt
```

Zusätzlich werden Vorschauen im Datenordner erzeugt, zum Beispiel:

```text
data/mail/latest-test-mail.txt
data/mail/latest-test-mail.html
data/mail/testmail-pseudohausaufgaben.txt
```

## Manueller Abruf (sofort)

Wenn du nicht auf den nächsten geplanten Lauf warten möchtest, kannst du den Watcher sofort manuell starten.

### Sofortigen Abruf ausführen

```bash
docker exec -it schulmanager-homework-watcher node src/run-once.js
```

### Wofür ist das nützlich?

- zum direkten Testen nach Änderungen an der Konfiguration
- zum Prüfen, ob der Abruf grundsätzlich funktioniert
- zum sofortigen Versand einer Änderungsmail, falls neue Einträge vorhanden sind

## Logs

Zur Fehlersuche oder Kontrolle des laufenden Betriebs können die Container-Logs angezeigt werden.

### Live-Logs anzeigen

```bash
docker logs -f schulmanager-homework-watcher
```

### Typische Erfolgsmeldung

```text
[watcher] Fertig: Änderungen: neu 0, entfernt 0
```

### Typische Fehlermeldung

```text
[watcher] Fehler: ...
```

## Wichtige Laufzeitdateien

### `data/mail/`
Enthält Mail-Vorschauen, zum Beispiel:

- `latest-mail.txt`
- `latest-mail.html`
- `latest-test-mail.txt`
- `latest-test-mail.html`
- `latest-error-mail.txt`
- `latest-error-mail.html`

### `data/reports/`
Enthält Berichte und Nachweise, zum Beispiel:

- `latest-evidence.md`
- `watch-window-first-seen.csv`
- `watch-window-first-seen.json`

### `data/snapshots/`
Enthält gespeicherte Abrufe zur Nachvollziehbarkeit.

### `data/logs/`
Enthält Fehler- und Debug-Informationen.

## Scheduler / Zeitplan

Der automatische Abruf wird über die Variable `CRON_SCHEDULE` gesteuert.

Beispiel:

```env
CRON_SCHEDULE=0,30 6-21 * * *
```

Bedeutung:

- Abruf alle **30 Minuten**
- von **06:00 Uhr** bis **21:30 Uhr**
- nachts keine Abrufe

## Beispiel für eine Konfiguration

```env
TZ=Europe/Berlin

SCHULMANAGER_BASE_URL=https://login.schulmanager-online.de
SCHULMANAGER_USERNAME=deine-mailadresse@example.de
SCHULMANAGER_PASSWORD=dein-passwort

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
SMTP_PASS=dein-smtp-passwort
MAIL_FROM=absender@example.de
MAIL_TO=empfaenger@example.de
```

## Handbuch

Das ausführliche Handbuch findest du im Ordner `docs/`.

```text
docs/Schulmanager-Homework-Watcher_Handbuch_DE_v1.0.pdf
```
