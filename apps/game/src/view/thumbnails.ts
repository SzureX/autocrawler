import {
  AmbientLight,
  Box3,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { ModelLibrary } from './models';

/**
 * Renders a small picture of every listed model (data URLs, transparent background) with one
 * temporary offscreen renderer. Models that are not loaded are skipped.
 */
export function renderThumbnails(
  models: ModelLibrary,
  keys: readonly string[],
  size = 96,
): Record<string, string> {
  const result: Record<string, string> = {};
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 0.8));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);

  for (const key of keys) {
    const model = models.create(key, false);
    if (!model) continue;
    scene.add(model);
    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    const radius = box.getSize(new Vector3()).length() / 2;
    const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.05;
    camera.position
      .copy(center)
      .add(new Vector3(0.9, 0.8, 1.1).normalize().multiplyScalar(distance));
    camera.lookAt(center);
    renderer.render(scene, camera);
    result[key] = renderer.domElement.toDataURL('image/png');
    scene.remove(model);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return result;
}
