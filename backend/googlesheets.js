/**
 * Google Sheets Integration
 * Liest Gilden-Infos live aus einer Google-Tabelle
 */

const fetch = require('node-fetch');

// Cache für Sheet-Daten
let sheetCache = null;
let sheetCacheTime = null;
const CACHE_DURATION = 2 * 60 * 1000; // 2 Minuten Cache (schnelle Updates!)

/**
 * Holt Daten aus einem öffentlichen Google Sheet
 * Format: CSV Export
 */
async function getSheetData(sheetId, sheetName = 'Sheet1') {
    const cacheKey = `${sheetId}_${sheetName}`;
    
    // Cache prüfen
    if (sheetCache && sheetCacheTime && (Date.now() - sheetCacheTime < CACHE_DURATION)) {
        console.log('[GoogleSheets] Verwende Cache');
        return sheetCache;
    }

    try {
        // Google Sheets CSV Export URL
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
        
        console.log('[GoogleSheets] Lade Daten...');
        const response = await fetch(url, { timeout: 5000 });
        
        if (!response.ok) {
            throw new Error(`Sheet nicht erreichbar: ${response.status}`);
        }

        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        // Cache speichern
        sheetCache = data;
        sheetCacheTime = Date.now();
        
        console.log(`[GoogleSheets] ${data.length} Zeilen geladen`);
        return data;

    } catch (error) {
        console.error('[GoogleSheets] Fehler:', error.message);
        return { error: error.message };
    }
}

/**
 * Einfacher CSV Parser
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Header extrahieren
    const headers = parseCSVLine(lines[0]);
    
    // Daten parsen
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        data.push(row);
    }
    
    return data;
}

/**
 * Parst eine CSV-Zeile (berücksichtigt Anführungszeichen)
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * Sucht einen Spieler nach Namen (inkl. Spitznamen)
 */
async function findPlayer(sheetId, searchName) {
    const data = await getSheetData(sheetId, 'Mitglieder');
    if (data.error) return data;
    
    const search = searchName.toLowerCase();
    
    // Suche in Name UND Spitzname
    const player = data.find(row => {
        const nameMatch = row.Name && row.Name.toLowerCase() === search;
        const nickMatch = row.Spitzname && row.Spitzname.toLowerCase() === search;
        return nameMatch || nickMatch;
    });
    
    return player || null;
}

/**
 * Holt alle Spitznamen
 */
async function getNicknames(sheetId) {
    const data = await getSheetData(sheetId, 'Mitglieder');
    if (data.error) return data;
    
    return data
        .filter(row => row.Spitzname && row.Spitzname.trim() !== '')
        .map(row => ({
            name: row.Name,
            nickname: row.Spitzname,
            role: row.Rolle
        }));
}

/**
 * Holt aktuelle Gilden-Infos (Regeln, Inside Jokes, etc.)
 */
async function getGuildKnowledge(sheetId) {
    const data = await getSheetData(sheetId, 'Gilden-Wissen');
    if (data.error) return data;
    
    // Sortiere nach Datum (neueste zuerst)
    return data.sort((a, b) => {
        const dateA = parseDate(a.Datum);
        const dateB = parseDate(b.Datum);
        return dateB - dateA;
    });
}

/**
 * Parst deutsches Datumsformat (DD.MM.YYYY)
 */
function parseDate(dateStr) {
    if (!dateStr || dateStr === 'permanent') return new Date('2099-12-31');
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    return new Date(dateStr);
}

/**
 * Formatiert Gilden-Wissen für den Bot
 */
async function formatGuildContext(sheetId) {
    const knowledge = await getGuildKnowledge(sheetId);
    if (knowledge.error) return '';
    
    let context = '\n\n📋 AKTUELLE GILDEN-INFORMATIONEN:\n';
    
    knowledge.forEach(item => {
        if (item.Kategorie && item.Info) {
            context += `• ${item.Kategorie}: ${item.Info}`;
            if (item.Datum && item.Datum !== 'permanent') {
                context += ` (${item.Datum})`;
            }
            context += '\n';
        }
    });
    
    // Spitznamen hinzufügen
    const nicknames = await getNicknames(sheetId);
    if (nicknames.length > 0) {
        context += '\n🏷️ SPITZNAMEN:\n';
        nicknames.slice(0, 10).forEach(n => {
            context += `• ${n.name} = "${n.nickname}"`;
            if (n.role) context += ` (${n.role})`;
            context += '\n';
        });
    }
    
    return context;
}

module.exports = {
    getSheetData,
    findPlayer,
    getNicknames,
    getGuildKnowledge,
    formatGuildContext
};
