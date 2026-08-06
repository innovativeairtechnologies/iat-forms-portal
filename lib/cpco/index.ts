/* Public surface of the c.pCO panel simulator engine.

   Import from here rather than reaching into the individual modules — the
   trees, the reducer and the value store have to be assembled consistently or
   Alarm+Enter lands nowhere. */

import { createInitialState, createPanelReducer, type PanelState } from './machine'
import { SCENARIOS_BY_ID, type Scenario } from './scenarios'
import { IAT_DEFAULT_VALUES, IAT_TREE_ID, iatTree } from './trees/iat-app'
import { SYSTEM_DEFAULT_VALUES, SYSTEM_TREE_ID, systemTree } from './trees/system'
import type { Tree, Values } from './types'

export * from './types'
export { COLS, COLS_LARGE, ROWS, renderScreen, cursorableFields, menuScroll } from './display'
export { createInitialState, createPanelReducer } from './machine'
export type { PanelAction, PanelState, TreeSet } from './machine'
export { SCENARIOS, SCENARIOS_BY_ID, evaluateScenario } from './scenarios'
export type { Goal, GoalResult, Scenario, ScenarioResult } from './scenarios'
export { IAT_TREE_ID, iatTree } from './trees/iat-app'
export { SYSTEM_TREE_ID, systemTree } from './trees/system'
export * from './points'

export const TREES: Record<string, Tree> = {
  [IAT_TREE_ID]: iatTree,
  [SYSTEM_TREE_ID]: systemTree,
}

/* The IAT application and the CAREL operating system share one value store.
   They address different keys (`bacnet.*` versus `sys.*`), so a flat merge is
   safe and means Alarm+Enter doesn't have to hand state across. */
export const DEFAULT_VALUES: Values = { ...IAT_DEFAULT_VALUES, ...SYSTEM_DEFAULT_VALUES }

export const panelReducer = createPanelReducer(TREES, SYSTEM_TREE_ID)

/** Builds the starting state for free play, or for a scenario's seeded values. */
export function createPanel(scenario?: Scenario | null): PanelState {
  const tree = scenario ? (TREES[scenario.treeId] ?? iatTree) : iatTree
  return createInitialState(tree, { ...DEFAULT_VALUES, ...(scenario?.seed ?? {}) })
}

export function scenarioById(id: string | null | undefined): Scenario | null {
  return id ? (SCENARIOS_BY_ID.get(id) ?? null) : null
}
