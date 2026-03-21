/**
 * Warcraft Logs API Integration
 * OAuth2 + GraphQL API
 */

const fetch = require('node-fetch');

const WCL_API_URL = 'https://www.warcraftlogs.com/api/v2/client';
const WCL_OAUTH_URL = 'https://www.warcraftlogs.com/oauth/token';

const WCL_CLIENT_ID = process.env.WCL_CLIENT_ID;
const WCL_CLIENT_SECRET = process.env.WCL_CLIENT_SECRET;

// Cache
let wclToken = null;
let wclTokenExpiry = null;

/**
 * Holt OAuth2 Token für Warcraft Logs
 */
async function getWCLToken() {
    if (wclToken && wclTokenExpiry && Date.now() < wclTokenExpiry) {
        return wclToken;
    }

    try {
        const response = await fetch(WCL_OAUTH_URL, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${WCL_CLIENT_ID}:${WCL_CLIENT_SECRET}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            throw new Error(`OAuth failed: ${response.status}`);
        }

        const data = await response.json();
        wclToken = data.access_token;
        wclTokenExpiry = Date.now() + (data.expires_in * 1000);
        
        console.log('[WCL] Token erhalten, gültig bis:', new Date(wclTokenExpiry).toISOString());
        return wclToken;
    } catch (error) {
        console.error('[WCL] Auth Error:', error);
        return null;
    }
}

/**
 * GraphQL Query ausführen
 */
async function wclQuery(query, variables = {}) {
    const token = await getWCLToken();
    if (!token) {
        return { error: 'WCL Authentifizierung fehlgeschlagen' };
    }

    try {
        const response = await fetch(WCL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
            return { error: `WCL API Error: ${response.status}` };
        }

        const data = await response.json();
        
        if (data.errors) {
            console.error('[WCL] GraphQL Errors:', data.errors);
            return { error: data.errors[0].message };
        }

        return data.data;
    } catch (error) {
        console.error('[WCL] Query Error:', error);
        return { error: error.message };
    }
}

/**
 * Boss-Rankings für eine Zone abrufen
 */
async function getBossRankings(zoneId, bossName = null, metric = 'dps') {
    const query = `
    query($zoneId: Int!, $guildName: String!, $serverName: String!, $serverRegion: String!) {
        worldData {
            zone(id: $zoneId) {
                name
                encounters {
                    id
                    name
                }
            }
        }
        guildData {
            guild(name: $guildName, serverSlug: $serverName, serverRegion: $serverRegion) {
                name
                rankings(encounterID: ${bossName ? '$encounterId' : 'null'}, metric: ${metric.toUpperCase()}) {
                    data {
                        encounter {
                            name
                        }
                        rank
                        score
                        spec
                        class
                        itemLevel
                        duration
                        report {
                            code
                            startTime
                        }
                    }
                }
            }
        }
    }`;

    const variables = {
        zoneId: zoneId,
        guildName: "Vox Draconis",
        serverName: "Alexstrasza",
        serverRegion: "EU"
    };

    return await wclQuery(query, variables);
}

/**
 * Letzte Reports der Gilde abrufen
 */
async function getGuildReports(limit = 10) {
    const query = `
    query($guildName: String!, $serverName: String!, $serverRegion: String!) {
        guildData {
            guild(name: $guildName, serverSlug: $serverName, serverRegion: $serverRegion) {
                name
                reports(limit: ${limit}) {
                    data {
                        code
                        title
                        owner {
                            name
                        }
                        startTime
                        zone {
                            name
                        }
                        fights(difficulty: 5) {
                            name
                            kill
                            difficulty
                            encounterID
                        }
                    }
                }
            }
        }
    }`;

    const variables = {
        guildName: "Vox Draconis",
        serverName: "Alexstrasza",
        serverRegion: "EU"
    };

    return await wclQuery(query, variables);
}

/**
 * Detaillierte Fight-Analysis
 */
async function getFightAnalysis(reportCode, fightId) {
    const query = `
    query($code: String!) {
        reportData {
            report(code: $code) {
                fights {
                    id
                    name
                    difficulty
                    kill
                    startTime
                    endTime
                }
                table(fightIDs: [${fightId}], dataType: Summary)
                damageDone: table(fightIDs: [${fightId}], dataType: DamageDone)
                healingDone: table(fightIDs: [${fightId}], dataType: HealingDone)
                deaths: events(fightIDs: [${fightId}], dataType: Deaths, limit: 20) {
                    data
                }
            }
        }
    }`;

    return await wclQuery(query, { code: reportCode });
}

/**
 * Zone-IDs für aktuelle Raids
 */
const ZONES = {
    'liberation-of-undermine': 38,
    'nerubar-palace': 35,
    'amirdrassil': 33
};

/**
 * Boss-Name zu Encounter ID Mapping
 */
const BOSSES = {
    'sikran': 2899,
    'one-armed-bandit': 2901,
    'mugzee': 3013,
    'chrome-king-gallywix': 3014
    // Weitere Bosse können ergänzt werden
};

