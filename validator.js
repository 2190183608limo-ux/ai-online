function normalizeOptionalSelector(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeSelectorList(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    const selectors = value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean);
    return selectors.length === value.length ? selectors : false;
  }
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return false;
}

function validateQuestion(req, res, next) {
  const { question } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Valid question is required' });
  }

  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({ error: 'Question cannot be empty' });
  }

  if (trimmed.length > 10000) {
    return res.status(400).json({ error: 'Question cannot exceed 10000 characters' });
  }

  req.body.question = trimmed;
  next();
}

function validatePlatform(req, res, next) {
  const { platform } = req.body;

  if (platform && typeof platform !== 'string') {
    return res.status(400).json({ error: 'Platform ID must be a string' });
  }

  if (platform && !/^[a-zA-Z0-9_-]+$/.test(platform)) {
    return res.status(400).json({ error: 'Platform ID can only contain letters, numbers, underscores and hyphens' });
  }

  next();
}

function validatePlatformCreation(req, res, next) {
  const { id, name, url } = req.body;

  if (!id || !name || !url) {
    return res.status(400).json({ error: 'id, name and url are required' });
  }

  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Platform ID can only contain letters, numbers, underscores and hyphens' });
  }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Platform name cannot be empty' });
  }

  if (typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Valid URL is required' });
  }

  const selectorFields = [
    'inputSelector',
    'responseSelector',
    'loadingSelector',
    'stopSelector',
    'submitSelector',
    'modeSelector',
    'newConversationSelector'
  ];

  for (const field of selectorFields) {
    const normalized = normalizeOptionalSelector(req.body[field]);
    if (normalized === false) {
      return res.status(400).json({ error: `${field} must be a string` });
    }
    req.body[field] = normalized;
  }

  const captchaIndicators = normalizeSelectorList(req.body.captchaIndicators);
  if (captchaIndicators === false) {
    return res.status(400).json({ error: 'captchaIndicators must be a comma-separated string or string array' });
  }

  req.body.id = id.trim();
  req.body.name = name.trim();
  req.body.url = url.trim();
  req.body.captchaIndicators = captchaIndicators;

  next();
}

function validateKnowledgeEntry(req, res, next) {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer are required' });
  }

  if (typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Question cannot be empty' });
  }

  if (typeof answer !== 'string' || answer.trim().length === 0) {
    return res.status(400).json({ error: 'Answer cannot be empty' });
  }

  req.body.question = question.trim();
  req.body.answer = answer.trim();

  next();
}

function validatePagination(req, res, next) {
  const limit = parseInt(req.query.limit, 10);

  if (isNaN(limit) || limit < 1 || limit > 100) {
    req.query.limit = 20;
  } else {
    req.query.limit = limit;
  }

  next();
}

module.exports = {
  validateQuestion,
  validatePlatform,
  validatePlatformCreation,
  validateKnowledgeEntry,
  validatePagination
};
