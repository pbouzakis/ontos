/** @type {import('../../../src/types.js').TraitDefinition} */
export const sampleTrait = {
  uri: 'pkg://fixture/sample@v1#fixture.trait',
  description: 'A fixture trait for testing',
  handles: {
    do_thing: () => ({ effects: [] }),
  },
}

// Non-trait export — should be silently ignored by loadPackage
export const helperString = 'not a trait'
