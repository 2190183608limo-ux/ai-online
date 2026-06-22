// knowledge.js - Knowledge base with safer matching and English metadata
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ensureDir } = require('./utils');

const LOCAL_KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
const GOOGLE_DRIVE_KB_DIR = process.env.GOOGLE_DRIVE_KB_DIR;
const DEFAULT_THRESHOLD = Number(process.env.KB_THRESHOLD || 0.65);
const MIN_ANSWER_LENGTH = Number(process.env.KB_MIN_ANSWER_LENGTH || 40);
const DEFAULT_STALE_DAYS = Number(process.env.KB_STALE_DAYS || 45);

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'for', 'to', 'of',
  'in', 'on', 'at', 'by', 'with', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'do', 'does', 'did', 'can', 'could', 'should', 'would', 'how',
  'what', 'why', 'when', 'where', 'please', 'help', 'me', 'my', 'your', 'you'
]);

function autoDetectGoogleDrive() {
  if (GOOGLE_DRIVE_KB_DIR) {
    const resolved = path.resolve(GOOGLE_DRIVE_KB_DIR);
    try { ensureDir(resolved); return resolved; } catch (_) {}
  }

  const homeDir = require('os').homedir();
  const candidates = [
    path.join(homeDir, 'Google 云端硬盘'),
    path.join(homeDir, 'Google Drive'),
    path.join(homeDir, '我的云端硬盘'),
    'G:\\My Drive',
    'G:\\',
    'D:\\Google Drive',
    'D:\\My Drive',
  ];
  for (const letter of ['G', 'H', 'D', 'E', 'F']) {
    candidates.push(letter + ':\\My Drive');
    candidates.push(letter + ':\\Google Drive');
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    } catch (_) {}
  }
  return null;
}

