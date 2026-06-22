// hooks.js - Stable centralized hook/event manager
const logger = require('./logger');

class HookManager {
  constructor() {
    this.hooks = new Map();
    this.history = [];
    this.maxHistory = Number(process.env.HOOK_HISTORY_LIMIT || 500);
    this.defaultTimeoutMs = Number(process.env.HOOK_TIMEOUT_MS || 3000);
  }

  on(event, handler, priority = 0, options = {}) {
    if (!event || typeof event !== 'string') {
      throw new Error('event must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new Error('handler must be a function');
    }

    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }

    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      handler,
      priority: Number(priority) || 0,
      timeoutMs: Number(options.timeoutMs || this.defaultTimeoutMs),
      registeredAt: Date.now()
    };

    const list = this.hooks.get(event);
    list.push(entry);
    list.sort((a, b) => b.priority - a.priority);

    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (!this.hooks.has(event)) return false;
    const list = this.hooks.get(event);
    const index = list.findIndex(e => e.handler === handler);
    if (index !== -1) {
      list.splice(index, 1);
      if (list.length === 0) this.hooks.delete(event);
      return true;
    }
    return false;
  }

  async emit(event, data = {}, options = {}) {
    const wait = options.wait !== false;
    if (!wait) {
      this.emitDetached(event, data);
      return [];
    }

    const timeoutMs = Number(options.timeoutMs || this.defaultTimeoutMs);
    return this._emitInternal(event, data, timeoutMs);
  }

  emitDetached(event, data = {}) {
    setImmediate(() => {
      this._emitInternal(event, data, this.defaultTimeoutMs).catch(error => {
        logger.error(`hook detached emit failed: ${event}`, { error: error.message });
      });
    });
  }

  async _emitInternal(event, data, timeoutMs) {
    const list = this.hooks.has(event) ? [...this.hooks.get(event)] : [];
    this._record(event, data, list.length);

    if (list.length === 0) return [];

    const results = [];
    for (const entry of list) {
      const startedAt = Date.now();
      try {
        const result = await this._withTimeout(
          Promise.resolve().then(() => entry.handler(data)),
          entry.timeoutMs || timeoutMs,
          `hook timeout: ${event}`
        );
        results.push({ success: true, duration: Date.now() - startedAt, result });
      } catch (error) {
        logger.error(`hook failed: ${event}`, { error: error.message });
        results.push({ success: false, duration: Date.now() - startedAt, error: error.message });
      }
    }

    return results;
  }

  emitSync(event, data = {}) {
    const list = this.hooks.has(event) ? [...this.hooks.get(event)] : [];
    this._record(event, data, list.length);

    const results = [];
    for (const entry of list) {
      const startedAt = Date.now();
      try {
        const result = entry.handler(data);
        results.push({ success: true, duration: Date.now() - startedAt, result });
      } catch (error) {
        logger.error(`hook failed: ${event}`, { error: error.message });
        results.push({ success: false, duration: Date.now() - startedAt, error: error.message });
      }
    }
    return results;
  }

  _withTimeout(promise, timeoutMs, message) {
    let timeout;
    const timer = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      if (timeout.unref) timeout.unref();
    });

    return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
  }

  _record(event, data, handlerCount = 0) {
    this.history.push({
      event,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
      handlerCount,
      timestamp: Date.now()
    });

    while (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getRegisteredEvents() {
    const events = {};
    for (const [event, list] of this.hooks) {
      events[event] = list.length;
    }
    return events;
  }

  getHistory(limit = 20) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, this.maxHistory));
    return this.history.slice(-safeLimit);
  }

  removeAll(event) {
    if (event) {
      this.hooks.delete(event);
    } else {
      this.hooks.clear();
    }
  }
}

const hooks = new HookManager();

hooks.PROCESS_EVENTS = {
  STARTING: 'process:starting',
  STARTED: 'process:started',
  SHUTTING_DOWN: 'process:shutting_down',
  SHUTDOWN: 'process:shutdown',
  ERROR: 'process:error',
  HEALTH_CHECK: 'process:health_check'
};

hooks.BROWSER_EVENTS = {
  LAUNCHING: 'browser:launching',
  LAUNCHED: 'browser:launched',
  NAVIGATING: 'browser:navigating',
  NAVIGATED: 'browser:navigated',
  PAGE_LOAD: 'browser:page_load',
  PAGE_ERROR: 'browser:page_error',
  DIALOG: 'browser:dialog',
  CAPTCHA_DETECTED: 'browser:captcha_detected',
  CAPTCHA_RESOLVED: 'browser:captcha_resolved',
  LOGIN_REQUIRED: 'browser:login_required',
  LOGIN_SUCCESS: 'browser:login_success',
  QUESTION_SENT: 'browser:question_sent',
  RESPONSE_RECEIVED: 'browser:response_received',
  RESPONSE_TIMEOUT: 'browser:response_timeout',
  CLOSING: 'browser:closing',
  CLOSED: 'browser:closed'
};

hooks.API_EVENTS = {
  REQUEST_START: 'api:request_start',
  REQUEST_END: 'api:request_end',
  AUTH_SUCCESS: 'api:auth_success',
  AUTH_FAILURE: 'api:auth_failure',
  RATE_LIMITED: 'api:rate_limited',
  VALIDATION_ERROR: 'api:validation_error',
  SERVER_ERROR: 'api:server_error'
};

hooks.DATA_EVENTS = {
  QUESTION_SAVED: 'data:question_saved',
  RESPONSE_SAVED: 'data:response_saved',
  KNOWLEDGE_ADDED: 'data:knowledge_added',
  KNOWLEDGE_HIT: 'data:knowledge_hit',
  KNOWLEDGE_DELETED: 'data:knowledge_deleted',
  CONVERSATION_STARTED: 'data:conversation_started',
  CONVERSATION_ENDED: 'data:conversation_ended'
};

module.exports = hooks;
