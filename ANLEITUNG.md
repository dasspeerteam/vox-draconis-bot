# 📋 Vox Draconis Bot - Anleitung (Stand 21.03.2026)

## ✅ WAS FUNKTIONIERT

| Feature | Status | URL |
|---------|--------|-----|
| **Chat-Widget** | ✅ Funktioniert | https://vox-draconis-bot.vercel.app/chat.html |
| **API (GET)** | ✅ Funktioniert | `/chat?message=...` |
| **JSON-Datenbank** | ✅ Funktioniert | 6 Mitglieder gespeichert |

## 🔗 WICHTIGE LINKS

- **Chat nutzen:** https://vox-draconis-bot.vercel.app/chat.html
- **Daten bearbeiten:** https://github.com/dasspeerteam/vox-draconis-bot/edit/main/backend/guild-data.json

## 📝 NEUE MITGLIEDER HINZUFÜGEN

1. Auf GitHub öffnen: https://github.com/dasspeerteam/vox-draconis-bot/edit/main/backend/guild-data.json
2. Nach letztem Mitglied ein Komma `,` setzen
3. Neues Mitglied einfügen:
```json
    "NeuerName": {
      "spitzname": "...",
      "rolle": "Tank/DPS/Heiler",
      "klasse": "...",
      "info": "..."
    }
```
4. **Commit changes** klicken
5. **1-2 Minuten warten**
6. Im Chat testen!

## 👥 AKTUELLE MITGLIEDER

1. Thomas (Drachenführer, Gildenleiter)
2. Sahrah (Ihre Hoheit, Heiler)
3. Keshara (Kesh, Heiler)
4. Bibi (Der Neue, Tank)
5. Mario (Housing-Profi, DPS)
6. **Claudius** (Mitglied, liebt Backkartoffeln 🥔)

## ⚠️ BEKANNTE PROBLEME

- POST-Requests funktionieren nicht auf Vercel (nur GET)
- Lösung: Chat-Widget nutzen (macht automatisch GET-Requests)

## 🎯 TODO / NÄCHSTE SCHRITTE

- [ ] Weitere Mitglieder hinzufügen
- [ ] Neue Regeln eintragen
- [ ] POST-Requests fixen (falls nötig)

---

**Für Kimi:** Wir haben am 21.03.2026 den Chat-Bot erfolgreich deployed. Die JSON-Datenbank funktioniert. Der Benutzer möchte morgen neue Mitglieder hinzufügen.
