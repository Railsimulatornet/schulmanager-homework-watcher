# Changelog

## v2.0.2 - 2026-06-26

### Geändert

- Repository-Struktur bereinigt.
- Versehentlich doppelt eingecheckte Projektkopie entfernt.
- Doppelte Handbuch-PDF im Repository-Stamm entfernt.
- Dokumentation für AMD64 und ARM64 aktualisiert.
- Versionsnummer auf 2.0.2 erhöht.

## v2.0.1 - 2026-06-23

### Geändert

- Veröffentlichung über Docker Hub vorbereitet.
- Automatischen Docker-Build über GitHub Actions ergänzt.
- Versions- und Datumstags für Docker-Images ergänzt.

## v2.0.0 - 2026-04-24

### Neu

- Container-Logs enthalten jetzt automatisch Datum und Uhrzeit im deutschen Format.
- Neue zentrale Logging-Funktion `src/lib/logging.js` eingeführt.
- Automatische Zeitstempel für `console.log`, `console.info`, `console.warn`, `console.error` und `console.debug`.

### Geändert

- `package.json` auf Version `2.0.0` angehoben.
- `src/scheduler.js` bindet die zentrale Logging-Funktion beim Containerstart ein.
- `src/run-once.js` bindet die zentrale Logging-Funktion für manuelle Abrufe und Watcher-Läufe ein.
- `src/test-mail.js` bindet die zentrale Logging-Funktion für Testmail-Ausgaben ein.
- `src/login.js` bindet die zentrale Logging-Funktion für Login-Ausgaben ein.

### Vorteil

- Die Container-Logs sind nun wesentlich besser nachvollziehbar, da jeder Eintrag einen Zeitstempel wie `[24.04.2026 09:27:01]` enthält.
- Besonders bei regelmäßig geplanten Abrufen ist sofort ersichtlich, wann ein Lauf gestartet wurde, wann er beendet wurde und wann eine Mail versendet oder übersprungen wurde.

### Beispiel

```text
[24.04.2026 09:27:00] [scheduler] Starte mit Zeitplan: 0,30 6-21 * * *
[24.04.2026 09:27:00] [scheduler] Zeitzone: Europe/Berlin
[24.04.2026 09:27:00] [watcher] Abruf startet...
[24.04.2026 09:27:01] [watcher] Fertig. Änderungen: neu 0, entfernt 0
[24.04.2026 09:27:01] [watcher] Nachweis: reports/latest-evidence.md
[24.04.2026 09:27:01] [watcher] CSV: reports/watch-window-first-seen.csv
[24.04.2026 09:27:01] [watcher] Keine Mail versendet. Vorschau: mail/latest-mail.txt
```

## v1.0.0 - 2026-03-04

### Erste öffentliche Version

- Regelmäßiger Abruf sichtbarer Hausaufgaben im Schulmanager.
- Erkennung neuer und entfernter Einträge.
- Dokumentation des Zeitpunkts „erstmals erkannt“.
- Versand von HTML- und Text-E-Mails.
- Testmail-Funktion.
- Manuell auslösbarer Sofort-Abruf.
- Rotation von Laufzeitdaten.
- Dokumentation für die Einrichtung auf einem UGREEN NAS mit UGOS Pro.
