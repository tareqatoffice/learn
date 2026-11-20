// The registry of question groups. You don't need to edit this file.
import { arrays } from "./arrays/arrays.checks";
import { asyncFlow } from "./async-flow/async-flow.checks";
import { caching } from "./caching/caching.checks";
import { classics } from "./classics/classics.checks";
import { colors } from "./colors/colors.checks";
import { dates } from "./dates/dates.checks";
import { deep } from "./deep/deep.checks";
import { dom } from "./dom/dom.checks";
import { dynamic } from "./dynamic/dynamic.checks";
import { events } from "./events/events.checks";
import { format } from "./format/format.checks";
import { functional } from "./functional/functional.checks";
import { generators } from "./generators/generators.checks";
import { graphs } from "./graphs/graphs.checks";
import { grids } from "./grids/grids.checks";
import type { Group } from "./harness";
import { language } from "./language/language.checks";
import { metaprogramming } from "./metaprogramming/metaprogramming.checks";
import { nextRendering } from "./next-rendering/next-rendering.checks";
import { nextRouting } from "./next-routing/next-routing.checks";
import { nextServer } from "./next-server/next-server.checks";
import { numbers } from "./numbers/numbers.checks";
import { objects } from "./objects/objects.checks";
import { parsers } from "./parsers/parsers.checks";
import { paths } from "./paths/paths.checks";
import { promises } from "./promises/promises.checks";
import { rateLimits } from "./rate-limits/rate-limits.checks";
import { reactComponents } from "./react-components/react-components.checks";
import { reactConcurrent } from "./react-concurrent/react-concurrent.checks";
import { reactEffects } from "./react-effects/react-effects.checks";
import { reactPatterns } from "./react-patterns/react-patterns.checks";
import { reactState } from "./react-state/react-state.checks";
import { reactive } from "./reactive/reactive.checks";
import { results } from "./results/results.checks";
import { sorting } from "./sorting/sorting.checks";
import { store } from "./store/store.checks";
import { strings } from "./strings/strings.checks";
import { structures } from "./structures/structures.checks";
import { tables } from "./tables/tables.checks";
import { text } from "./text/text.checks";
import { timing } from "./timing/timing.checks";
import { trees } from "./trees/trees.checks";
import { urls } from "./urls/urls.checks";
import { validation } from "./validation/validation.checks";

export type Topic = "JavaScript" | "React" | "Next.js";

export const topics: readonly { name: Topic; groups: readonly Group[] }[] = [
  {
    name: "JavaScript",
    groups: [
      classics,
      language,
      metaprogramming,
      arrays,
      objects,
      paths,
      deep,
      strings,
      text,
      numbers,
      dates,
      format,
      functional,
      timing,
      promises,
      asyncFlow,
      generators,
      events,
      reactive,
      store,
      structures,
      trees,
      graphs,
      sorting,
      grids,
      dynamic,
      urls,
      validation,
      parsers,
      colors,
      tables,
      rateLimits,
      caching,
      dom,
      results,
    ],
  },
  {
    name: "React",
    groups: [
      reactState,
      reactEffects,
      reactComponents,
      reactPatterns,
      reactConcurrent,
    ],
  },
  {
    name: "Next.js",
    groups: [
      nextRouting,
      nextServer,
      nextRendering,
    ],
  },
];

export const groups: readonly Group[] = topics.flatMap((topic) => topic.groups);
