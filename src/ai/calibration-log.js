const { ValidationError } = require('../errors');

const AI_CONFIDENCE_CALIBRATION_EVENT = 'AI_CONFIDENCE_CALIBRATION';
const AI_CONFIDENCE_LEVELS = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);
const AI_CONFIDENCE_SCORES = Object.freeze({
  LOW: 0.33,
  MEDIUM: 0.66,
  HIGH: 1
});

function saveAiConfidenceCalibrationToJournal(options = {}) {
  const {
    journal,
    ...eventOptions
  } = options;

  if (!journal || typeof journal.saveEvent !== 'function') {
    throw new ValidationError('Journal with saveEvent is required for AI confidence calibration');
  }

  return journal.saveEvent(buildAiConfidenceCalibrationEvent(eventOptions));
}

function buildAiConfidenceCalibrationEvent(options = {}) {
  const record = buildAiConfidenceCalibrationRecord(options);
  const createdAt = normalizeTimestamp(options.recordedAt || record.observed_at);

  return {
    event_id: `${record.signal_id}-${AI_CONFIDENCE_CALIBRATION_EVENT}-${formatEventTimestamp(createdAt)}`,
    signal_id: record.signal_id,
    event_type: AI_CONFIDENCE_CALIBRATION_EVENT,
    created_at: createdAt,
    payload: record
  };
}

function buildAiConfidenceCalibrationRecord(options = {}) {
  const {
    actualLabel = null,
    confidence,
    metadata = {},
    observedAt = new Date(),
    outcome,
    predictedLabel,
    signalId,
    sourceEventId = null,
    sourceEventType
  } = options;
  const normalizedConfidence = normalizeConfidence(confidence);
  const normalizedSignalId = normalizeRequiredString(signalId, 'signalId');
  const normalizedPrediction = normalizeRequiredString(predictedLabel, 'predictedLabel');
  const normalizedSourceEventType = normalizeRequiredString(sourceEventType, 'sourceEventType');
  const observedAtIso = normalizeTimestamp(observedAt);
  const normalizedActualLabel = actualLabel === null || actualLabel === undefined
    ? null
    : normalizeRequiredString(actualLabel, 'actualLabel');

  return {
    signal_id: normalizedSignalId,
    source_event_type: normalizedSourceEventType,
    source_event_id: sourceEventId ? String(sourceEventId) : null,
    confidence: normalizedConfidence,
    confidence_score: AI_CONFIDENCE_SCORES[normalizedConfidence],
    predicted_label: normalizedPrediction,
    actual_label: normalizedActualLabel,
    correct: normalizedActualLabel === null ? null : normalizedPrediction === normalizedActualLabel,
    outcome: normalizeOutcome(outcome),
    observed_at: observedAtIso,
    metadata: sanitizeMetadata(metadata)
  };
}

function buildCalibrationFromPostSlAnalysis(options = {}) {
  const {
    actualLabel = null,
    metadata,
    outcome,
    postSlEvent,
    recordedAt
  } = options;
  const payload = postSlEvent?.payload || parsePayloadJson(postSlEvent?.payload_json);
  const label = payload?.loss_label;
  const signalId = payload?.signal_id || postSlEvent?.signal_id;

  if (!label || typeof label !== 'object') {
    throw new ValidationError('Post-SL analysis loss label is required for calibration');
  }

  return buildAiConfidenceCalibrationEvent({
    actualLabel,
    confidence: label.confidence,
    metadata: metadata || {
      fallback: label.fallback === true,
      loss_reason: label.reason
    },
    observedAt: recordedAt || postSlEvent?.created_at || new Date(),
    outcome,
    predictedLabel: label.loss_type,
    signalId,
    sourceEventId: postSlEvent?.event_id || null,
    sourceEventType: postSlEvent?.event_type || 'POST_SL_ANALYSIS'
  });
}

function normalizeConfidence(confidence) {
  const normalized = normalizeRequiredString(confidence, 'confidence').toUpperCase();

  if (!AI_CONFIDENCE_LEVELS.includes(normalized)) {
    throw new ValidationError('Invalid AI confidence level', {
      allowed: AI_CONFIDENCE_LEVELS,
      value: confidence
    });
  }

  return normalized;
}

function normalizeOutcome(outcome) {
  if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) {
    throw new ValidationError('Calibration outcome is required');
  }

  return sanitizeMetadata(outcome);
}

function sanitizeMetadata(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadata);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, sanitizeMetadata(nestedValue)])
  );
}

function parsePayloadJson(payloadJson) {
  if (typeof payloadJson !== 'string') {
    return null;
  }

  try {
    return JSON.parse(payloadJson);
  } catch (_error) {
    return null;
  }
}

function normalizeTimestamp(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('AI confidence calibration timestamp is invalid');
  }

  return date.toISOString();
}

function formatEventTimestamp(timestamp) {
  return normalizeTimestamp(timestamp)
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('.000', '');
}

function normalizeRequiredString(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new ValidationError(`${label} is required`);
  }

  return String(value).trim();
}

module.exports = {
  AI_CONFIDENCE_CALIBRATION_EVENT,
  AI_CONFIDENCE_LEVELS,
  AI_CONFIDENCE_SCORES,
  buildAiConfidenceCalibrationEvent,
  buildAiConfidenceCalibrationRecord,
  buildCalibrationFromPostSlAnalysis,
  saveAiConfidenceCalibrationToJournal
};
