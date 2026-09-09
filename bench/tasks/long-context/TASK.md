`src/` holds forty small modules, each exporting one function. Three of them read a config key,
`legacyMode`, from `config.cjs`.

Remove `legacyMode` from `config.cjs` and from every place in `src/` that reads it. The three
modules that used it must keep behaving exactly the way they do today.

When you are done, running:

    node --test test/all.test.cjs

must exit 0.
