### Schulmanager Homework Watcher v2.0.5

## Was ist neu?

Dieses Update bringt die wichtigsten Node.js-Abhängigkeiten auf den aktuell getesteten Stand und verbessert gleichzeitig die automatische Sicherheitsprüfung.

• Nodemailer wurde auf Version `10.0.11` aktualisiert.  
• dotenv wurde auf Version `18.0.4` aktualisiert.  
• Luxon `3.7.2`, node-cron `4.6.0` und Playwright `1.62.1` sind jetzt ebenfalls auf die getesteten Versionen festgesetzt.  
• Der automatische Security-Check prüft zusätzlich die wichtigsten APIs von dotenv und Nodemailer.  
• Das frisch gebaute Image wurde mit Trivy geprüft: keine behebbaren HIGH- oder CRITICAL-Funde.  
• Der reale Testmail-Versand mit den neuen Versionen war erfolgreich.

An der eigentlichen Funktion des Schulmanager Homework Watchers ändert sich mit diesem Release nichts.

## Docker-Image

Das Image unterstützt weiterhin:

• `linux/amd64`  
• `linux/arm64`

Docker-Image:

`railsimulatornet/schulmanager-homework-watcher:latest`

Verfügbare Release-Tags:

• `2.0.5`  
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
