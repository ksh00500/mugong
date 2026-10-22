import Phaser from 'phaser';
import { rigPoint, cavalryRigPoint, type RigPose, type MotionAction } from './directional-motion';

const COLS = 8,
  ROWS = 12;
type CanvasMesh = Phaser.GameObjects.Mesh2D & {
  renderCanvas: (
    renderer: Phaser.Renderer.Canvas.CanvasRenderer,
    src: Phaser.GameObjects.Mesh2D,
    camera: Phaser.Cameras.Scene2D.Camera,
    parent?: Phaser.GameObjects.Components.TransformMatrix,
  ) => void;
};
function topology(cols: number, rows: number) {
  const vertices: number[] = [],
    indices: number[] = [];
  for (let y = 0; y <= rows; y++)
    for (let x = 0; x <= cols; x++) vertices.push(x / cols, y / rows, 0, 0);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const a = y * (cols + 1) + x,
        b = a + 1,
        c = a + cols + 1,
        d = c + 1;
      indices.push(a, b, c, 0, b, c, d, 0);
    }
  return { vertices, indices };
}
/** One stable mesh per actor; only its vertex positions/UVs change. */
export class ContinuousActor {
  readonly mesh: Phaser.GameObjects.Mesh2D;
  private readonly cols: number;
  private readonly rows: number;
  constructor(scene: Phaser.Scene, texture: string) {
    const software = scene.game.renderer.type === Phaser.CANVAS;
    this.cols = software ? 4 : COLS;
    this.rows = software ? 6 : ROWS;
    const { vertices, indices } = topology(this.cols, this.rows);
    this.mesh = scene.add.mesh2d(0, 0, texture, vertices, indices).setOrigin(0, 0);
    // Limb deformation makes adjacent cells non-affine. Combining them into
    // optimized quads can tear the UVs when an arm lifts; preserve triangles.
    this.mesh.setRenderAsTriangles(true);
    // Phaser supplies no Mesh2D Canvas renderer. Render the same rig with a smaller
    // triangle grid so software fallback preserves direction and action animation.
    if (software)
      (this.mesh as CanvasMesh).renderCanvas = (renderer, _src, camera, parent) => {
        const ctx = renderer.currentContext;
        if (!Phaser.Renderer.Canvas.SetTransform(renderer, ctx, this.mesh, camera, parent)) return;
        camera.addToRenderList(this.mesh);
        const source = this.mesh.texture.source[0],
          v = this.mesh.vertices;
        const transform = ctx.getTransform();
        // Canvas antialiases every clip edge separately. Exact adjacent triangle
        // clips leave pale seams through the character. Overlap by less than one
        // device pixel; mesh geometry/UVs and the hand attachment stay unchanged.
        const overlap =
          0.45 /
          Math.max(
            0.001,
            Math.hypot(transform.a, transform.b),
            Math.hypot(transform.c, transform.d),
          );
        for (let at = 0; at < indices.length; at += 4) {
          const i = indices[at] * 4,
            j = indices[at + 1] * 4,
            k = indices[at + 2] * 4;
          const u = v[i + 2] * source.width,
            w = (1 - v[i + 3]) * source.height;
          const du1 = v[j + 2] * source.width - u,
            dv1 = (1 - v[j + 3]) * source.height - w;
          const du2 = v[k + 2] * source.width - u,
            dv2 = (1 - v[k + 3]) * source.height - w;
          const det = du1 * dv2 - du2 * dv1;
          if (Math.abs(det) < 0.00001) continue;
          const dx1 = v[j] - v[i],
            dy1 = v[j + 1] - v[i + 1];
          const dx2 = v[k] - v[i],
            dy2 = v[k + 1] - v[i + 1];
          const a = (dx1 * dv2 - dx2 * dv1) / det,
            b = (dy1 * dv2 - dy2 * dv1) / det;
          const c = (du1 * dx2 - du2 * dx1) / det,
            d = (du1 * dy2 - du2 * dy1) / det;
          ctx.save();
          ctx.beginPath();
          const centerX = (v[i] + v[j] + v[k]) / 3,
            centerY = (v[i + 1] + v[j + 1] + v[k + 1]) / 3;
          for (const [n, vertex] of [i, j, k].entries()) {
            const dx = v[vertex] - centerX,
              dy = v[vertex + 1] - centerY;
            const stretch = 1 + overlap / Math.max(0.001, Math.hypot(dx, dy));
            const x = centerX + dx * stretch,
              y = centerY + dy * stretch;
            if (n === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.clip();
          ctx.transform(a, b, c, d, v[i] - a * u - c * w, v[i + 1] - b * u - d * w);
          ctx.drawImage(source.image as CanvasImageSource, 0, 0);
          ctx.restore();
        }
        ctx.restore();
      };
  }
  draw(
    image: Phaser.GameObjects.Image,
    pose: RigPose,
    direction: number,
    action: MotionAction,
    mounted = false,
  ) {
    const mesh = this.mesh,
      frame = image.frame,
      width = image.displayWidth,
      height = image.displayHeight;
    if (mesh.texture !== image.texture) mesh.setTexture(image.texture.key);
    const u0 = frame.u0,
      v0 = frame.v0,
      u1 = frame.u1,
      v1 = frame.v1;
    for (let row = 0; row <= this.rows; row++)
      for (let col = 0; col <= this.cols; col++) {
        const x = col / this.cols,
          y = row / this.rows,
          at = (row * (this.cols + 1) + col) * 4;
        const point = mounted
          ? cavalryRigPoint(x, y, pose, direction)
          : rigPoint(x, y, pose, direction);
        mesh.vertices[at] = (point.x - image.originX) * width;
        mesh.vertices[at + 1] = (point.y - image.originY) * height;
        mesh.vertices[at + 2] = image.flipX ? u1 - x * (u1 - u0) : u0 + x * (u1 - u0);
        mesh.vertices[at + 3] = v0 + y * (v1 - v0);
      }
    mesh
      .setPosition(image.x, image.y)
      .setRotation(image.rotation)
      .setDepth(image.depth)
      .setAlpha(image.alpha)
      .setVisible(true);
    // Mesh2D runtime supports tint; its bundled declaration omits the tint component.
    (mesh as Phaser.GameObjects.Mesh2D & { setTint(color: number): unknown }).setTint(
      image.tintTopLeft,
    );
    mesh.setData({
      direction,
      action,
      mounted,
      frame: image.frame.name,
      texture: image.texture.key,
    });
    image.setVisible(false);
  }
  hide() {
    this.mesh.setVisible(false);
  }
  /** Interpolate the actual rendered triangle, including Canvas's coarser grid.
   * Analytic rigPoint alone is not identical to the piecewise affine mesh.
   */
  localPoint(x: number, y: number) {
    const gx = Math.max(0, Math.min(this.cols - 1e-8, x * this.cols));
    const gy = Math.max(0, Math.min(this.rows - 1e-8, y * this.rows));
    const col = Math.floor(gx),
      row = Math.floor(gy),
      u = gx - col,
      v = gy - row;
    const a = row * (this.cols + 1) + col,
      b = a + 1,
      c = a + this.cols + 1,
      d = c + 1;
    const points =
      u + v <= 1
        ? [
            [a, 1 - u - v],
            [b, u],
            [c, v],
          ]
        : [
            [b, 1 - v],
            [c, 1 - u],
            [d, u + v - 1],
          ];
    const vertices = this.mesh.vertices;
    return points.reduce(
      (p, [at, weight]) => ({
        x: p.x + vertices[at * 4] * weight,
        y: p.y + vertices[at * 4 + 1] * weight,
      }),
      { x: 0, y: 0 },
    );
  }
  destroy() {
    this.mesh.destroy();
  }
}
