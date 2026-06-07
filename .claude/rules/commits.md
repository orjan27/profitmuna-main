# Commits and Branches

- Use Conventional Commits: `type(scope): subject`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.
- Subject is imperative and ≤72 characters. Body wraps at 100 columns.
- Branch names: `feature/<short-slug>`, `fix/<short-slug>`, `chore/<short-slug>`.
- Do not commit directly to `main`. Open a PR.
- Do not amend or force-push commits that have been pushed to a shared branch.
- One logical change per commit. Split unrelated work across commits.
- Never commit secrets, credentials, `.env*` files, or large binaries.
