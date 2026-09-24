// Verify the actual Blockly QA programs against the current Mission 1 grid.
// The old handwritten MOVES array had stale inspection coordinates.
const assert=require('node:assert/strict'),{validate}=require('./mission1-fixture.cjs');
const full=validate('mission1-inspections.xml'),direct=validate('mission1-direct.xml');
assert.deepEqual(new Set(full.inspections),new Set(['1,6','5,10','9,1']));
assert.equal(direct.inspections.length,0);
console.log(JSON.stringify({full,direct},null,2));
