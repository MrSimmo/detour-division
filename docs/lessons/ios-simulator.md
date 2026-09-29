`xcrun simctl` can open URLs, take screenshots and terminate Safari, but it can't tap. Drive the game with the `?e2e` hooks and use screenshots as evidence.

- Useful URLs: `?e2e&diag=1&auto=z1-01` (plays 3 waves, then pauses; the badge shows the error count); `?e2e&auto=title&ios=0` (skips the splash and the iOS explainer).
- Serve the build with `node node_modules/vite/bin/vite.js preview --host --port <p>`. The Simulator can reach `localhost`, which counts as a secure context, so the service worker runs.
- **Updates take two launches:** one to install the new worker, and a cold launch (`simctl terminate`, then `openurl`) to apply it.
- `simctl` may try to install a system package that needs an administrator password. Without one it fails harmlessly; don't retry it.
- Don't script clicks through System Events or osascript: the call can hang on a macOS permission prompt.
- iOS 26 Safari keeps Share inside its ⋯ menu.
