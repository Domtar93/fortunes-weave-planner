import reference from './data/runtime/reference.json'
import proficiencies1 from './data/runtime/proficiencies-1.json'
import proficiencies2 from './data/runtime/proficiencies-2.json'
import proficiencies3 from './data/runtime/proficiencies-3.json'
import { assembleRuntimeParts } from './runtimeParts.js'
import type sourceSnapshot from './data/growths.json'
// Type-only reference: the original authoritative JSON is not duplicated in the runtime bundle.
type SourceSnapshot = typeof sourceSnapshot
const imported = assembleRuntimeParts([reference, proficiencies1, proficiencies2, proficiencies3]) as SourceSnapshot
export default imported
