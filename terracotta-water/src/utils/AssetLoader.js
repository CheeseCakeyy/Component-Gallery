import * as THREE from 'three';

export class AssetLoader {
  constructor() {
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
  }

  texture(path, color = true) {
    const key = `${color}:${path}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, this.loader.loadAsync(path).then(texture => {
        texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        return texture;
      }));
    }
    return this.cache.get(key);
  }

  async environment(config) {
    const [image, mask] = await Promise.all([
      this.texture(config.image), this.texture(config.waterMask, false),
    ]);
    const width = image.image.width, height = image.image.height;
    if (mask.image.width !== width || mask.image.height !== height) {
      throw new Error('Environment and water mask must have identical pixel dimensions.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(mask.image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;
    return {
      image, mask, width, height,
      sampleMask(u, v) {
        if (u < 0 || v < 0 || u > 1 || v > 1) return 0;
        const x = Math.min(width - 1, Math.floor(u * width));
        const y = Math.min(height - 1, Math.floor(v * height));
        return pixels[(y * width + x) * 4] / 255;
      },
    };
  }

  dispose() {
    for (const texture of this.cache.values()) texture.then(value => value.dispose());
    this.cache.clear();
  }
}
