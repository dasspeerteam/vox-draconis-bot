const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const wcl = require('./warcraftlogs');
const blizzard = require('./blizzard');
const sheets = require('./googlesheets');

const app = express();
app.use(cors());
app.use(express.json());

// Google Sheets ID (aus Umgebungsvariable oder fest)
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1ABC123xyz...'; // TODO: Ersetzen mit echter ID

// API KONFIGURATION
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const RAIDER_IO_API = 'https://raider.io/api/v1';
const BLIZZARD_CLIENT_ID = process.env.BLIZZARD_CLIENT_ID;
const BLIZZARD_CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET;
const BLIZZARD_API_URL = 'https://eu.api.blizzard.com';

const GUILD_CONFIG = {
    region: 'eu',
    realm: 'alexstrasza',
    name: 'Vox Draconis'
};

// Cache für Gildendaten (5 Minuten)
let guildCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 Minuten

// ============================================================================
// RAIDER.IO API - ERWEITERTE GILDENDATEN
// ============================================================================

async function getGuildDataWithRankings() {
    // Cache prüfen
    if (guildCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        console.log('[Cache] Verwende zwischengespeicherte Gildendaten');
        return guildCache;
    }

    try {
        // Erweiterte Felder: members (mit gear und mythic_plus_scores)
        const url = `${RAIDER_IO_API}/guilds/profile?region=eu&realm=alexstrasza&name=Vox%20Draconis&fields=members`;
        
        console.log('[API] Rufe Gildendaten ab...');
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.members || data.members.length === 0) {
            return { error: 'Keine Mitglieder gefunden' };
        }

        // Daten aufbereiten und anreichern
        const members = data.members.map(m => {
            const char = m.character;
            return {
                name: char.name,
                class: char.class,
                spec: char.active_spec_name || 'Unbekannt',
                role: char.active_spec_role || 'Unbekannt',
                level: char.level,
                item_level: char.item_level || 0,
                // M+ Daten aus dem Profile
                mythic_plus: {
                    score: char.mythic_plus_scores?.all || 0,
                    dps_score: char.mythic_plus_scores?.dps || 0,
                    healer_score: char.mythic_plus_scores?.healer || 0,
                    tank_score: char.mythic_plus_scores?.tank || 0
                },
                // Raid-Daten
                raid: {
                    summary: char.raid_summary || '',
                    progression: char.raid_progression || {}
                },
                rank: m.rank,
                profile_url: char.profile_url
            };
        });

        const result = {
            guild: data.name,
            member_count: members.length,
            members: members,
            last_updated: new Date().toISOString()
        };

        // Cache speichern
        guildCache = result;
        cacheTimestamp = Date.now();

        console.log(`[API] ${members.length} Mitglieder geladen`);
        return result;

    } catch (error) {
        console.error('[API Error]', error);
        return { error: error.message };
    }
}

// ============================================================================
// RANKING & FILTER FUNKTIONEN
// ============================================================================

function getTopByItemLevel(members, limit = 5) {
    return members
        .filter(m => m.item_level > 0 || m.item_level === 0)  // Auch 0 zulassen falls keine Daten
        .sort((a, b) => (b.item_level || 0) - (a.item_level || 0))
        .slice(0, limit);
}

function getTopByMythicPlus(members, limit = 5) {
    return members
        .filter(m => m.mythic_plus.score > 0)
        .sort((a,b) => b.mythic_plus.score - a.mythic_plus.score)
        .slice(0, limit);
}

function getByRole(members, role, limit = 10) {
    const roleMap = {
        'tank': 'TANK',
        'tanks': 'TANK',
        'heiler': 'HEALER',
        'heilerin': 'HEALER',
        'heal': 'HEALER',
        'heals': 'HEALER',
        'healing': 'HEALER',
        'dps': 'DPS',
        'damage': 'DPS',
        'dd': 'DPS',
        'schaden': 'DPS'
    };
    
    const targetRole = roleMap[role.toLowerCase()];
    if (!targetRole) return [];
    
    return members
        .filter(m => m.role.toUpperCase() === targetRole)
        .sort((a, b) => b.item_level - a.item_level)
        .slice(0, limit);
}

