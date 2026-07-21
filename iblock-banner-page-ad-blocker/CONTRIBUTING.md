# Contributing

Contributions should preserve iBlock's primary design constraint: block high-confidence advertising without damaging normal page functionality.

## Development workflow

1. Fork and clone the repository.
2. Make changes inside `extension/`.
3. Run `npm run validate`.
4. Test the unpacked extension in a clean Chrome profile.
5. Include reproduction steps and tested URLs in the pull request.

## Rule changes

For every new domain or DNR rule:

- explain why the endpoint is advertising-related;
- avoid broad first-party path or keyword matching;
- prefer third-party domain-scoped rules;
- verify Twitch, YouTube, content-grid sites, article sites, and shopping sites still load;
- ensure rule IDs remain unique across rulesets.

## DOM-filter changes

Do not scan or hide every generic container. Candidate detection must remain conservative and must protect video players, navigation, forms, controls, comments, grids, galleries, and same-site content cards.
