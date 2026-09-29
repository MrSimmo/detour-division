In the agent's shell, `node`, `npm` and `npx` are nvm lazy-load functions that recurse until FUNCNEST is exceeded. Unset them and call the binaries directly.

Start each command with:

```sh
unset -f node npm npx 2>/dev/null; B="$HOME/.nvm/versions/node/v24.16.0/bin"; export PATH="$B:$PATH"
```

Then use `"$B/npm" …` or `"$B/npx" …`. Plain `npm` also works once the functions are unset and PATH has been exported. Every Bash call needs this, because shell state does not persist between calls.

This is probably also why the Playwright MCP server failed at session start with "Executable not found in $PATH: npx": nvm's bin directory is not on the PATH that the server inherits. That is not verified. Either way, use the Playwright CLI (`npx playwright`) through the prefix above, which is also the global default.

(Found 2026-09-24. Node 24.16.0 is the only version installed under nvm.)