function getByClass(members, className, limit = 10) {
    const classMap = {
        'magier': 'Mage',
        'mage': 'Mage',
        'krieger': 'Warrior',
        'warrior': 'Warrior',
        'paladin': 'Paladin',
        'priester': 'Priest',
        'priest': 'Priest',
        'schurke': 'Rogue',
        'rogue': 'Rogue',
        'jäger': 'Hunter',
        'hunter': 'Hunter',
        'hexenmeister': 'Warlock',
        'warlock': 'Warlock',
        'druide': 'Druid',
        'druid': 'Druid',
        'schamane': 'Shaman',
        'shaman': 'Shaman',
        'todesritter': 'Death Knight',
        'death knight': 'Death Knight',
        'dk': 'Death Knight',
        'mönch': 'Monk',
        'monk': 'Monk',
        'dämonenjäger': 'Demon Hunter',
        'demon hunter': 'Demon Hunter',
        'dh': 'Demon Hunter',
        'evoker': 'Evoker'
    };
    
    const targetClass = classMap[className.toLowerCase()];
    if (!targetClass) return [];
    
    return members
        .filter(m => m.class.toLowerCase() === targetClass.toLowerCase())
        .sort((a, b) => b.mythic_plus.score - a.mythic_plus.score)
        .slice(0, limit);
}

function getTanksSortedByItemLevel(members, limit = 5) {
    return members
        .filter(m => m.role.toUpperCase() === 'TANK' && m.item_level > 0)
        .sort((a, b) => b.item_level - a.item_level)
        .slice(0, limit);
}

function formatItemLevelList(members, title) {
    if (members.length === 0) return `${title}: Keine Daten verfügbar.`;
    
    let result = `${title}:\n`;
    members.forEach((m, i) => {
        result += `${i + 1}. ${m.name} (${m.class}) - GS ${m.item_level}\n`;
    });
    return result;
}

function formatMythicPlusList(members, title) {
    if (members.length === 0) return `${title}: Keine M+ Daten verfügbar.`;
    
    let result = `${title}:\n`;
    members.forEach((m, i) => {
        result += `${i + 1}. ${m.name} (${m.class}) - ${m.mythic_plus.score} Punkte\n`;
    });
    return result;
}

// ============================================================================
// BLIZZARD API (für Einzelcharakter - optional)
// ============================================================================

let blizzardToken = null;
let blizzardTokenExpiry = null;

async function getBlizzardToken() {
    if (blizzardToken && blizzardTokenExpiry && Date.now() < blizzardTokenExpiry) {
        return blizzardToken;
    }
    
    try {
        const response = await fetch('https://oauth.battle.net/token', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${BLIZZARD_CLIENT_ID}:${BLIZZARD_CLIENT_SECRET}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });
        
        const data = await response.json();
        blizzardToken = data.access_token;
        blizzardTokenExpiry = Date.now() + (data.expires_in * 1000);
        return blizzardToken;
    } catch (error) {
        console.error('Blizzard Auth Error:', error);
        return null;
    }
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const WOW_SYSTEM_PROMPT = `Du bist "Vox Draconis" - der offizielle WoW-Hilfsbot der Gilde Vox Draconis auf Alexstrasza (EU).

🆕 WICHTIG: Neue M+ Saison startet erst MITTWOCH (26.03.) - erst dann gibt es neue Scores!

👑 GILDENLEITUNG & STRUKTUR:
- Gildenleiter: Thomas (Tank)
- Weitere Tanks: Olaf, Nivéa/Nivea
- Bester Heiler: Alex/Kesh/Keshara (EINE Person! Kann nur reden ODER heilen)
- Housing: Mario

⚠️ REGELN:
- Sahrah = "Ihre Hoheit"
- Der Bunte Haufen = KEINE Option
- Über Nico = NIEMALS sprechen!

📅 RAIDZEITEN:
- Heroic: Do + So, 19:30-22:00 Uhr
- Normal: Fr, 19:30-22:00 Uhr

💬 DISCORD: https://discord.com/invite/EQUD3HQZeB

📋 ANTWORTEN: Kurz & knapp (max. 3 Sätze)`;

// ============================================================================
// CHAT ENDPOINT
// ============================================================================

