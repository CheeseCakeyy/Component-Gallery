/** A single cover transform, shared by camera, layers and pointer coordinates.
 * Public UVs are normalized image coordinates: (0,0) at top-left.
 */
export class CoordinateMapper {
  constructor(imageWidth, imageHeight) {
    this.aspect = imageWidth / imageHeight;
    this.resize(1, 1);
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const cover = Math.max(this.width / this.aspect, this.height);
    this.drawWidth = cover * this.aspect;
    this.drawHeight = cover;
    this.offsetX = (this.width - this.drawWidth) / 2;
    this.offsetY = (this.height - this.drawHeight) / 2;
    this.visibleWidth = this.width / cover;
    this.visibleHeight = this.height / cover;
  }

  screenToUV(x, y, out = {}) {
    out.u = (x - this.offsetX) / this.drawWidth;
    out.v = (y - this.offsetY) / this.drawHeight;
    return out;
  }

  uvToScreen(u, v, out = {}) {
    out.x = this.offsetX + u * this.drawWidth;
    out.y = this.offsetY + v * this.drawHeight;
    return out;
  }

  uvToWorld(u, v, out = {}) {
    out.x = (u - 0.5) * this.aspect;
    out.y = 0.5 - v;
    return out;
  }

  applyCamera(camera) {
    camera.left = -this.visibleWidth / 2;
    camera.right = this.visibleWidth / 2;
    camera.top = this.visibleHeight / 2;
    camera.bottom = -this.visibleHeight / 2;
    camera.updateProjectionMatrix();
  }
}
