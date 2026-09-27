### Schulmanager Homework Watcher v2.0.4

## Änderungen

• Nodemailer von `^9.0.1` auf `^9.1.0` angehoben
• Das Docker-Image wird vollständig frisch mit aktuellem Playwright-Noble-Basisimage gebaut
• Verfügbare Ubuntu-Sicherheitsupdates werden weiterhin ausschließlich innerhalb des Docker-Builds eingespielt
• Der bestehende Trivy-Security-Gate blockiert die Veröffentlichung bei behebbaren HIGH- oder CRITICAL-Funden
• SBOM und Build-Provenance bleiben aktiviert

Die eigentliche Funktion des Schulmanager Homework Watchers wurde nicht verändert.

## Docker-Image

Das veröffentlichte Docker-Image unterstützt:

• `linux/amd64`
• `linux/arm64`

Docker-Image:

`railsimulatornet/schulmanager-homework-watcher:latest`

Verfügbare Versions-Tags:

• `2.0.4`
• `2.0`
• `latest`
• Datumstag der Veröffentlichung

## Aktualisierung über Docker Compose

```bash
cd /volume2/docker/schulmanager-homework-watcher
docker compose pull
docker compose up -d --force-recreate
```

In der UGOS-Docker-App kann das Projekt alternativ über „Neu bereitstellen“ aktualisiert werden. Dabei muss „Das neuste Image abrufen“ aktiviert sein.

## Hinweis

Dies ist eine Community-Lösung und kein offizielles Produkt von Schulmanager oder UGREEN.

Die Nutzung erfolgt auf eigene Verantwortung.