/**
 * Boss-Taktik aus Logs ableiten
 */
async function analyzeBossTactics(bossName) {
    const bossId = BOSSES[bossName.toLowerCase()];
    if (!bossId) {
        return { error: `Boss "${bossName}" nicht gefunden` };
    }

    // Rankings abrufen
    const rankingsData = await getBossRankings(ZONES['liberation-of-undermine'], bossId, 'dps');
    
    if (rankingsData.error) {
        return rankingsData;
    }

    const guildData = rankingsData?.guildData?.guild;
    if (!guildData || !guildData.rankings?.data?.length) {
        return { error: `Keine Logs für ${bossName} gefunden` };
    }

    const rankings = guildData.rankings.data;
    
    // Statistiken berechnen
    const avgItemLevel = rankings.reduce((sum, r) => sum + (r.itemLevel || 0), 0) / rankings.length;
    const avgDuration = rankings.reduce((sum, r) => sum + (r.duration || 0), 0) / rankings.length;
    
    // Klassen-Verteilung
    const classDistribution = {};
    rankings.forEach(r => {
        classDistribution[r.class] = (classDistribution[r.class] || 0) + 1;
    });

    // Top DPS
    const topDPS = rankings
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(r => ({
            name: r.spec,
            class: r.class,
            dps: Math.round(r.score),
            itemLevel: r.itemLevel
        }));

    return {
        bossName: bossName,
        kills: rankings.length,
        averageItemLevel: Math.round(avgItemLevel),
        averageDuration: Math.round(avgDuration / 1000), // in Sekunden
        classDistribution: classDistribution,
        topDPS: topDPS,
        bestKill: rankings.find(r => r.rank === 1)
    };
}

/**
 * Gilde-Performance Übersicht
 */
async function getGuildPerformance() {
    const reports = await getGuildReports(5);
    
    if (reports.error) {
        return reports;
    }

    const reportData = reports?.reportData?.reports?.data;
    if (!reportData || !reportData.length) {
        return { error: 'Keine Reports gefunden' };
    }

    const recentKills = [];
    
    for (const report of reportData) {
        if (report.fights) {
            for (const fight of report.fights) {
                if (fight.kill) {
                    recentKills.push({
                        boss: fight.name,
                        difficulty: fight.difficulty === 5 ? 'Heroic' : 'Normal',
                        date: new Date(report.startTime).toLocaleDateString('de-DE'),
                        reportCode: report.code
                    });
                }
            }
        }
    }

    return {
        recentReports: reportData.map(r => ({
            title: r.title,
            date: new Date(r.startTime).toLocaleDateString('de-DE'),
            zone: r.zone?.name
        })),
        recentKills: recentKills.slice(0, 10)
    };
}

/**
 * Wipe-Analyse für einen spezifischen Fight
 */
async function analyzeWipe(reportCode, fightId) {
    const analysis = await getFightAnalysis(reportCode, fightId);
    
    if (analysis.error) {
        return analysis;
    }
    
    const report = analysis?.reportData?.report;
    if (!report) {
        return { error: 'Report nicht gefunden' };
    }
    
    // Finde den richtigen Fight anhand der ID
    const fight = report.fights?.find(f => f.id === fightId);
    if (!fight) {
        return { error: `Fight ${fightId} nicht gefunden` };
    }
    
    // Daten extrahieren
    const deaths = report.deaths?.data || [];
    const damageTable = report.damageDone?.data?.entries || [];
    const healTable = report.healingDone?.data?.entries || [];
    
    // Dauer berechnen (endTime - startTime)
    const duration = fight.endTime && fight.startTime ? 
        Math.floor((fight.endTime - fight.startTime) / 1000) : 0;
    
    // Analyse erstellen
    const result = {
        bossName: fight.name,
        difficulty: fight.difficulty === 5 ? 'Heroic' : fight.difficulty === 4 ? 'Normal' : 'Mythic',
        duration: duration, // in Sekunden
        isKill: fight.kill,
        deaths: {
            count: deaths.length,
            firstDeaths: deaths.slice(0, 5).map(d => ({
                name: d.target?.name || 'Unbekannt',
                time: d.timestamp,
                ability: d.ability?.name || 'Unbekannt'
            }))
        },
        dps: {
            top: damageTable.slice(0, 5).map(d => ({
                name: d.name,
                class: d.type,
                dps: Math.round(d.total / (fight.duration / 1000))
            })),
            bottom: damageTable.slice(-3).map(d => ({
                name: d.name,
                class: d.type,
                dps: Math.round(d.total / (fight.duration / 1000))
            }))
        },
        heal: {
            top: healTable.slice(0, 3).map(h => ({
                name: h.name,
                class: h.type,
                hps: Math.round(h.total / (fight.duration / 1000))
            }))
        }
    };
    
    return result;
}

module.exports = {
    getBossRankings,
    getGuildReports,
    getFightAnalysis,
    analyzeBossTactics,
    getGuildPerformance,
    analyzeWipe,
    ZONES,
    BOSSES
};
