### Schulmanager Homework Watcher v2.0.3

## Änderungen

• Playwright von `1.58.2` auf `1.62.1` aktualisiert
• Docker-Basis auf `mcr.microsoft.com/playwright:v1.62.1-noble` aktualisiert
• Verfügbare Ubuntu-Sicherheitsupdates werden bei jedem sauberen Image-Build eingespielt
• Trivy prüft jetzt OS- und Library-Pakete und stoppt bei behebbaren HIGH- oder CRITICAL-Funden
• Docker-Releases werden vollständig frisch mit `pull: true` und `no-cache: true` gebaut
• SBOM und Build-Provenance für veröffentlichte Docker-Images aktiviert
• Unnötige Playwright-Browser-Downloads während `npm install` werden verhindert

Die eigentliche Funktion des Schulmanager Homework Watchers wurde durch dieses Wartungs- und Sicherheitsupdate nicht verändert.

## Docker-Image

Das veröffentlichte Docker-Image unterstützt:

• `linux/amd64`
• `linux/arm64`

Docker-Image:

`railsimulatornet/schulmanager-homework-watcher:latest`

Verfügbare Versions-Tags:

• `2.0.3`
• `2.0`
• `latest`
• Datumstag der Veröffentlichung

## Aktualisierung über Docker Compose

```bash
cd /volume2/docker/schulmanager-homework-watcher
docker compose pull
docker compose up -d --force-recreate
docker image prune -f
```

In der UGOS-Docker-App kann das Projekt alternativ über „Neu bereitstellen“ aktualisiert werden. Dabei muss „Das neuste Image abrufen“ aktiviert sein.

## Hinweis

Dies ist eine Community-Lösung und kein offizielles Produkt von Schulmanager oder UGREEN.

Die Nutzung erfolgt auf eigene Verantwortung.
