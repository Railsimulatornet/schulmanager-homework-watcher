### Schulmanager Homework Watcher v2.0.4

## Was ist neu?

Dieses Update kümmert sich hauptsächlich um die Sicherheit des Mailversands und des Docker-Images.

• Nodemailer wurde auf die aktuelle 9.1-Version angehoben.  
• Das Docker-Image wird weiterhin komplett frisch auf Basis von Playwright 1.62.1 / Ubuntu Noble gebaut.  
• Verfügbare Ubuntu-Sicherheitsupdates werden beim Image-Build automatisch mitgenommen.  
• Vor einer Veröffentlichung prüft Trivy weiterhin auf behebbare HIGH- und CRITICAL-Sicherheitslücken.  
• Das `latest`-Image wird künftig zusätzlich einmal pro Woche frisch gebaut und geprüft. Die festen Versions-Tags bleiben unverändert.

An der eigentlichen Funktion des Schulmanager Homework Watchers ändert sich mit diesem Release nichts.

## Docker-Image

Das Image unterstützt weiterhin:

• `linux/amd64`  
• `linux/arm64`

Docker-Image:

`railsimulatornet/schulmanager-homework-watcher:latest`

Verfügbare Release-Tags:

• `2.0.4`  
• `2.0`  
• `latest`  
• Datumstag der Veröffentlichung

## Aktualisierung

Im Projektordner:

```bash
docker compose pull
docker compose up -d --force-recreate
```

In der UGOS-Docker-App kann das Projekt alternativ über **Neu bereitstellen** aktualisiert werden. Dabei muss **Das neuste Image abrufen** aktiviert sein.

## Hinweis

Dies ist eine Community-Lösung und kein offizielles Produkt von Schulmanager oder UGREEN.

Die Nutzung erfolgt auf eigene Verantwortung.
