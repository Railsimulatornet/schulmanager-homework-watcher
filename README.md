# Schulmanager Homework Watcher

Docker-Container zum regelmäßigen Abruf sichtbarer Hausaufgaben im Schulmanager **inkl. "erstmals erkannt"-Nachweis** und Mailbenachrichtigung.

## Schnellstart (UGREEN NAS / Linux)

1. Projektordner auf dem NAS anlegen, z. B.:
   `/volume2/docker/schulmanager-homework-watcher/`

2. `.env.example` nach `.env` kopieren und Werte anpassen:
   - Schulmanager-Login
   - SMTP-Maildaten

3. Container bauen & starten (im Projektordner):
   ```bash
   docker compose up -d --build
   ```

## Wichtige Hinweise

### Typischer Fehler: `no configuration file provided: not found`
Dieser Fehler tritt fast immer auf, wenn du **nicht im Projektordner** bist (wo die `docker-compose.yaml` liegt) oder wenn du Compose nicht auf die Datei verweist.

**Lösung:**
- erst in den Projektordner wechseln, dann Kommandos ausführen, oder
- `-f` verwenden:
  ```bash
  docker compose -f /volume2/docker/schulmanager-homework-watcher/docker-compose.yaml ps
  ```

## Testmail
Versendet eine Testmail (ohne echte Watcher-Daten zu verändern):
```bash
docker exec -it schulmanager-homework-watcher node src/test-mail.js
```

## Manueller Abruf (sofort)
```bash
docker exec -it schulmanager-homework-watcher node src/run-once.js
```

## Logs
```bash
docker logs -f schulmanager-homework-watcher
```


