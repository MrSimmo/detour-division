Nothing in this project has been checked by ear. Audio is checked by measurement, so measure: levels, pitch, layer balance and spectrograms.

- `node tools/dev/audio-check.ts sfx|music|layers|tuning [filter or /src/… module path] [--wav dir]`, with the dev server on :5173. It flags silence and clipping. `layers` should show L1 (the melody) at or above L0; `tuning` should show every pitched instrument within ±5 cents (the measurement limit).
- `python3 tools/dev/spectrogram.py <wav> <png>` draws a log-frequency spectrogram. It needs numpy and Pillow.
- Instrument levels are calibrated (see the note in `instruments.ts`). Plucked strings get louder as they go lower, so plucked bass lines use a track gain of about 0.7.
- R-AUD-2 needed an output gate as well as `suspend()`: WebKit can resume a context on its own before any gesture.
