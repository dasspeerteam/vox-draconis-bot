# Vox Draconis Bot - Deployment Anleitung

## 🎯 STATUS (Stand: 20.03.2026)

### ✅ Erledigt:
- GitHub Repository neu erstellt: `https://github.com/dasspeerteam/vox-draconis-bot`
- Alle Dateien hochgeladen mit korrekter Ordnerstruktur:
  ```
  vox-draconis-bot/
  ├── backend/
  │   ├── server.js          (v3.5 mit Warcraft Logs + Raider.io)
  │   ├── warcraftlogs.js    (WCL API Client)
  │   └── package.json
  ├── frontend/
  │   └── chat-widget.html
  ├── .gitignore
  └── ANLEITUNG.md
  ```
- Code enthält alle Features:
  - Raider.io Gilden-Rankings (Item Level, M+ Score)
  - Warcraft Logs Boss-Taktiken
  - Warcraft Logs Raid-Fortschritt
  - System Prompt mit aktuellen Gildenregeln

### ⏳ Ausstehend:
- Vercel Deployment (wartet auf Internet-Stabilität)
- Environment Variables bei Vercel eintragen
- Finale Tests

---

## 🚀 NÄCHSTE SCHRITTE (Wenn Vercel erreichbar)

### Schritt 1: Altes Vercel Projekt löschen
1. Gehe zu: `https://vercel.com/dashboard`
2. Finde Projekt: `vox-draconis-bot`
3. Settings → Delete Project

### Schritt 2: Neues Vercel Projekt erstellen
1. "Add New..." → "Project"
2. GitHub importieren: `dasspeerteam/vox-draconis-bot`
3. Framework Preset: "Other"
4. Root Directory: leer lassen (oder `backend` falls gefragt)

### Schritt 3: Environment Variables eintragen
Diese Variablen müssen bei Vercel hinzugefügt werden:

| Variable | Beschreibung | Woher? |
|----------|--------------|--------|
| `OPENAI_API_KEY` | OpenAI API Zugriff | https://platform.openai.com |
| `BLIZZARD_CLIENT_ID` | Blizzard API Client ID | https://develop.battle.net |
| `BLIZZARD_CLIENT_SECRET` | Blizzard API Secret | https://develop.battle.net |
| `WCL_CLIENT_ID` | Warcraft Logs Client ID | https://www.warcraftlogs.com/api/docs |
| `WCL_CLIENT_SECRET` | Warcraft Logs Secret | https://www.warcraftlogs.com/api/docs |
| `GUILD_REALM` | Server-Name | `alexstrasza` |
| `GUILD_NAME` | Gilden-Name | `Vox Draconis` |

### Schritt 4: Deploy
- "Deploy" klicken
- Warten auf Build (1-2 Minuten)
- URL notieren (z.B. `https://vox-draconis-bot.vercel.app`)

---

## 🧪 TESTS NACH DEPLOYMENT

### Test 1: Health Check
```powershell
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/"
```
Erwartet: `Vox Draconis Bot läuft! v3.5 (Warcraft Logs + Raider.io)`

### Test 2: Top 5 Item Level
```powershell
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wer sind die besten 5 Char in der Gilde?"}'
```
Erwartet: Liste mit 5 Charakteren und Item Level

### Test 3: Boss-Taktik
```powershell
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wie besiegt man Sikran?"}'
```
Erwartet: Warcraft Logs Analyse mit Kills, iLvl, Top DPS

### Test 4: Letzte Kills
```powershell
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Zeig mir unsere letzten Kills"}'
```
Erwartet: Liste der letzten Boss-Kills aus Warcraft Logs

---

## 🔧 FEHLERBEHEBUNG

### Falls "Function Invocation Failed":
1. Vercel Logs prüfen: `https://vercel.com/dashboard` → Projekt → Logs
2. Typische Fehler:
   - "Cannot find module": Dateipfad prüfen (Groß-/Kleinschreibung!)
   - "Module not found": `npm install` bei Vercel prüfen
   - "Environment variable": Fehlende ENV Variable

### Falls keine Daten kommen:
1. Prüfe ob Raider.io API erreichbar
2. Prüfe ob Warcraft Logs API Key gültig
3. Cache prüfen (5 Minuten)

---

## 📋 FEATURES ÜBERSICHT

### Raider.io Features:
- ✅ Top 5 nach Item Level
- ✅ Tanks nach Item Level
- ✅ Top M+ Scores
- ✅ Klassen-Filter (Welcher Magier hat höchsten M+ Score?)
- ✅ Rollen-Listen (Tanks, Heiler, DPS)
- ✅ Alle Gildenmitglieder

### Warcraft Logs Features:
- ✅ Boss-Taktiken (Kills, iLvl, Kampfdauer, Top DPS)
- ✅ Raid-Fortschritt (letzte Kills)
- ✅ Unterstützte Bosse: Sikran, One-Armed-Bandit, Mugzee, Chrome King Gallywix

### OpenAI Features:
- ✅ Allgemeines WoW-Wissen
- ✅ Gilden-interne Regeln
- ✅ Raidzeiten

---

## 🔗 WICHTIGE LINKS

- **GitHub Repo:** `https://github.com/dasspeerteam/vox-draconis-bot`
- **Vercel Dashboard:** `https://vercel.com/dashboard`
- **Warcraft Logs API:** `https://www.warcraftlogs.com/api/docs`
- **Blizzard Dev:** `https://develop.battle.net`
- **OpenAI:** `https://platform.openai.com`

---

## 📝 KIMI NOTIZEN

### Letzte Änderungen:
- Fix: Item Level Filter (erlaubt jetzt auch 0 Werte)
- Fix: Trigger für "besten 5 Char" erweitert
- System Prompt aktualisiert mit neuen Gildenregeln (Bibi, Claudius, Mario)

### Bekannte Probleme:
- Keine

### Nächste Features (optional):
- [ ] M+ Scores ab Mittwoch 26.03. testen (neue Saison)
- [ ] Weitere Bosse zu WCL Mapping hinzufügen
- [ ] BIS-Items aus Blizzard API

---

**Erstellt am:** 20.03.2026  
**Letzte Änderung:** Server.js Fix für Item Level Filter  
**Status:** Bereit für Vercel Deployment
