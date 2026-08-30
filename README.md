# LinguaFlow für Phila 🇫🇮

Eine persönliche macOS-Lernapp für Philas Finnisch-Karten. LinguaFlow verwendet ausschließlich die echten Karten, Wiederholungen und Medien aus der lokalen Anki-Sammlung. Es gibt keine Demo- oder Beispielkarten.

## Einmalige Einrichtung

1. Anki Desktop installieren und mit AnkiWeb synchronisieren.
2. Das Add-on **AnkiConnect** in Anki installieren.
3. Anki geöffnet lassen und LinguaFlow starten.
4. Beim ersten Start den gewünschten Finnisch-Stapel auswählen. Seine Unterstapel werden automatisch berücksichtigt.

Die erwarteten Notizfelder sind `Finnish`, `Glossing`, `English` und `Audio`. Zwei Karten pro Notiz werden unterstützt:

- Karte 1: Finnisch → Englisch
- Karte 2: Englisch → Finnisch

## Bedienung

- Leertaste zeigt die Antwort.
- `1` bis `4` bewertet die Karte wie in Anki.
- `Esc` beendet die Sitzung.
- Feedback wird direkt aus der App an Leif gesendet.

## Entwicklung

```sh
npm install
npm run tauri dev
```

Produktions-Build:

```sh
npm run build
npm run tauri build
```

Ein Git-Tag wie `v0.1.0` startet in GitHub automatisch einen macOS-Build und erstellt einen Entwurf unter **Releases**.
