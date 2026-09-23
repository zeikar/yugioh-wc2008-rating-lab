# Agent notes

Start with [README.md](README.md) (setup, scripts, data model). The spec is
[docs/MVP.md](docs/MVP.md), and game facts are in [docs/domain/](docs/domain/).
This file holds only what those don't.

## Changing behavior

- `docs/MVP.md` is the spec. When a change alters what a page shows or how
  ratings are handled, update its section in the same commit. Also update
  README's "What it does" if it describes the feature.

## Verifying

- Run `pnpm typecheck`, `pnpm lint` and `pnpm test` before committing.
  `pnpm test:rules` also needs Java 21+.
- Unit tests cover `src/domain` and `src/data` only. Pages have no tests, so
  check UI changes in the browser.
- For a browser check, don't use `pnpm emulators`: it exports on exit and
  overwrites the owner's `.emulator-data/`. Start the emulators with
  `pnpm exec firebase emulators:start --only auth,firestore --project demo-wc2008`
  instead. Add `--import .emulator-data` to load that data; without
  `--export-on-exit` nothing is written back.
  Start the dev server with `pnpm exec vite --port <port> --strictPort`;
  another project may already hold 5173.
- **Seeding the emulator:** POST documents to
  `http://127.0.0.1:8085/v1/projects/demo-wc2008/databases/(default)/documents/<collection>?documentId=<id>`
  with `Authorization: Bearer owner`. This header bypasses the security rules.
- **Real data:** production Firestore is public-read, so
  `https://firestore.googleapis.com/v1/projects/yugioh-wc2008-rating-lab/databases/(default)/documents/<collection>?pageSize=1000`
  works with no auth. Use `curl -g` because of the parentheses. Each
  document's `fields` can be POSTed to the emulator as-is (`{"fields": ...}`),
  so copy real data there to reproduce a bug. Only read production; never
  write to it.

## Commits

- Commit straight to `main`. The subject is `Area: what changed`, e.g.
  `Duelists: sortable in-game list number column`. Add a body with the why
  when it isn't obvious.
