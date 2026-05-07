const { ValidationError } = require('../errors');

const AI_DECISION_EVENT = 'AI_DECISION';

function saveAiDecisionToJournal(options = {}) {
  const {
    aiInput,
    finalDecision,
    journal,
    parsedDecision,
    rawResponse,
    recordedAt
  } = options;

  validateAiDecisionJournalInput({
    aiInput,
    finalDecision,
    journal,
    parsedDecision
  });

  return journal.saveEvent(buildAiDecisionEvent({
    aiInput,
    finalDecision,
    parsedDecision,
    rawResponse,
    recordedAt
  }));
}

function buildAiDecisionEvent(options = {}) {
  const {
    aiInput,
    finalDecision,
    parsedDecision,
    rawResponse = null,
    recordedAt = new Date()
  } = options;
  const signalId = aiInput?.signal?.signal_id;
  const createdAt = normalizeTimestamp(recordedAt);

  if (!signalId) {
    throw new ValidationError('AI decision journal requires signal_id');
  }

  return {
    event_id: `${signalId}-${AI_DECISION_EVENT}-${formatEventTimestamp(createdAt)}`,
    signal_id: signalId,
    event_type: AI_DECISION_EVENT,
    created_at: createdAt,
    payload: {
      signal_id: signalId,
      ai_input: aiInput,
      raw_response: rawResponse,
      parsed_decision: parsedDecision,
      final_decision: finalDecision
    }
  };
}

function validateAiDecisionJournalInput({ aiInput, finalDecision, journal, parsedDecision }) {
  if (!journal || typeof journal.saveEvent !== 'function') {
    throw new ValidationError('Journal with saveEvent is required for AI decision');
  }

  if (!aiInput || typeof aiInput !== 'object') {
    throw new ValidationError('AI input is required for AI decision journal');
  }

  if (!parsedDecision || typeof parsedDecision !== 'object') {
    throw new ValidationError('Parsed AI decision is required for AI decision journal');
  }

  if (!finalDecision || typeof finalDecision !== 'object') {
    throw new ValidationError('Final AI decision is required for AI decision journal');
  }
}

function normalizeTimestamp(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('AI decision timestamp is invalid');
  }

  return date.toISOString();
}

function formatEventTimestamp(timestamp) {
  return normalizeTimestamp(timestamp)
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('.000', '');
}

module.exports = {
  AI_DECISION_EVENT,
  buildAiDecisionEvent,
  saveAiDecisionToJournal
};
