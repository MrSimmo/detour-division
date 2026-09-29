# Device checklist (DESIGN.md §23.4)

What's left to check on devices, and how. Everything that URLs and screenshots can reach has been done in the iOS Simulator. The results are in PROGRESS.md (M5, 2026-09-25).

## Already verified in the iOS Simulator

| Check | Device | Result |
|---|---|---|
| Loads and plays 3 waves, with 0 errors | iPad Pro 11-inch (M5), iOS 26.5 | Yes |
| Loads with the server stopped, from the service worker | iPad Pro 11-inch | Yes |
| An update installed in the background applies at the next cold launch | iPad Pro 11-inch | Yes |
| After `simctl terminate` and relaunch, the title offers "Resume Primrose Lane, wave 3" | iPad Pro 11-inch | Yes |
| The Add to Home Screen explainer appears in Safari (real iPadOS detection) | iPad Pro 11-inch | Yes |
| The rotate prompt shows in portrait | iPhone 16e (iOS 26.2), iPhone 17 Pro Max (iOS 26.5) | Yes |

## Still to do by hand (each needs a tap)

**Set-up:**
1. Run `npm run build && npx vite preview --host` in the project folder. Note the "Network" URL it prints, such as `http://192.168.x.x:4173/`.
2. Open Xcode's Simulator, choose an iPhone 16e, and open that URL in Safari.

**Checks:**

| # | Step | Expected |
|---|---|---|
| 1 | Safari's ⋯ menu → Share → **Add to Home Screen** | The icon is the brass U-turn arrow on grass, titled "Detour Div." |
| 2 | Stop the preview server, then launch from the Home Screen icon | The game opens full screen, offline |
| 3 | Rotate to landscape (⌘→). Tap **Tap to start** | The menu theme plays |
| 4 | Play Primrose Lane for 3 waves | Tower fire, pops and coins are all audible; nothing crackles |
| 5 | Pinch the field to zoom and drag to pan; double-tap to reset | Smooth, and the map stays in bounds |
| 6 | Drag a tower from the build bar | The ghost sits above your finger (the offset is in Settings → Display) |
| 7 | Swipe the app away, then relaunch from the icon | "Resume *Level*, wave N" is offered |
| 8 | Safari → Develop → Simulator → the page, then look at the console | No errors |

Repeat 3–6 on an iPad in both orientations.

## v1.2 phone layout (an iPhone in Safari, landscape)

Checked here in Playwright's emulation at 874×378 (and 874×334 with Safari's toolbar showing), not on the device. Open the dev server's LAN address as before.

| # | Step | Expected |
|---|---|---|
| 1 | The title, Settings (all three tabs), Saves and the field guide | Text comfortably readable; nothing runs off the screen or needs scrolling |
| 2 | Play → the world map. Pinch in and out, drag with one finger | Zooms out to the whole map and back in; a drag that starts on a medallion moves the map without opening the level |
| 3 | Start Treacle Tart Farm (its entrance is at the top) | The HUD is a column on the left, the build bar a column on the right, and the whole map, entrance included, is uncovered |
| 4 | Build a tower and tap it, once on each side of the map | The panel opens beside the map on the side away from the tower, and fits the height |
| 5 | Lose or win a level | The result card is readable |

## Physical Android phone (Chrome)

1. With the preview server running on your network, open the Network URL in Chrome.
2. Install it (menu → Install app).
3. Do steps 2–7 above.
4. For step 8, use `chrome://inspect` on a desktop Chrome with the phone connected by USB.

## Also worth a listen

Nobody has heard the music or the SFX yet. They were checked by render levels, tuning and spectrograms. The title theme, a Zone 1 level, a boss arrival and the victory fanfare make a quick tour. Settings → Sound has the volumes. Any sound can be replaced by a recording through `public/assets/audio.json` (DESIGN.md §17.1).

## v1.3 fixes (a phone and a desktop browser)

| # | Step | Expected |
|---|---|---|
| 1 | On the desktop, open `http://localhost:5173/` in a WebGPU-capable browser (not the LAN address). Settings → Display | WebGPU can be chosen. On the LAN address it stays greyed out, because that address is plain http |
| 2 | On the phone (LAN address), long-press WebGPU in Settings → Display | A tooltip says WebGPU needs a secure (https) address |
| 3 | The world map, zoomed into Mount Kerblam | The volcano stands in the land; its lava runs in one line from the crater to the sea; the smoke isn't cut off |
| 4 | Any Zone 1 level: the trees round the edge | Every trunk runs up into its leaves |
| 5 | Primrose Lane: the entrance and exit | The grassy lane runs into the field with no line; bushes round off the hedge corners |
| 6 | Primrose Lane: start the first wave and watch the entrance, then let one through | The soldiers march in from off screen down the lane (on the phone, out from under the HUD column), and a leaker walks off down the exit lane |

## v1.4 lanes (a desktop browser and a phone)

| # | Step | Expected |
|---|---|---|
| 1 | In a desktop browser, a level whose road runs across the screen (Primrose Lane, Kettle Crossing): start the first wave and watch the entrance | The soldiers march in from the window's left edge, not from partway down the lane. They reach the field about 4 s after Start |
| 2 | Let one through | It walks on down the exit lane, behind the build bar and off the right edge. Lives drop as it passes about 2¾ cells beyond the hedge |
| 3 | Make the window much wider than it is tall (about 2.5:1) | Each lane ends in the forest: soldiers step out from under the trees, and leakers walk in under them |
| 4 | On the phone, the same level | They come out from under the HUD column and leave behind the build bar |
