 # Architecture rules

- Open Stripe checkout and portal in a synchronously created separate tab with a fallback link and bounded waiting; embedded previews cannot reliably navigate to Stripe.
- Bind Stripe customers to organizations and authorize billing with organization membership roles, never an email lookup; teammates must not overwrite the company's subscription.
- Apply verified Stripe notifications through the transactional billing-event RPC and preserve non-Stripe paid grants; retries must not duplicate or downgrade billing state.
- Calculate analytical compositions recursively from reference-specific input prices with per-line truncation and cycle detection; synthetic prices are only fallback for compositions without analytical items.
- Keep shared budget arithmetic in browser-safe domain helpers and cover financial rules with executable tests; screen and database calculations need matching reference checks.
- Use row-local organization predicates for budget SELECT policies so INSERT RETURNING can read newly created budgets without self-lookup visibility failures.
- Keep content-route metadata in the shared metadata helper; each leaf supplies its own title and description.