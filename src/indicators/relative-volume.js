const DEFAULT_RELATIVE_VOLUME_LOOKBACK = 20;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !isFiniteNumber(value))) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function calculateRelativeVolume(volumes, options = {}) {
  const lookback = options.lookback || DEFAULT_RELATIVE_VOLUME_LOOKBACK;

  if (!Array.isArray(volumes) || !Number.isInteger(lookback) || lookback <= 0 || volumes.length < lookback + 1) {
    return null;
  }

  if (volumes.some((volume) => !isFiniteNumber(volume))) {
    return null;
  }

  const currentVolume = volumes[volumes.length - 1];
  const averageVolume = average(volumes.slice(-(lookback + 1), -1));

  if (averageVolume === null || averageVolume === 0) {
    return null;
  }

  return currentVolume / averageVolume;
}

function calculateRelativeVolumeSeries(volumes, options = {}) {
  if (!Array.isArray(volumes)) {
    return [];
  }

  return volumes.map((_, index) => calculateRelativeVolume(volumes.slice(0, index + 1), options));
}

module.exports = {
  DEFAULT_RELATIVE_VOLUME_LOOKBACK,
  calculateRelativeVolume,
  calculateRelativeVolumeSeries
};