function resolveKnowledgeDir() {
  const gdrivePath = autoDetectGoogleDrive();
  if (gdrivePath) {
    const kbDir = path.join(gdrivePath, 'ai-compare-data', 'knowledge');
    try {
      ensureDir(kbDir);
      console.log(`☁️ Knowledge directory (Google Drive): ${kbDir}`);
      return kbDir;
    } catch (error) {
      console.error(`Google Drive knowledge dir unavailable: ${error.message}`);
    }
  }

  ensureDir(LOCAL_KNOWLEDGE_DIR);
  console.log(`🏠 Knowledge directory (local): ${LOCAL_KNOWLEDGE_DIR}`);
  return LOCAL_KNOWLEDGE_DIR;
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

class KnowledgeBase {
  constructor() {
    this.knowledgeDir = resolveKnowledgeDir();
    this.platforms = {};
    this.cache = new Map();
    this.cacheMaxAge = Number(process.env.KB_CACHE_MAX_AGE_MS || 5 * 60 * 1000);
  }

  _getCacheKey(platformId, question) {
    return `${platformId}:${this.normalizeQuestion(question)}`;
  }

  _getFromCache(key) {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.cacheMaxAge) return entry.data;
    this.cache.delete(key);
    return null;
  }

  _setCache(key, data) {
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(platformId = null) {
    if (!platformId) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${platformId}:`)) this.cache.delete(key);
    }
  }

  getStorageInfo() {
    return {
      path: this.knowledgeDir,
      usingGoogleDrive: this.knowledgeDir.includes('Google') || this.knowledgeDir.includes('云端硬盘') || this.knowledgeDir.includes('My Drive') || (!!GOOGLE_DRIVE_KB_DIR && path.resolve(GOOGLE_DRIVE_KB_DIR) === this.knowledgeDir),
      autoDetected: !GOOGLE_DRIVE_KB_DIR
    };
  }

  getFilePath(platformId) {
    const safePlatformId = String(platformId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.knowledgeDir, `${safePlatformId}.json`);
  }

  loadPlatform(platformId) {
    if (this.platforms[platformId]?._loaded) return this.platforms[platformId];

    const filePath = this.getFilePath(platformId);
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.platforms[platformId] = {
          entries: Array.isArray(parsed.entries) ? parsed.entries : [],
          lastUpdated: parsed.lastUpdated || null,
          _loaded: true
        };
      } else {
        this.platforms[platformId] = { entries: [], lastUpdated: null, _loaded: true };
      }
    } catch (error) {
      console.error(`Failed to load knowledge base for ${platformId}:`, error.message);
      this.platforms[platformId] = { entries: [], lastUpdated: null, _loaded: true };
    }

    return this.platforms[platformId];
  }

  savePlatform(platformId) {
    const filePath = this.getFilePath(platformId);
    const tempFile = `${filePath}.tmp`;
    const data = this.platforms[platformId];
    if (!data) return false;

    data.lastUpdated = new Date().toISOString();

    try {
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempFile, filePath);
      this.clearCache(platformId);
      return true;
    } catch (error) {
      console.error(`Failed to save knowledge base for ${platformId}:`, error.message);
      return false;
    }
  }

  normalizeQuestion(text) {
    return String(text || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' URL ')
      .replace(/[`*_~#>\[\](){}]/g, ' ')
      .replace(/[，。！？、；：“”‘’（）【】《》]/g, ' ')
      .replace(/[^\p{L}\p{N}_\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _tokenize(text) {
    const normalized = this.normalizeQuestion(text);
    const tokens = [];

    const latin = normalized.match(/[a-z0-9_][a-z0-9_-]*/g) || [];
    for (const token of latin) {
      if (token.length > 1 && !STOPWORDS.has(token)) tokens.push(token);
    }

    const cjk = normalized.match(/[\p{Script=Han}]/gu) || [];
    if (cjk.length > 0) {
      for (let i = 0; i < cjk.length - 1; i += 1) tokens.push(cjk[i] + cjk[i + 1]);
      if (cjk.length === 1) tokens.push(cjk[0]);
    }

    return tokens;
  }

  _termFrequency(tokens) {
    const map = new Map();
    for (const token of tokens) map.set(token, (map.get(token) || 0) + 1);
    return map;
  }

  _cosine(tokens1, tokens2) {
    const tf1 = this._termFrequency(tokens1);
    const tf2 = this._termFrequency(tokens2);
    let dot = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const value of tf1.values()) norm1 += value * value;
    for (const value of tf2.values()) norm2 += value * value;
    for (const [token, value] of tf1) {
      if (tf2.has(token)) dot += value * tf2.get(token);
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  calculateSimilarity(text1, text2) {
    const n1 = this.normalizeQuestion(text1);
    const n2 = this.normalizeQuestion(text2);
    if (!n1 || !n2) return 0;
    if (n1 === n2) return 1;

    const tokens1 = this._tokenize(n1);
    const tokens2 = this._tokenize(n2);
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(w => set2.has(w)));
    const union = new Set([...set1, ...set2]);
    const jaccard = intersection.size / union.size;
    const cosine = this._cosine(tokens1, tokens2);

    const containment = Math.max(
      intersection.size / Math.max(1, set1.size),
      intersection.size / Math.max(1, set2.size)
    );

    const lenDiff = Math.abs(n1.length - n2.length) / Math.max(n1.length, n2.length);
    const lengthPenalty = lenDiff > 0.65 ? 0.12 : 0;

    return Math.min(1, Math.max(0, jaccard * 0.45 + cosine * 0.40 + containment * 0.15 - lengthPenalty));
  }

  _isStale(entry) {
    const staleDays = Number(entry.staleAfterDays || DEFAULT_STALE_DAYS);
    const updatedAt = new Date(entry.updatedAt || entry.createdAt || 0).getTime();
    if (!updatedAt) return true;
    return Date.now() - updatedAt > staleDays * 24 * 60 * 60 * 1000;
  }

  _isUsable(entry, similarity, threshold) {
    if (!entry || typeof entry.answer !== 'string') return false;
    if (entry.answer.trim().length < MIN_ANSWER_LENGTH) return false;
    if (this._isStale(entry) && similarity < 0.93) return false;
    return similarity >= threshold;
  }

  addEntry(platformId, question, answer, tags = [], meta = {}) {
    const kb = this.loadPlatform(platformId);
    const normalizedQuestion = this.normalizeQuestion(question);
    const rawQuestion = String(question || '').trim();
    const existing = kb.entries.find(entry =>
      entry.questionHash === sha256(normalizedQuestion) || this.normalizeQuestion(entry.question) === normalizedQuestion
    );

    const now = new Date().toISOString();
    if (existing) {
      existing.question = rawQuestion;
      existing.normalizedQuestion = normalizedQuestion;
      existing.questionHash = sha256(normalizedQuestion);
      existing.answer = String(answer || '').trim();
      existing.tags = tags;
      existing.qualityScore = Number(meta.qualityScore || existing.qualityScore || 0.75);
      existing.staleAfterDays = Number(meta.staleAfterDays || existing.staleAfterDays || DEFAULT_STALE_DAYS);
      existing.updatedAt = now;
      this.savePlatform(platformId);
      return existing;
    }

    const maxId = kb.entries.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0);
    const entry = {
      id: maxId + 1,
      question: rawQuestion,
      normalizedQuestion,
      questionHash: sha256(normalizedQuestion),
      answer: String(answer || '').trim(),
      tags,
      askCount: 1,
      qualityScore: Number(meta.qualityScore || 0.75),
      staleAfterDays: Number(meta.staleAfterDays || DEFAULT_STALE_DAYS),
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now
    };

    kb.entries.push(entry);
    this.savePlatform(platformId);
    return entry;
  }

  search(platformId, question, threshold = DEFAULT_THRESHOLD) {
    const effectiveThreshold = Math.max(Number(threshold) || DEFAULT_THRESHOLD, DEFAULT_THRESHOLD);
    const cacheKey = this._getCacheKey(platformId, question);
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    const kb = this.loadPlatform(platformId);
    if (kb.entries.length === 0) {
      return { found: false, usable: false, entries: [], storage: this.getStorageInfo() };
    }

    const results = [];
    for (const entry of kb.entries) {
      const similarity = this.calculateSimilarity(question, entry.normalizedQuestion || entry.question);
      if (similarity >= Math.max(0.35, effectiveThreshold - 0.25)) {
        const stale = this._isStale(entry);
        results.push({
          ...entry,
          similarity,
          stale,
          usable: this._isUsable(entry, similarity, effectiveThreshold)
        });
      }
    }

    results.sort((a, b) => {
      if (a.usable !== b.usable) return a.usable ? -1 : 1;
      return b.similarity - a.similarity;
    });

    const bestMatch = results[0] || null;
    const searchResult = {
      found: !!bestMatch,
      usable: !!bestMatch?.usable,
      threshold: effectiveThreshold,
      entries: results.slice(0, 5),
      bestMatch,
      storage: this.getStorageInfo()
    };

    this._setCache(cacheKey, searchResult);
    return searchResult;
  }

  searchAll(question, threshold = DEFAULT_THRESHOLD) {
    const allResults = {};
    const files = fs.existsSync(this.knowledgeDir)
      ? fs.readdirSync(this.knowledgeDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
      : [];

    for (const platformId of files) {
      const result = this.search(platformId, question, threshold);
      if (result.found) allResults[platformId] = result;
    }

    return allResults;
  }

  incrementAskCount(platformId, entryId) {
    const kb = this.loadPlatform(platformId);
    const entry = kb.entries.find(e => Number(e.id) === Number(entryId));
    if (entry) {
      entry.askCount = (Number(entry.askCount) || 0) + 1;
      entry.lastAccessedAt = new Date().toISOString();
      this.savePlatform(platformId);
    }
  }

  getStats(platformId) {
    const kb = this.loadPlatform(platformId);
    return {
      platform: platformId,
      totalEntries: kb.entries.length,
      lastUpdated: kb.lastUpdated,
      storage: this.getStorageInfo(),
      topEntries: [...kb.entries]
        .sort((a, b) => (Number(b.askCount) || 0) - (Number(a.askCount) || 0))
        .slice(0, 10)
        .map(e => ({
          id: e.id,
          question: String(e.question || '').substring(0, 80),
          askCount: Number(e.askCount) || 0,
          qualityScore: Number(e.qualityScore || 0)
        }))
    };
  }

  getAllStats() {
    const files = fs.existsSync(this.knowledgeDir)
      ? fs.readdirSync(this.knowledgeDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
      : [];
    return files.map(platformId => this.getStats(platformId));
  }

  deleteEntry(platformId, entryId) {
    const kb = this.loadPlatform(platformId);
    const index = kb.entries.findIndex(e => Number(e.id) === Number(entryId));
    if (index !== -1) {
      kb.entries.splice(index, 1);
      this.savePlatform(platformId);
      return true;
    }
    return false;
  }
}

module.exports = new KnowledgeBase();