app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const lowerMsg = message.toLowerCase();
        
        let contextData = '';
        let toolUsed = false;

        // Gildendaten laden (mit Cache)
        const guildData = await getGuildDataWithRankings();
        
        if (guildData.error) {
            return res.json({
                success: true,
                reply: `Entschuldigung, ich konnte die Gildendaten nicht abrufen: ${guildData.error}`,
                data_source: 'error'
            });
        }

        const members = guildData.members;

        // 0. WARCRAFT LOGS: Spezifischer Report analysieren (Priorität)
        const reportCodeMatch = message.match(/[a-zA-Z0-9]{16}/);
        if (reportCodeMatch && (lowerMsg.includes('report') || lowerMsg.includes('analysiere') || lowerMsg.includes('log'))) {
            const reportCode = reportCodeMatch[0];
            console.log(`[WCL] Analysiere Report: ${reportCode}`);
            
            contextData = `\n\n📊 REPORT ANALYSE (${reportCode}):\n`;
            contextData += `Hier ist der direkte Link zum Report:\n`;
            contextData += `https://www.warcraftlogs.com/reports/${reportCode}\n\n`;
            contextData += `Auf der Seite siehst du:\n`;
            contextData += `• Alle Boss-Kills und Wipes\n`;
            contextData += `• DPS/Healing Rankings\n`;
            contextData += `• Mechanik-Fails\n`;
            contextData += `• Gear und Talente\n`;
            toolUsed = true;
        }
        
        // 0.5 WER HAT DAS HÖCHSTE GS (Priorität vor anderen) - BLIZZARD API
        else if ((lowerMsg.includes('hoechste') || lowerMsg.includes('hoechstes') || lowerMsg.includes('höchste') || lowerMsg.includes('höchstes')) && 
                 (lowerMsg.includes('gs') || lowerMsg.includes('item level') || lowerMsg.includes('ilvl'))) {
            
            try {
                // Blizzard API für zuverlässige Item Level Daten
                console.log('[Blizzard] Frage höchstes GS ab...');
                const blizzardRoster = await blizzard.getGuildRoster();
                
                if (!blizzardRoster.error && blizzardRoster.members && blizzardRoster.members.length > 0) {
                    // Filtere Charaktere mit GS > 0 und sortiere
                    const validMembers = blizzardRoster.members
                        .filter(m => m.item_level > 0)
                        .sort((a, b) => b.item_level - a.item_level);
                    
                    if (validMembers.length > 0) {
                        const best = validMembers[0];
                        contextData = `\n\n🏆 HÖCHSTES ITEM LEVEL (Blizzard API):\n`;
                        contextData += `1. ${best.name} (${best.playable_class}) - GS ${best.item_level}\n\n`;
                        contextData += `📊 Datenquelle: Blizzard API (${blizzardRoster.member_count} Mitglieder insgesamt)`;
                    } else {
                        contextData = '\n\n⚠️ Keine Item Level Daten in der Blizzard API gefunden.';
                    }
                } else {
                    throw new Error(blizzardRoster.error || 'Keine Mitglieder gefunden');
                }
            } catch (error) {
                console.error('[Blizzard] Fehler:', error.message);
                // Fallback zu Raider.io
                const top1 = getTopByItemLevel(members, 1);
                if (top1.length > 0 && top1[0].item_level > 0) {
                    const best = top1[0];
                    contextData = `\n\n🏆 HÖCHSTES ITEM LEVEL (Raider.io):\n1. ${best.name} (${best.class}) - GS ${best.item_level}`;
                } else {
                    contextData = '\n\n⚠️ Keine Item Level Daten verfügbar.';
                }
            }
            toolUsed = true;
        }

        // 1. TANKS NACH ITEM LEVEL
        if ((lowerMsg.includes('tank') || lowerMsg.includes('tanks')) && 
            (lowerMsg.includes('item level') || lowerMsg.includes('ilvl') || lowerMsg.includes('gs'))) {
            
            const tanks = getTanksSortedByItemLevel(members, 5);
            contextData = '\n\n' + formatItemLevelList(tanks, 'Tanks nach Item Level');
            toolUsed = true;
        }
        
        // 2. TOP 5 GILDE NACH ITEM LEVEL - BLIZZARD API
        else if ((lowerMsg.includes('top') || lowerMsg.includes('beste') || lowerMsg.includes('besten')) && 
                 (lowerMsg.includes('5') || lowerMsg.includes('fünf')) && 
                 (lowerMsg.includes('char') || lowerMsg.includes('spieler') || lowerMsg.includes('gilde') ||
                  lowerMsg.includes('item level') || lowerMsg.includes('ilvl') || lowerMsg.includes('gs') || lowerMsg.includes('gear'))) {
            
            console.log('[Blizzard] Frage Top 5 GS ab...');
            const blizzardRoster = await blizzard.getGuildRoster();
            
            if (!blizzardRoster.error && blizzardRoster.members && blizzardRoster.members.length > 0) {
                // Top 5 nach Item Level
                const top5 = blizzardRoster.members
                    .filter(m => m.item_level > 0)
                    .sort((a, b) => b.item_level - a.item_level)
                    .slice(0, 5);
                
                if (top5.length > 0) {
                    contextData = '\n\n🏆 TOP 5 ITEM LEVEL (Blizzard API):\n';
                    top5.forEach((m, i) => {
                        contextData += `${i + 1}. ${m.name} (${m.playable_class}) - GS ${m.item_level}\n`;
                    });
                    contextData += `\n📊 ${blizzardRoster.member_count} Mitglieder insgesamt`;
                } else {
                    contextData = '\n\n⚠️ Keine Item Level Daten verfügbar.';
                }
            } else {
                // Fallback zu Raider.io
                const top5 = getTopByItemLevel(members, 5);
                contextData = '\n\n🏆 TOP 5 (Raider.io):\n' + formatItemLevelList(top5, 'Top 5 nach Item Level');
            }
            toolUsed = true;
        }
        
        // 3. KLASSE NACH M+ SCORE oder ITEM LEVEL
        else if ((lowerMsg.includes('magier') || lowerMsg.includes('mage') || 
                  lowerMsg.includes('krieger') || lowerMsg.includes('warrior') ||
                  lowerMsg.includes('paladin') || lowerMsg.includes('priester') ||
                  lowerMsg.includes('schurke') || lowerMsg.includes('jäger') ||
                  lowerMsg.includes('hexenmeister') || lowerMsg.includes('druide') ||
                  lowerMsg.includes('schamane') || lowerMsg.includes('todesritter') ||
                  lowerMsg.includes('mönch') || lowerMsg.includes('dämonenjäger')) &&
                 (lowerMsg.includes('m+') || lowerMsg.includes('mythic') || lowerMsg.includes('score') ||
                  lowerMsg.includes('gs') || lowerMsg.includes('item level') || lowerMsg.includes('ilvl'))) {
            
            const classNames = ['magier', 'mage', 'krieger', 'warrior', 'paladin', 'priester', 
                               'priest', 'schurke', 'rogue', 'jäger', 'hunter', 'hexenmeister',
                               'warlock', 'druide', 'druid', 'schamane', 'shaman', 'todesritter',
                               'death knight', 'dk', 'mönch', 'monk', 'dämonenjäger', 
                               'demon hunter', 'dh', 'evoker'];
            
            let foundClass = null;
            for (const cls of classNames) {
                if (lowerMsg.includes(cls)) {
                    foundClass = cls;
                    break;
                }
            }
            
            if (foundClass) {
                // Prüfe ob nach Item Level (GS) oder M+ Score gefragt wurde
                const isItemLevel = lowerMsg.includes('gs') || lowerMsg.includes('item level') || lowerMsg.includes('ilvl');
                
                if (isItemLevel) {
                    // Sortiere nach Item Level statt M+ Score
                    const classMembers = members
                        .filter(m => {
                            const classMap = {
                                'magier': 'Mage', 'mage': 'Mage',
                                'krieger': 'Warrior', 'warrior': 'Warrior',
                                'paladin': 'Paladin',
                                'priester': 'Priest', 'priest': 'Priest',
                                'schurke': 'Rogue', 'rogue': 'Rogue',
                                'jäger': 'Hunter', 'hunter': 'Hunter',
                                'hexenmeister': 'Warlock', 'warlock': 'Warlock',
                                'druide': 'Druid', 'druid': 'Druid',
                                'schamane': 'Shaman', 'shaman': 'Shaman',
                                'todesritter': 'Death Knight', 'death knight': 'Death Knight', 'dk': 'Death Knight',
                                'mönch': 'Monk', 'monk': 'Monk',
                                'dämonenjäger': 'Demon Hunter', 'demon hunter': 'Demon Hunter', 'dh': 'Demon Hunter',
                                'evoker': 'Evoker'
                            };
                            const targetClass = classMap[foundClass.toLowerCase()];
                            return m.class.toLowerCase() === targetClass.toLowerCase();
                        })
                        .sort((a, b) => b.item_level - a.item_level)
                        .slice(0, 10);
                    
                    contextData = '\n\n' + formatItemLevelList(classMembers, `${foundClass.charAt(0).toUpperCase() + foundClass.slice(1)} nach Item Level`);
                } else {
                    const classMembers = getByClass(members, foundClass, 5);
                    contextData = '\n\n' + formatMythicPlusList(classMembers, `${foundClass.charAt(0).toUpperCase() + foundClass.slice(1)} nach M+ Score`);
                }
                toolUsed = true;
            }
        }
        
        // 4. TOP M+ SCORES (allgemein)
        else if ((lowerMsg.includes('top') || lowerMsg.includes('beste') || lowerMsg.includes('höchste')) && 
                 (lowerMsg.includes('m+') || lowerMsg.includes('mythic') || lowerMsg.includes('score') || lowerMsg.includes('rating'))) {
            
            const topMplus = getTopByMythicPlus(members, 5);
            contextData = '\n\n' + formatMythicPlusList(topMplus, 'Top 5 nach M+ Score');
            toolUsed = true;
        }
        
        // 5. ROLLEN (Tanks, Heiler, DPS)
        else if ((lowerMsg.includes('tank') || lowerMsg.includes('heiler') || lowerMsg.includes('dps') || lowerMsg.includes('dd')) &&
                 (lowerMsg.includes('wer') || lowerMsg.includes('liste') || lowerMsg.includes('alle'))) {
            
            let role = null;
            if (lowerMsg.includes('tank')) role = 'tank';
            else if (lowerMsg.includes('heiler')) role = 'healer';
            else if (lowerMsg.includes('dps') || lowerMsg.includes('dd')) role = 'dps';
            
            if (role) {
                const roleMembers = getByRole(members, role, 15);
                const roleName = role === 'tank' ? 'Tanks' : role === 'healer' ? 'Heiler' : 'DPS';
                contextData = '\n\n' + formatItemLevelList(roleMembers, `${roleName} in der Gilde`);
                toolUsed = true;
            }
        }
        
        // 6. ALLE MITGLIEDER (einfache Liste)
        else if (lowerMsg.includes('mitglieder') || lowerMsg.includes('spieler') || 
                 lowerMsg.includes('wer ist in der gilde')) {
            
            const memberList = members
                .slice(0, 20)
                .map(m => `• ${m.name} (${m.class} ${m.spec}) - GS ${m.item_level}`)
                .join('\n');
            
            contextData = `\n\nGILDENMITGLIEDER (${members.length}):\n${memberList}`;
            if (members.length > 20) {
                contextData += '\n... und weitere';
            }
            toolUsed = true;
        }
        
        // 7. M+ SAISON HINWEIS
        else if (lowerMsg.includes('m+') || lowerMsg.includes('mythic')) {
            contextData = '\n\n[HINWEIS: Neue M+ Saison startet erst Mittwoch 26.03.!]';
        }

        // 8. WARCRAFT LOGS: Boss-Taktiken
        else if (lowerMsg.includes('boss') || lowerMsg.includes('taktik') || 
                 lowerMsg.includes('besiegen') || lowerMsg.includes('killen')) {
            
            const bosses = ['sikran', 'one-armed-bandit', 'mugzee', 'chrome-king-gallywix', 
                           'vexie', 'stix', 'sprocketmonger', 'bandit', 'gallywix'];
            
            let foundBoss = null;
            for (const boss of bosses) {
                if (lowerMsg.includes(boss)) {
                    foundBoss = boss;
                    break;
                }
            }
            
            if (foundBoss) {
                console.log(`[WCL] Analysiere Boss: ${foundBoss}`);
                const bossData = await wcl.analyzeBossTactics(foundBoss);
                
                if (!bossData.error) {
                    contextData = `\n\nWARCRAFT LOGS ANALYSE - ${bossData.bossName.toUpperCase()}:\n`;
                    contextData += `• Erfolgreiche Kills: ${bossData.kills}\n`;
                    contextData += `• Durchschnittliches Item Level: ${bossData.averageItemLevel}\n`;
                    contextData += `• Durchschnittliche Kampfdauer: ${Math.floor(bossData.averageDuration / 60)}:${(bossData.averageDuration % 60).toString().padStart(2, '0')} Min\n`;
                    contextData += `\nTop DPS:\n`;
                    bossData.topDPS.forEach((dps, i) => {
                        contextData += `${i + 1}. ${dps.name} (${dps.class}) - ${dps.dps} DPS\n`;
                    });
                } else {
                    contextData = `\n\n(WCL Fehler: ${bossData.error})`;
                }
                toolUsed = true;
            }
        }
        
        // 8.5 WARCRAFT LOGS: Todesanalyse "Worauf sterbe ich?"
        else if ((lowerMsg.includes('worauf sterbe') || lowerMsg.includes('woran sind') || 
                  lowerMsg.includes('todesursache') || lowerMsg.includes('deaths')) &&
                 message.match(/[a-zA-Z0-9]{16}/)) {
            
            const codeMatch = message.match(/([a-zA-Z0-9]{16})/);
            const fightMatch = message.match(/fight=(\d+)/);
            
            if (codeMatch) {
                const reportCode = codeMatch[1];
                const fightId = fightMatch ? parseInt(fightMatch[1]) : 1;
                
                // Spielername extrahieren (optional)
                let playerName = null;
                const nameMatch = message.match(/(?:spieler|char|ich|name)\s+(\w+)/i);
                if (nameMatch) {
                    playerName = nameMatch[1];
                }
                
                console.log(`[WCL] Analysiere Todesursachen: ${reportCode}, Fight ${fightId}`);
                const deathData = await wcl.analyzeDeaths(reportCode, fightId, playerName);
                
                if (!deathData.error) {
                    if (playerName) {
                        contextData = `\n\n💀 TODESANALYSE für ${deathData.player} - ${deathData.bossName}:\n`;
                        contextData += `Anzahl Tode: ${deathData.deathCount}\n\n`;
                        
                        if (deathData.deathCount > 0) {
                            contextData += `Todesursachen:\n`;
                            deathData.deaths.forEach((d, i) => {
                                contextData += `  ${i + 1}. ${d.ability} (von: ${d.killer})\n`;
                            });
                        } else {
                            contextData += `✅ ${deathData.player} ist nicht gestorben!\n`;
                        }
                    } else {
                        contextData = `\n\n💀 TODESANALYSE - ${deathData.bossName}:\n`;
                        contextData += `Gesamte Tode: ${deathData.totalDeaths}\n\n`;
                        
                        if (deathData.topDeathCauses.length > 0) {
                            contextData += `🔴 Häufigste Todesursachen:\n`;
                            deathData.topDeathCauses.forEach((c, i) => {
                                contextData += `  ${i + 1}. ${c.ability}\n`;
                                contextData += `     Betroffen: ${c.victims.join(', ')}\n`;
                            });
                        }
                        
                        contextData += `\n💡 Tipp: Prüft eure Positionierung und defensive Cooldowns für diese Mechaniken!`;
                    }
                    
                    contextData += `\n\n🔗 Link: https://www.warcraftlogs.com/reports/${reportCode}#fight=${fightId}`;
                } else {
                    contextData = `\n\n(WCL Fehler: ${deathData.error})`;
                }
                toolUsed = true;
            }
        }

        // 8.6 WARCRAFT LOGS: Wipe-Analyse (Report-Code + Fight)
        else if (message.match(/[a-zA-Z0-9]{16}\?fight=\d+/) || 
                 (message.match(/[a-zA-Z0-9]{16}/) && lowerMsg.includes('wipe'))) {
            const codeMatch = message.match(/([a-zA-Z0-9]{16})/);
            const fightMatch = message.match(/fight=(\d+)/);
            
            if (codeMatch) {
                const reportCode = codeMatch[1];
                const fightId = fightMatch ? parseInt(fightMatch[1]) : 1;
                
                console.log(`[WCL] Analysiere Wipe: ${reportCode}, Fight ${fightId}`);
                const wipeData = await wcl.analyzeWipe(reportCode, fightId);
                
                if (!wipeData.error) {
                    contextData = `\n\n📊 WIPE-ANALYSE - ${wipeData.bossName} (${wipeData.difficulty}):\n`;
                    contextData += `⏱️ Dauer: ${Math.floor(wipeData.duration / 60)}:${(wipeData.duration % 60).toString().padStart(2, '0')} Min\n`;
                    contextData += `💀 Tode: ${wipeData.deaths.count}\n\n`;
                    
                    if (wipeData.deaths.firstDeaths.length > 0) {
                        contextData += `🔴 Erste Tode:\n`;
                        wipeData.deaths.firstDeaths.forEach((d, i) => {
                            contextData += `  ${i + 1}. ${d.name}\n`;
                        });
                        contextData += `\n`;
                    }
                    
                    contextData += `⚔️ Top DPS:\n`;
                    wipeData.dps.top.slice(0, 3).forEach((d, i) => {
                        contextData += `  ${i + 1}. ${d.name} - ${d.dps.toLocaleString()} DPS\n`;
                    });
                    
                    if (wipeData.dps.bottom.length > 0 && wipeData.dps.bottom[0].dps < 100000) {
                        contextData += `\n⚠️ Niedrige DPS:\n`;
                        wipeData.dps.bottom.forEach(d => {
                            contextData += `  • ${d.name} - ${d.dps.toLocaleString()} DPS\n`;
                        });
                    }
                    
                    contextData += `\n💚 Top Heiler:\n`;
                    wipeData.heal.top.slice(0, 2).forEach((h, i) => {
                        contextData += `  ${i + 1}. ${h.name} - ${h.hps.toLocaleString()} HPS\n`;
                    });
                    
                    contextData += `\n🔗 Link: https://www.warcraftlogs.com/reports/${reportCode}#fight=${fightId}`;
                } else {
                    contextData = `\n\n(WCL Fehler: ${wipeData.error})`;
                }
                toolUsed = true;
            }
        }

        // 9. WARCRAFT LOGS: Letzter Raid / Neuster Report
        else if ((lowerMsg.includes('letzte') || lowerMsg.includes('letzter') || lowerMsg.includes('letzten') ||
                 lowerMsg.includes('neuester') || lowerMsg.includes('neueste') || lowerMsg.includes('neuesten') ||
                 lowerMsg.includes('aktueller') || lowerMsg.includes('aktuelle') ||
                 lowerMsg.includes('naechster') || lowerMsg.includes('naechste')) &&
                 (lowerMsg.includes('raid') || lowerMsg.includes('report') || lowerMsg.includes('log'))) {
            
            contextData = '\n\n📅 LETZTER RAID:\n';
            contextData += 'Hier siehst du alle aktuellen Raids:\n';
            contextData += 'https://www.warcraftlogs.com/guild/calendar/802185\n\n';
            contextData += '📊 Der neueste Raid ist ganz oben in der Liste.\n';
            contextData += '💡 Tipp: Kopiere den Report-Code (16 Zeichen) und gib ihn mir, dann erstelle ich einen Direktlink!';
            toolUsed = true;
        }

        // 10. WARCRAFT LOGS: Gilde-Performance (allgemein)
        else if (lowerMsg.includes('logs') || lowerMsg.includes('report') || 
                 lowerMsg.includes('letzte kills') || lowerMsg.includes('raid-fortschritt')) {
            
            contextData = '\n\n📊 WARCRAFT LOGS:\nSchau dir alle Raid-Logs hier an:\nhttps://www.warcraftlogs.com/guild/calendar/802185\n\n💡 Tipp: Frag mich nach Boss-Taktiken (z.B. "Wie besiegt man Sikran?") für detaillierte Analysen!';
            toolUsed = true;
        }

        // 11. GOOGLE SHEETS: Spitznamen & Gilden-Wissen
        // Wenn nach einem Spieler mit Spitzname gefragt wird
        const sheetData = await sheets.formatGuildContext(GOOGLE_SHEET_ID);
        if (sheetData && !sheetData.error) {
            // Prüfe ob nach einem bestimmten Spieler gefragt wurde
            const allMembers = await sheets.getSheetData(GOOGLE_SHEET_ID, 'Mitglieder');
            if (!allMembers.error) {
                for (const member of allMembers) {
                    if (member.Name && lowerMsg.includes(member.Name.toLowerCase())) {
                        contextData += `\n\n👤 ${member.Name}:\n`;
                        if (member.Spitzname) contextData += `Spitzname: "${member.Spitzname}"\n`;
                        if (member.Rolle) contextData += `Rolle: ${member.Rolle}\n`;
                        if (member.Notiz) contextData += `Info: ${member.Notiz}\n`;
                        toolUsed = true;
                        break;
                    }
                }
            }
            
            // Füge generelles Gilden-Wissen hinzu (bei relevanten Fragen)
            if (lowerMsg.includes('spitzname') || lowerMsg.includes('regel') || 
                lowerMsg.includes('wer ist') || lowerMsg.includes('was ist') ||
                lowerMsg.includes('aktuell') || lowerMsg.includes('neu')) {
                contextData += sheetData;
                toolUsed = true;
            }
        }

        // OpenAI Call
        const aiResponse = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: WOW_SYSTEM_PROMPT + contextData },
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 800
            })
        });

        const aiData = await aiResponse.json();
        
        if (aiData.choices && aiData.choices[0]) {
            return res.json({
                success: true,
                reply: aiData.choices[0].message.content,
                data_source: toolUsed ? 'api' : 'openai',
                debug: { members_count: members.length, context_used: toolUsed }
            });
        }

        res.json({ success: false, error: 'Keine Antwort' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health Check
app.get('/', (req, res) => {
    res.send('Vox Draconis Bot läuft! v3.5 (Warcraft Logs + Raider.io)');
});

// Debug: WCL Status
app.get('/debug/wcl', async (req, res) => {
    const wcl = require('./warcraftlogs');
    const reports = await wcl.getGuildReports(3);
    res.json({
        wcl_client_id_set: !!process.env.WCL_CLIENT_ID,
        wcl_client_secret_set: !!process.env.WCL_CLIENT_SECRET,
        reports: reports
    });
});

// Debug: Fight Analysis
app.get('/debug/fight/:code/:fightId', async (req, res) => {
    const wcl = require('./warcraftlogs');
    const analysis = await wcl.analyzeWipe(req.params.code, parseInt(req.params.fightId));
    res.json(analysis);
});

// Debug: Blizzard Guild Roster
app.get('/debug/blizzard/roster', async (req, res) => {
    const roster = await blizzard.getGuildRoster();
    res.json({
        blizzard_client_id_set: !!process.env.BLIZZARD_CLIENT_ID,
        blizzard_client_secret_set: !!process.env.BLIZZARD_CLIENT_SECRET,
        roster: roster
    });
});

// Debug: Blizzard Character
app.get('/debug/blizzard/char/:name', async (req, res) => {
    const profile = await blizzard.getCharacterProfile(req.params.name);
    res.json(profile);
});

// Debug: Google Sheets - Mitglieder
app.get('/debug/sheets/members', async (req, res) => {
    const data = await sheets.getSheetData(GOOGLE_SHEET_ID, 'Mitglieder');
    res.json({
        sheet_id_set: !!GOOGLE_SHEET_ID,
        data: data
    });
});

// Debug: Google Sheets - Gilden-Wissen
app.get('/debug/sheets/knowledge', async (req, res) => {
    const data = await sheets.getGuildKnowledge(GOOGLE_SHEET_ID);
    res.json({
        sheet_id_set: !!GOOGLE_SHEET_ID,
        data: data
    });
});

// Export für Vercel
module.exports = app;

// Lokale Entwicklung
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server auf Port ${PORT}`);
    });
}
