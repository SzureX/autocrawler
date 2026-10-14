import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three';

/** Placeholder body of a unit: a primitive standing on the floor. Real models replace these later. */
export interface Shape {
  geometry: BufferGeometry;
  /** Height of the body, used to place labels and bars above it. */
  height: number;
}

/** Shared primitive geometries, one per monster id. */
export class ShapeCache {
  private shapes: Record<string, Shape> = {};

  get(monsterId: string): Shape {
    const cached = this.shapes[monsterId];
    if (cached) return cached;
    const shape = ShapeCache.build(monsterId);
    this.shapes[monsterId] = shape;
    return shape;
  }

  private static build(id: string): Shape {
    switch (id) {
      case 'hero':
        return { geometry: new CapsuleGeometry(0.28, 0.5, 4, 12), height: 1.05 };
      case 'rat':
        return { geometry: new SphereGeometry(0.28, 14, 10).scale(1.2, 0.8, 1.4), height: 0.5 };
      case 'skeleton':
        return { geometry: new BoxGeometry(0.5, 1.0, 0.4), height: 1.0 };
      case 'archer':
        return { geometry: new ConeGeometry(0.34, 1.0, 12), height: 1.0 };
      case 'brute':
        return { geometry: new BoxGeometry(0.85, 1.1, 0.7), height: 1.1 };
      case 'warden':
        return { geometry: new CylinderGeometry(0.55, 0.7, 1.5, 16), height: 1.5 };
      default:
        return { geometry: new BoxGeometry(0.6, 0.8, 0.6), height: 0.8 };
    }
  }

  dispose(): void {
    for (const s of Object.values(this.shapes)) s.geometry.dispose();
    this.shapes = {};
  }
}

/** Text/emoji rendered to a canvas texture (labels and floating numbers), cached by content. */
export class TextureCache {
  private textures: Record<string, CanvasTexture> = {};
  private count = 0;

  get(text: string, px: number, color = '#ffffff'): CanvasTexture {
    const key = `${px}|${color}|${text}`;
    const cached = this.textures[key];
    if (cached) return cached;
    if (this.count > 300) this.dispose(); // floating numbers repeat, so this rarely triggers
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `bold ${px}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(text, size, size / 2);
      ctx.fillStyle = color;
      ctx.fillText(text, size, size / 2);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    this.textures[key] = texture;
    this.count++;
    return texture;
  }

  dispose(): void {
    for (const t of Object.values(this.textures)) t.dispose();
    this.textures = {};
    this.count = 0;
  }
}
