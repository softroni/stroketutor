import { fileURLToPath } from 'node:url'

/**
 * The frozen `shared/` the tests run on: the catalog, the tutorials and the
 * reference drawings as they were, held still so a change to the creator's
 * content cannot break a test about the code.
 *
 * Pass it to `createRepoWriter({ sharedDir })` as it is, or copy it into a
 * scratch directory first when the test writes. `test/fixtures/README.md` says
 * what is in it and when it may change.
 */
export const FIXTURE_SHARED = fileURLToPath(new URL('./fixtures/shared/', import.meta.url))
