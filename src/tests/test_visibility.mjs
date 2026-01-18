
// Mock DOM
class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(cls) {
    this.classes.add(cls);
  }
  remove(cls) {
    this.classes.delete(cls);
  }
  toggle(cls, force) {
    if (force !== undefined) {
      if (force) this.add(cls);
      else this.remove(cls);
    } else {
      if (this.classes.has(cls)) this.remove(cls);
      else this.add(cls);
    }
  }
  contains(cls) {
    return this.classes.has(cls);
  }
}

class MockElement {
  constructor() {
    this.classList = new MockClassList();
    this.style = {};
  }
}

global.document = {
  createElement: () => new MockElement()
};
global.HTMLElement = MockElement;

// Import the module
import * as DomHelpers from '../utils/dom-helpers.js';

console.log('Running tests for visibility helpers...');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  } else {
    console.log(`PASS: ${message}`);
  }
}

async function runTests() {
  // We expect toggleVisibility to exist
  if (typeof DomHelpers.toggleVisibility !== 'function') {
    console.error('FAIL: toggleVisibility function not found in exports');
    failures++;
  } else {
    // Test 1: Hide element
    const el1 = new MockElement();
    DomHelpers.toggleVisibility(el1, false);
    assert(el1.classList.contains('hidden'), 'Element should have hidden class when shouldShow=false');

    // Test 2: Show element
    const el2 = new MockElement();
    el2.classList.add('hidden');
    DomHelpers.toggleVisibility(el2, true);
    assert(!el2.classList.contains('hidden'), 'Element should not have hidden class when shouldShow=true');

    // Test 3: Null element check (should not crash)
    try {
      DomHelpers.toggleVisibility(null, true);
      assert(true, 'Should handle null element gracefully');
    } catch (e) {
      assert(false, 'Threw error on null element');
    }

    // Test 4: Verify alias if setElementDisplay is kept/aliased
    if (typeof DomHelpers.setElementDisplay === 'function') {
         const el3 = new MockElement();
         DomHelpers.setElementDisplay(el3, false);
         assert(el3.classList.contains('hidden'), 'setElementDisplay should still work (via alias or existing)');
    }
  }

  if (failures === 0) {
    console.log('All tests passed!');
    process.exit(0);
  } else {
    console.error(`${failures} tests failed.`);
    process.exit(1);
  }
}

runTests();
