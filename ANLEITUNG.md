# Vox Draconis WoW Chatbot - Anleitung

## 📋 Übersicht

**Version:** 2.0 (Blizzard API Edition)  
**Status:** ✅ Backend deployed & funktionsbereit  
**Letzte Aktualisierung:** März 2026

Der Chatbot unterstützt jetzt:
- ✅ **Blizzard API** - Charakter-Profile, Ausrüstung, Talente
- ✅ **Raider.io** - Gildenmitglieder, M+ Rankings
- ✅ **OpenAI GPT-4o-mini** - WoW-Wissen, Taktiken

---

## 🚀 Features

### 1. Gilden-Rankings (Raider.io)

**Top 5 nach Item Level:**
```
"Welcher Tank hat das höchste Itemlevel?"
→ Bambas hat ein GS von 240

"Wer sind die besten 5 Char in der Gilde?"
→ 1. NiveÀ mit GS 270
   2. Bambas mit GS 268
   3. Kathreena mit GS 267
   4. Keshara mit GS 250
   5. Mooncrush mit GS 248
```

**M+ Rankings:**
```
"Welcher Magier hat den höchsten M+ Score?"
→ Loreal hat den höchsten M+ Score mit 1810 Punkten. 
   Gefolgt von Pyropathisch mit 1800 Punkten 
   und Arkangel mit 1799 Punkten.

"Wer hat das höchste M+ Rating?"
→ Loreal mit 1810, gefolgt von Keshara mit 1809, 
   dann kommt Kathreena mit 1805
```

**Rollen-Übersicht:**
```
"Wer sind die Tanks?"
"Zeig mir alle Heiler"
"Liste der DPS"
```

### 2. Boss-Taktiken (Warcraft Logs)

**Analyse aus euren eigenen Logs:**
```
"Wie besiegt man Sikran?"
→ Basierend auf euren Warcraft Logs:
   • 12 erfolgreiche Kills
   • Durchschnittliches iLvl: 625
   • Kampfdauer: 4:05 Min
   Top DPS:
   1. Havoc DH - 85.432 DPS
   2. Frost Mage - 82.156 DPS
   3. Enhancement Shaman - 79.843 DPS

"Taktik für One-Armed-Bandit"
→ Warcraft Logs Analyse:
   • 8 erfolgreiche Kills
   • Setup: 2 Tanks, 4 Heiler, 14 DPS empfohlen
   • Durchschnitt: 4:30 Min Kampfzeit
```

**Raid-Fortschritt:**
```
"Wie weit sind wir im Raid?"
"Zeig mir unsere letzten Kills"
"Letzte Logs"
→ Letzte Kills:
  • Sikran (Heroic) - 15.03.2026
  • One-Armed-Bandit (Heroic) - 14.03.2026
  • Mug'Zee (Normal) - 10.03.2026
```

### 2. Gilden-Informationen
| Frage | Antwort |
|-------|---------|
| "Wer ist in der Gilde?" | Liste aller Gildenmitglieder |
| "Zeig mir die Gildenmitglieder" | Mitglieder mit Klasse/Spec und iLvl |
| "Wer leitet die Gilde?" | Thomas (inkl. interne Regeln) |

### 3. Raid-Informationen
| Frage | Antwort |
|-------|---------|
| "Wann sind Raidzeiten?" | Heroic: Do/So, Normal: Fr |
| "Wer sind die Tanks?" | Thomas, Olaf, Niveà/Nivea |
| "Wer heilt?" | Alex/Kesh/Keshara (EINE Person!) |

### 4. Allgemeines WoW-Wissen
- Klassen-Guides
- Talent-Empfehlungen
- Boss-Taktiken
- Mechanik-Erklärungen

---

## 🔑 API Keys & Konfiguration

### Erforderliche Environment Variables

| Variable | Beschreibung | Woher? |
|----------|--------------|--------|
| `OPENAI_API_KEY` | OpenAI API Zugriff | https://platform.openai.com |
| `BLIZZARD_CLIENT_ID` | Blizzard API Client ID | https://develop.battle.net |
| `BLIZZARD_CLIENT_SECRET` | Blizzard API Secret | https://develop.battle.net |
| `GUILD_REALM` | Server-Name | `alexstrasza` |
| `GUILD_NAME` | Gilden-Name | `Vox Draconis` |

### Einrichtung bei Vercel

1. **Vercel Dashboard öffnen:**
   ```
   https://vercel.com/dashboard → vox-draconis-bot → Settings → Environment Variables
   ```

2. **Alle Variablen eintragen:**
   - Jede Variable unter "Name" und "Value" eintragen
   - Auf "Save" klicken
   - Vercel deployed automatisch neu

---

## 📝 Test-Fragen

