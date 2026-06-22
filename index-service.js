const path = require('path');
const { Worker } = require('worker_threads');
const knowledge = require('./knowledge');
const logger = require('./logger');

const WORKER_PATH = path.join(__dirname, 'knowledge-index-worker.js');
const DEFAULT_SEARCH_TIMEOUT_MS = Number(process.env.INDEX_SEARCH_TIMEOUT_MS || 1200);

function timeoutResult(platform, question, timeoutMs) {
  return {
    found: false,
    usable: false,
    timedOut: true,
    timeoutMs,
    platform,
    questionPreview: String(question || '').slice(0, 80),
    entries: [],
    bestMatch: null
  };
}

function search(platform, question, options = {}) {
  const threshold = Number(options.threshold || 0.5);
  const timeoutMs = Number(options.timeoutMs || DEFAULT_SEARCH_TIMEOUT_MS);
  const startedAt = Date.now();

  return new Promise(resolve => {
    let settled = false;
    const worker = new Worker(WORKER_PATH, {
      workerData: { platform, question, threshold }
    });

    const settle = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      result.duration = Date.now() - startedAt;
      resolve(result);
    };

    const timer = setTimeout(() => {
      worker.terminate().catch(() => {});
      logger.warn('knowledge index search timed out', { platform, timeoutMs });
      settle(timeoutResult(platform, question, timeoutMs));
    }, timeoutMs);

    if (timer.unref) timer.unref();

    worker.once('message', message => {
      if (message?.ok) {
        settle({ ...message.result, timedOut: false, timeoutMs });
      } else {
        settle({
          found: false,
          usable: false,
          timedOut: false,
          timeoutMs,
          error: message?.error || 'knowledge index search failed',
          entries: [],
          bestMatch: null
        });
      }
    });

    worker.once('error', error => {
      logger.error('knowledge index worker failed', { platform, error: error.message });
      settle({
        found: false,
        usable: false,
        timedOut: false,
        timeoutMs,
        error: error.message,
        entries: [],
        bestMatch: null
      });
    });

    worker.once('exit', code => {
      if (!settled && code !== 0) {
        settle({
          found: false,
          usable: false,
          timedOut: false,
          timeoutMs,
          error: `knowledge index worker exited with code ${code}`,
          entries: [],
          bestMatch: null
        });
      }
    });
  });
}

function addEntryDetached(platform, question, answer, tags = [], meta = {}) {
  setImmediate(() => {
    try {
      knowledge.addEntry(platform, question, answer, tags, meta);
    } catch (error) {
      logger.error('knowledge index add failed', { platform, error: error.message });
    }
  });
}

function incrementAskCountDetached(platform, entryId) {
  setImmediate(() => {
    try {
      knowledge.incrementAskCount(platform, entryId);
    } catch (error) {
      logger.error('knowledge index ask count update failed', { platform, entryId, error: error.message });
    }
  });
}

module.exports = {
  DEFAULT_SEARCH_TIMEOUT_MS,
  search,
  addEntryDetached,
  incrementAskCountDetached
};
