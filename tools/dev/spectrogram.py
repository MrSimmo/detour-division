# Dev helper (docs/lessons/audio-verification.md): log-frequency spectrogram of a mono 16-bit WAV, as a PNG.
# Usage: python3 tools/dev/spectrogram.py <in.wav> <out.png>   (needs numpy and Pillow)
import sys, wave, numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
w = wave.open(src); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
n, hop = 4096, 512
frames = [x[i:i+n] * np.hanning(n) for i in range(0, len(x) - n, hop)]
S = np.abs(np.fft.rfft(np.array(frames), axis=1)) + 1e-9
freqs = np.fft.rfftfreq(n, 1 / sr)
bins = np.geomspace(40, 8000, 360)
idx = np.searchsorted(freqs, bins)
L = 20 * np.log10(S[:, idx]); L = np.clip((L - L.max() + 70) / 70, 0, 1)
img = (np.flipud(L.T) * 255).astype(np.uint8)
Image.fromarray(img).resize((min(1600, img.shape[1] * 2), 360 * 2)).save(dst)
print(dst, img.shape)
