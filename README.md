# Colony Weather

**One starting culture. Two possible worlds.** Colony Weather is a browser-based, paired-chamber sandbox for exploring how local glucose and oxygen conditions can shape a simplified *Saccharomyces cerevisiae* culture over time.

## Run it

**Live demo:** https://xqscora.github.io/colony-weather/

Open `index.html` in a modern browser. No build step, API key, or backend is required; the model and experiment data stay in the browser. `npm test` runs the deterministic model tests.

## Experiment workflow

1. A and B start from the same seeded set of virtual cells.
2. Change glucose, oxygen, or temperature independently in either chamber.
3. Run or step the simulation; add a glucose pulse to only one chamber.
4. Compare cell count, biomass, remaining resources, ethanol/CO2 proxies and export the time series as CSV.

## Model boundaries

Each dot is an agent on a 32 x 20 spatial grid. Cells consume local glucose, respond to an illustrative oxygen-dependent energy term, grow and bud into adjacent free space. Neighboring grid tiles exchange resources. Glucose, oxygen, ethanol-proxy and CO2-proxy fields are measured over a bounded 48-hour model horizon.

The coefficients and proxy outputs are dimensionless and illustrative, not fitted to a particular strain, vessel, or experimental dataset. This is not a whole-cell model, a validated predictor, or a substitute for wet-lab measurement. It omits gene regulation, cell-cycle phases, strain-specific physiology, pH buffering, vessel geometry, and many other mechanisms. Visual plausibility does not establish biological validity.

The qualitative model motivation is the documented interaction between glucose availability and oxygen-dependent yeast metabolism. See Saldanha et al. (2004), [Homeostatic Adjustment and Metabolic Remodeling in Glucose-limited Yeast Cultures](https://pmc.ncbi.nlm.nih.gov/articles/PMC1087253/), and van Dijken et al. (1982), [The growth of *Saccharomyces cerevisiae* CBS 426 on mixtures of glucose and ethanol](https://pubmed.ncbi.nlm.nih.gov/7016030/). These papers motivate the topic; the app does not reproduce their fitted models or measurements.

## Technology and disclosure

- Vanilla JavaScript, HTML Canvas, CSS; no external runtime dependencies.
- AI coding assistance was used to draft implementation and tests. The author should review and be able to explain the model and code.
- No AI model or remote service is called by the application.
