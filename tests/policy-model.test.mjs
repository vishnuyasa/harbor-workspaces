import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getCompactedWorkspaceCount,
    getEmptySecondaryFallbackIndex,
} from '../lib/policy-model.js';

test('keeps a spare empty secondary workspace', () => {
    assert.equal(getCompactedWorkspaceCount(0), 2);
    assert.equal(getCompactedWorkspaceCount(1), 3);
    assert.equal(getCompactedWorkspaceCount(2), 4);
});

test('empty secondary fallback goes to the previous valid workspace', () => {
    assert.equal(getEmptySecondaryFallbackIndex(1), 0);
    assert.equal(getEmptySecondaryFallbackIndex(2), 1);
    assert.equal(getEmptySecondaryFallbackIndex(4), 3);
});
