# Iktara web app

Next.js frontend for the same-origin Iktara runtime. The public runtime serves `/api/*` and proxies pages/assets to Next.js on a private port. No Convex, signup or subscription dependency is used.

The visual baseline is `Om2524/astropersonalised` revision `8485494`: the original sky-blue gradient, frosted glass, logo, landing composition, question composer and chart views. `globals.css`, the composer and the chart presentation are adapted from that source, not the later dark placeholder pages.

The runtime owns profiles, computed charts, durable jobs and answers. Chat presents history chronologically, restores pending jobs on reload, and keeps failed questions available for explicit retry. It does not silently fall back to reflection without a chart. Four lenses and explicit topics select the original evidence engines. Markdown answers link numbered citations to readable source cards and calculation provenance. Saved answers retain their exact evidence and can reopen in chat.

Birth time quality is visible on charts. Unknown-time houses and ascendant are hidden; the inherited dasha output is labelled as the birth period, not current timing. No live transits or web search are represented as available.

From the repository root:

```sh
corepack pnpm --dir apps/web install --frozen-lockfile
corepack pnpm --dir apps/web build
npm run dev
```

Contributor ports are runtime 3220, Next 3221 and compute 8020. The deployed ports remain 3210, 3211 and 8001. Model settings are read by the runtime from ignored configuration; browser code never receives credentials.
