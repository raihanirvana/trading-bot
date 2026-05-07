const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ValidationError } = require('../src/errors');
const {
  VIRTUAL_ORDER_STATUS,
  VIRTUAL_ORDER_TRANSITIONS,
  assertCanTransitionVirtualOrder,
  canTransitionVirtualOrder,
  getAllowedVirtualOrderTransitions,
  isTerminalVirtualOrderStatus
} = require('../src/paper');

describe('paper order state machine', () => {
  it('defines allowed transitions explicitly', () => {
    assert.deepEqual(VIRTUAL_ORDER_TRANSITIONS, {
      PENDING: ['FILLED', 'CANCELLED', 'EXPIRED'],
      FILLED: ['TP', 'SL', 'TIME_EXIT'],
      TP: [],
      SL: [],
      TIME_EXIT: [],
      CANCELLED: [],
      EXPIRED: []
    });
  });

  it('allows only the configured valid transitions', () => {
    for (const [fromStatus, allowedStatuses] of Object.entries(VIRTUAL_ORDER_TRANSITIONS)) {
      assert.deepEqual(getAllowedVirtualOrderTransitions(fromStatus), allowedStatuses);

      for (const toStatus of allowedStatuses) {
        assert.equal(canTransitionVirtualOrder(fromStatus, toStatus), true);
        assert.equal(assertCanTransitionVirtualOrder(fromStatus, toStatus), true);
      }
    }
  });

  it('rejects invalid transitions across the full state matrix', () => {
    const statuses = Object.values(VIRTUAL_ORDER_STATUS);

    for (const fromStatus of statuses) {
      for (const toStatus of statuses) {
        if (VIRTUAL_ORDER_TRANSITIONS[fromStatus].includes(toStatus)) {
          continue;
        }

        assert.equal(canTransitionVirtualOrder(fromStatus, toStatus), false);
        assert.throws(
          () => assertCanTransitionVirtualOrder(fromStatus, toStatus),
          (error) => {
            assert.equal(error instanceof ValidationError, true);
            assert.deepEqual(error.details, {
              from: fromStatus,
              to: toStatus
            });
            return true;
          }
        );
      }
    }
  });

  it('treats only exit/cancel/expire states as terminal', () => {
    assert.equal(isTerminalVirtualOrderStatus(VIRTUAL_ORDER_STATUS.PENDING), false);
    assert.equal(isTerminalVirtualOrderStatus(VIRTUAL_ORDER_STATUS.FILLED), false);
    assert.equal(isTerminalVirtualOrderStatus(VIRTUAL_ORDER_STATUS.TP), true);
    assert.equal(isTerminalVirtualOrderStatus(VIRTUAL_ORDER_STATUS.SL), true);
    assert.equal(isTerminalVirtualOrderStatus(VIRTUAL_ORDER_STATUS.TIME_EXIT), true);
    assert.equal(isTerminalVirtualOrderStatus(VIRTUAL_ORDER_STATUS.CANCELLED), true);
    assert.equal(isTerminalVirtualOrderStatus(VIRTUAL_ORDER_STATUS.EXPIRED), true);
  });

  it('rejects unknown state names', () => {
    assert.throws(
      () => getAllowedVirtualOrderTransitions('BROKEN'),
      ValidationError
    );
    assert.throws(
      () => canTransitionVirtualOrder('PENDING', 'BROKEN'),
      ValidationError
    );
  });
});
