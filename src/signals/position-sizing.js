function isFinitePositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function calculateNotionalUsd({ marginUsd, leverage }) {
  if (!isFinitePositiveNumber(marginUsd) || !isFinitePositiveNumber(leverage)) {
    return null;
  }

  return marginUsd * leverage;
}

function calculateQty({ notionalUsd, price }) {
  if (!isFinitePositiveNumber(notionalUsd) || !isFinitePositiveNumber(price)) {
    return null;
  }

  return notionalUsd / price;
}

function calculatePositionSize({ marginUsd, leverage, price }) {
  const notionalUsd = calculateNotionalUsd({
    marginUsd,
    leverage
  });

  if (notionalUsd === null) {
    return null;
  }

  const qty = calculateQty({
    notionalUsd,
    price
  });

  if (qty === null) {
    return null;
  }

  return {
    marginUsd,
    leverage,
    notionalUsd,
    price,
    qty
  };
}

module.exports = {
  calculateNotionalUsd,
  calculatePositionSize,
  calculateQty
};
