const indexService = require('./index-service');
const hooks = require('./hooks');
const logger = require('./logger');

async function emitKnowledgeHit(platform, question, match) {
  await hooks.emit(hooks.DATA_EVENTS.KNOWLEDGE_HIT, {
    platform,
    similarity: match.similarity,
    question
  });
}

function responsePayload(result) {
  return {
    response: result.response,
    partial: !!result.partial,
    duration: result.duration || null
  };
}

async function answerQuestion({ browser, platform, question, newConversation = true, mode = null }) {
  const searchResult = await indexService.search(platform, question);

  if (searchResult.usable && searchResult.bestMatch) {
    const best = searchResult.bestMatch;
    await emitKnowledgeHit(platform, question, best);
    indexService.incrementAskCountDetached(platform, best.id);

    return {
      fromKnowledge: true,
      indexTimedOut: false,
      indexDuration: searchResult.duration || null,
      similarity: best.similarity,
      originalQuestion: best.question,
      platform,
      response: best.answer
    };
  }

  if (searchResult.timedOut) {
    logger.warn(`[${platform}] knowledge index timed out; asking upstream AI`, {
      timeoutMs: searchResult.timeoutMs
    });
  } else {
    logger.info(`[${platform}] knowledge base miss or unusable; asking upstream AI`, {
      indexDuration: searchResult.duration || null
    });
  }

  const result = await browser.askQuestion(platform, question, { newConversation, mode });
  indexService.addEntryDetached(platform, question, result.response);

  hooks.emitDetached?.(hooks.DATA_EVENTS.KNOWLEDGE_ADDED, { platform, question });

  return {
    fromKnowledge: false,
    indexTimedOut: !!searchResult.timedOut,
    indexDuration: searchResult.duration || null,
    platform,
    mode: result.mode,
    ...responsePayload(result)
  };
}

async function continueQuestion({ browser, platform, question }) {
  const searchResult = await indexService.search(platform, question);

  if (searchResult.usable && searchResult.bestMatch) {
    const best = searchResult.bestMatch;
    await emitKnowledgeHit(platform, question, best);
    indexService.incrementAskCountDetached(platform, best.id);

    return {
      fromKnowledge: true,
      indexTimedOut: false,
      indexDuration: searchResult.duration || null,
      similarity: best.similarity,
      originalQuestion: best.question,
      platform,
      response: best.answer
    };
  }

  if (searchResult.timedOut) {
    logger.warn(`[${platform}] knowledge index timed out on continue; asking upstream AI`, {
      timeoutMs: searchResult.timeoutMs
    });
  } else {
    logger.info(`[${platform}] knowledge base miss or unusable on continue; asking upstream AI`, {
      indexDuration: searchResult.duration || null
    });
  }

  const result = await browser.continueConversation(platform, question);
  indexService.addEntryDetached(platform, question, result.response);
  hooks.emitDetached?.(hooks.DATA_EVENTS.KNOWLEDGE_ADDED, { platform, question });

  return {
    fromKnowledge: false,
    indexTimedOut: !!searchResult.timedOut,
    indexDuration: searchResult.duration || null,
    platform,
    ...responsePayload(result)
  };
}

module.exports = {
  answerQuestion,
  continueQuestion,
  responsePayload
};
