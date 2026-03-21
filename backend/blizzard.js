/**
 * Blizzard API Integration
 * OAuth2 + REST API
 */

const fetch = require('node-fetch');

const BLIZZARD_API_URL = 'https://eu.api.blizzard.com';
const BLIZZARD_OAUTH_URL = 'https://oauth.battle.net/token';

const CLIENT_ID = process.env.BLIZZARD_CLIENT_ID;
const CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET;

// Cache
let blizzardToken = null;
let blizzardTokenExpiry = null;
let rosterCache = null;
let rosterCacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 Minuten

/**
 * Holt OAuth2 Token für Blizzard API
 */
async function getBlizzardToken() {
    if (blizzardToken && blizzardTokenExpiry && Date.now() < blizzardTokenExpiry) {
        return blizzardToken;
    }

    try {
        const response = await fetch(BLIZZARD_OAUTH_URL, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            throw new Error(`OAuth failed: ${response.status}`);
        }

        const data = await response.json();
        blizzardToken = data.access_token;
        blizzardTokenExpiry = Date.now() + (data.expires_in * 1000);
        
        console.log('[Blizzard] Token erhalten');
        return blizzardToken;
    } catch (error) {
        console.error('[Blizzard] Auth Error:', error);
        return null;
    }
}

/**
 * Holt das Gilden-Roster (ALLE Mitglieder)
 */
async function getGuildRoster(realm = 'alexstrasza', guild = 'Vox%20Draconis') {
    // Cache prüfen
    if (rosterCache && rosterCacheTime && (Date.now() - rosterCacheTime < CACHE_DURATION)) {
        console.log('[Blizzard] Verwende cached Roster');
        return rosterCache;
    }

    const token = await getBlizzardToken();
    if (!token) {
        return { error: 'Blizzard Auth fehlgeschlagen' };
    }

    try {
        // URL kodiert: Leerzeichen = %20
        const encodedGuild = encodeURIComponent(guild);
        const url = `${BLIZZARD_API_URL}/data/wow/guild/${realm}/${encodedGuild}/roster`;
        
        console.log('[Blizzard] Rufe Gilden-Roster ab...');
        console.log('[Blizzard] URL:', url);
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Battlenet-Namespace': 'profile-eu'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { error: 'Gilde nicht gefunden' };
            }
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Daten aufbereiten
        const members = data.members.map(m => {
            const char = m.character;
            return {
                name: char.name,
                level: char.level,
                playable_class: char.playable_class?.name || 'Unbekannt',
                playable_spec: char.playable_spec?.name || 'Unbekannt',
                item_level: char.average_item_level || char.equipped_item_level || 0,
                rank: m.rank,
                realm: char.realm?.name || realm
            };
        }).filter(m => m.level >= 80); // Nur Level 80 Charaktere

        const result = {
            guild: data.guild?.name || guild,
            member_count: members.length,
            members: members.sort((a, b) => b.item_level - a.item_level)
        };

        // Cache speichern
        rosterCache = result;
        rosterCacheTime = Date.now();

        console.log(`[Blizzard] ${members.length} Mitglieder geladen`);
        return result;

    } catch (error) {
        console.error('[Blizzard] API Error:', error);
        return { error: error.message };
    }
}

/**
 * Holt detaillierte Charakter-Informationen
 */
async function getCharacterProfile(name, realm = 'alexstrasza') {
    const token = await getBlizzardToken();
    if (!token) {
        return { error: 'Blizzard Auth fehlgeschlagen' };
    }

    try {
        const encodedName = encodeURIComponent(name.toLowerCase());
        const url = `${BLIZZARD_API_URL}/profile/wow/character/${realm}/${encodedName}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Battlenet-Namespace': 'profile-eu'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { error: 'Charakter nicht gefunden' };
            }
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        
        return {
            name: data.name,
            level: data.level,
            class: data.character_class?.name,
            spec: data.active_spec?.name,
            item_level: data.average_item_level,
            equipped_item_level: data.equipped_item_level,
            achievement_points: data.achievement_points,
            last_login: data.last_login_timestamp
        };

    } catch (error) {
        console.error('[Blizzard] Profile Error:', error);
        return { error: error.message };
    }
}

module.exports = {
    getGuildRoster,
    getCharacterProfile,
    getBlizzardToken
};
