### Schulmanager Homework Watcher v2.0.6

## Deutsch

Dieses Sicherheitsupdate erneuert die Node.js-Laufzeit und entfernt zwei nicht benötigte GStreamer-Pakete aus dem Docker-Image.

- Die Veröffentlichung verlangt jetzt mindestens **Node.js 24.22.1** innerhalb der Node-24-Reihe. Damit werden ältere Laufzeiten mit den im Oktober 2026 behobenen Sicherheitslücken abgewiesen.
- `gstreamer1.0-plugins-bad` und `libgstreamer-plugins-bad1.0-0` werden wegen **CVE-2025-3887** entfernt. Sie gehören zu den mitgelieferten WebKit-Abhängigkeiten; der Watcher verwendet Chromium.
- Native AMD64- und ARM64-Runner kontrollieren die Node-Version, die entfernten Pakete und den Chromium-Start mit einer lokalen Testseite. Beide prüfen dasselbe Image-Archiv; die Veröffentlichung verlangt beide passenden Prüfnachweise. Die bisherigen Syntax-, Mail-Kompatibilitäts- und Trivy-Prüfungen bleiben erhalten.

Hausaufgabenabruf, Zeitplan, Mailversand und vorhandene Daten behalten ihr bisheriges Verhalten. Playwright und Chromium bleiben auf dem bisherigen Versionsstand.

### Aktualisierung

Im bestehenden Projektordner:

```bash
docker compose pull
docker compose up -d --force-recreate
```

In der UGOS-Docker-App: **Neu bereitstellen** und **Das neuste Image abrufen** aktivieren. Die vorhandene `.env` und der Ordner `data/` bleiben erhalten.

## English

This security update refreshes the Node.js runtime and removes two unused GStreamer packages from the Docker image.

- Publication now requires **Node.js 24.22.1 or later within Node 24**, rejecting older runtimes affected by the October 2026 security issues.
- `gstreamer1.0-plugins-bad` and `libgstreamer-plugins-bad1.0-0` are removed because of **CVE-2025-3887**. They are inherited WebKit dependencies; the watcher uses Chromium.
- Native AMD64 and ARM64 runners check the Node version, removed packages and Chromium startup with a local test page, alongside the existing syntax, mail compatibility and Trivy checks. Both verify the same image archive; publication requires matching verification receipts from both platforms.

Homework collection, scheduling, email delivery and existing data retain their previous behavior. Playwright and Chromium remain at their existing versions.

To update, run the commands above in the existing project directory, or redeploy through the UGOS Docker app with the latest-image download enabled. Keep your `.env` and `data/` directory.

## Docker

`railsimulatornet/schulmanager-homework-watcher:2.0.6`

Platforms: `linux/amd64`, `linux/arm64`. Additional tags: `2.0`, `latest` and the publication date.

## References

- [Node.js 24.22.1 security release](https://nodejs.org/en/blog/release/v24.22.1/)
- [Ubuntu: CVE-2025-3887](https://ubuntu.com/security/CVE-2025-3887)