### Gilden-Rankings (Raider.io)
```powershell
# Top 5 nach Item Level
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wer sind die besten 5 Char in der Gilde?"}'

# Tanks nach Item Level
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Welcher Tank hat das höchste Itemlevel?"}'

# Magier nach M+ Score
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Welcher Magier hat den höchsten M+ Score?"}'

# Top M+ Scores
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wer hat das höchste M+ Rating?"}'

# Rollen-Listen
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wer sind die Tanks?"}'
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Zeig mir alle Heiler"}'
```

### Boss-Taktiken (Warcraft Logs)
```powershell
# Boss-Analyse aus eigenen Logs
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wie besiegt man Sikran?"}'
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Taktik für One-Armed-Bandit"}'
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wie killt man Mugzee?"}'

# Raid-Fortschritt
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wie weit sind wir im Raid?"}'
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Zeig mir unsere letzten Kills"}'
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Letzte Logs"}'
```

### Gilden-Infos
```powershell
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wer ist in der Gilde?"}'

Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wer leitet die Gilde?"}'
```

### Raid-Infos
```powershell
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Wann sind Raidzeiten?"}'
```

### Allgemeine Fragen
```powershell
Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Erkläre mir das Concentration System"}'

Invoke-RestMethod -Uri "https://vox-draconis-bot.vercel.app/chat" -Method POST -ContentType "application/json" -Body '{"message":"Was ist der beste Tank für M+?"}'
```

---

## 🔧 Projektstruktur

```
wow-chatbot/
├── backend/
│   ├── server.js          # Haupt-Server (API & Logik)
│   └── package.json       # Abhängigkeiten
├── frontend/
│   ├── chat-widget.html   # Chat-Interface (HTML/CSS/JS)
│   └── vd-kopf.png        # Gildenlogo
├── ANLEITUNG.md           # Diese Datei
└── README.md              # Kurzbeschreibung
```

---

## 🛠️ Deployment (für Entwickler)

### Lokale Entwicklung
```bash
cd backend
npm install
npm start
```

### Auf Vercel deployen
1. Code auf GitHub pushen
2. Vercel mit GitHub verbinden
3. Environment Variables setzen
4. Automatisches Deployment

---

## 📊 API Limits

| Service | Limit | Hinweis |
|---------|-------|---------|
| OpenAI | Rate limit nach Account | ~$1-3/Monat bei normaler Nutzung |
| Blizzard | 100 Requests/Sekunde | Mehr als ausreichend |
| Raider.io | 120 Requests/Minute | Keine Probleme erwartet |

---

## 🐛 Fehlerbehebung

### "Keine Antwort erhalten"
- Prüfe OpenAI API Key (Guthaben vorhanden?)
- Vercel Logs prüfen: https://vercel.com/dashboard → Logs

### "Charakter nicht gefunden"
- Name korrekt geschrieben?
- Charakter existiert auf Alexstrasza?
- Blizzard API Keys korrekt?

### "Blizzard API nicht verfügbar"
- Client ID und Secret bei Vercel prüfen
- Token läuft alle 24h ab (wird automatisch erneuert)

### Allgemeine Fehler
```bash
# Vercel Logs anzeigen
https://vercel.com/dashboard → vox-draconis-bot → Logs
```

---

## 🎯 Roadmap / Zukünftige Features

- [ ] M+ Scores (ab Saisonstart Mittwoch)
- [ ] Raid-Log Analyse (Warcraft Logs)
- [ ] Auction House Preise
- [ ] Discord-Integration
- [ ] Charakter-Vergleich

---

## 📞 Support

**Bei Problemen:**
1. Vercel Logs prüfen
2. API Keys überprüfen
3. Environment Variables kontrollieren

**Gilden-Interna:**
- Alle sensiblen Daten sind im System Prompt hinterlegt
- Werden nicht öffentlich auf GitHub angezeigt
- Nur über Environment Variables konfigurierbar

---

## 📝 Changelog

### v3.5 (Aktuell)
- ✅ Warcraft Logs Integration
- ✅ Boss-Taktiken aus eigenen Logs
- ✅ Raid-Fortschritt / Letzte Kills
- ✅ DPS-Analyse pro Boss

### v3.0
- ✅ Gilden-Rankings nach Item Level
- ✅ M+ Score Rankings
- ✅ Klassen-Filter (Welcher Magier...)
- ✅ Rollen-Listen (Tanks, Heiler, DPS)
- ✅ Cache für schnellere Antworten

### v2.0
- ✅ Blizzard API hinzugefügt (Charakter-Profile, Ausrüstung, Talente)
- ✅ Gildeninterne Informationen im System Prompt
- ✅ Verbesserte Fehlerbehandlung

### v1.0
- ✅ Grundfunktion mit OpenAI
- ✅ Raider.io Gilden-Mitglieder
- ✅ Basis WoW-Wissen

---

**Fertig! Der Bot ist einsatzbereit.** 🐉
