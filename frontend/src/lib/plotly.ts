/* react-plotly.js's main entry hard-requires 'plotly.js/dist/plotly', which is
 * not present when only the lighter 'plotly.js-dist-min' bundle is installed.
 * Building the component from the factory with the min bundle avoids that
 * require entirely and keeps the bundle small.
 *
 * Both deps are CommonJS, so their interop shape differs between Vite's dev
 * server and the production bundler. Normalize the default export in both
 * cases (`mod` may be the value itself or `{ default: value }`). */
// @ts-expect-error — plotly.js-dist-min ships no type declarations
import PlotlyImport from 'plotly.js-dist-min'
import factoryImport from 'react-plotly.js/factory'

import type { ComponentType } from 'react'

type Factory = (plotly: unknown) => ComponentType<Record<string, unknown>>

function unwrapDefault<T>(mod: unknown): T {
  if (mod && typeof mod === 'object' && 'default' in (mod as Record<string, unknown>)) {
    return (mod as { default: T }).default
  }
  return mod as T
}

const Plotly = unwrapDefault<unknown>(PlotlyImport)
const createPlotlyComponent = unwrapDefault<Factory>(factoryImport)

export const Plot = createPlotlyComponent(Plotly)
