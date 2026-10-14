"""Generate the tileable grayscale textures in public/textures (mean ~128).

    python scripts/textures.py

Needs numpy and Pillow. Output is deterministic.
"""
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'textures'
rng = np.random.default_rng(11)


def spectral(n, fmin, fmax):
    """Tileable band-passed noise, built in the frequency domain."""
    fx = np.fft.fftfreq(n)[None, :]
    fy = np.fft.fftfreq(n)[:, None]
    f = np.sqrt(fx ** 2 + fy ** 2)
    centre = np.log((fmin * fmax) ** 0.5)
    width = np.log(fmax / fmin) / 2.5
    band = np.exp(-((np.log(f + 1e-9) - centre) ** 2) / (2 * width ** 2))
    spec = (rng.normal(size=(n, n)) + 1j * rng.normal(size=(n, n))) * band
    spec[0, 0] = 0
    img = np.real(np.fft.ifft2(spec))
    return (img - img.mean()) / (img.std() + 1e-9)


def save(arr, name, contrast):
    a = np.clip(128 + arr / arr.std() * contrast, 0, 255).astype(np.uint8)
    Image.fromarray(a, 'L').save(OUT / name, optimize=True)


OUT.mkdir(parents=True, exist_ok=True)

# Card stock: the dimpled "linen" emboss of casino cards, lit from the top-left.
n = 256
period = 4.0
y, x = np.mgrid[0:n, 0:n].astype(float)
k = 2 * np.pi * round(n / period) / n  # whole periods per tile so it repeats seamlessly
height = np.cos(k * x) * np.cos(k * y) + 0.6 * spectral(n, 0.12, 0.45)
gx = np.roll(height, -1, 1) - np.roll(height, 1, 1)
gy = np.roll(height, -1, 0) - np.roll(height, 1, 0)
shade = -(0.75 * gx + 0.35 * gy)
save(shade / shade.std() + 0.25 * spectral(n, 0.02, 0.1), 'linen.png', 30)

# Backdrop: fine photographic grain with a little low-frequency unevenness.
save(spectral(256, 0.25, 0.5) + 0.2 * spectral(256, 0.01, 0.04), 'grain.png', 22)
print(f'wrote {OUT}')
