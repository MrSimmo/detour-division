Playwright's WebKit can't test offline with `setOffline()` or `route().abort()` (the navigation fails before the service worker answers), so R-PWA-1 stops a private preview server instead.

- Before each reload, wait for the page to finish booting (the splash appears). Otherwise the reload cancels in-flight atlas fetches, which show up as failed requests.
- Give each private server a fresh OS-assigned port. Reusing a port straight after its server died left WebKit hanging on `goto`.
- Stop private servers in `finally`, or a failed test leaks one.
- Service workers are blocked in every other spec (`playwright.config.ts`): a controlling worker sits between `page.route()` and the network.
