# Schulmanager Homework Watcher v3.0.1

## Deutsch

Mit v3.0.1 kommt jetzt auch die größere Erweiterung, die ich bereits im Alltag getestet habe. 🙂 Der Watcher prüft nicht mehr nur Hausaufgaben, sondern zusätzlich Fehlzeiten, Einträge, die Stundenhistorie, Klassenarbeiten und Stundenplanänderungen.

• Jeder Bereich lässt sich einzeln überwachen und bei Bedarf per E-Mail benachrichtigen.
• Änderungen werden mit Nachweisen dokumentiert – inklusive Erstbeobachtung, Änderungen und entfernten bzw. wieder vorhandenen Einträgen.
• Mehrere Vertretungen derselben ursprünglichen Stunde werden im Stundenplan sauber unterschieden.
• Nicht versendete Mails bleiben im Postausgang erhalten. Fehler in einem Bereich sollen die anderen Bereiche möglichst nicht aufhalten.
• Die Sicherheitskorrekturen aus v2.0.6 sind enthalten, darunter Node.js 24.22.1 und die Entfernung der nicht benötigten GStreamer-Pakete.

**Wichtig beim Update:** Vorher `.env` und den kompletten Ordner `data/` sichern und beibehalten. Die neuen `WATCH_*`- und `MAIL_*`-Einstellungen stehen in der [Beispielkonfiguration](https://github.com/Railsimulatornet/schulmanager-homework-watcher/blob/v3.0.1/.env.example). Der erste erfolgreiche Abruf eines neu aktivierten Bereichs erstellt zunächst einen Ausgangsstand, ohne eine Änderungsmail zu senden.

Docker-Images für AMD64 und ARM64. Beide Plattformen werden vor der Veröffentlichung mit Chromium- und Sicherheitstests geprüft.

## English

Version 3.0.1 includes the larger extension I've already been testing in everyday use. 🙂 The watcher now covers more than homework: absences, entries, lesson history, exams and timetable changes are included too.

• Monitoring and email notifications can be enabled separately for each area.
• Changes are recorded with evidence, including first seen, updated, removed and returned items.
• Multiple substitutions for the same original lesson are handled separately.
• Emails that could not be delivered remain in the outbox. Problems in one area should not stop the others where possible.
• The security fixes from v2.0.6 are included, notably Node.js 24.22.1 and removal of the unused GStreamer packages.

**Before updating:** Back up and keep your `.env` and entire `data/` directory. The new `WATCH_*` and `MAIL_*` options are in the [example configuration](https://github.com/Railsimulatornet/schulmanager-homework-watcher/blob/v3.0.1/.env.example). The first successful check of a newly enabled area creates a baseline without sending a change notification.

Docker images are available for AMD64 and ARM64. Both platforms undergo Chromium and security checks before publication.
