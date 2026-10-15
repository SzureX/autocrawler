import {
  AnimationMixer,
  Color,
  CircleGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { sharedModels } from './models';

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 680;
/** The shown model is scaled to this height (scene units). */
const SHOWN_HEIGHT = 2.4;

/** Standalone Three.js view that shows one unit model with its weapon and plays its animations. */
export class ModelViewerCanvas {
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(40, VIEW_WIDTH / VIEW_HEIGHT, 0.1, 50);
  private readonly models = sharedModels;
  private readonly pivot = new Group();
  private mixer: AnimationMixer | null = null;
  private current: Object3D | null = null;
  private lastTime: number | null = null;
  private destroyed = false;
  private dragging = false;

  constructor(private readonly host: HTMLElement) {
    this.scene.background = new Color(0x14161c);
    this.scene.add(new HemisphereLight(0xffffff, 0x445066, 1.6));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 6, 4);
    sun.castShadow = true;
    this.scene.add(sun);
    const floor = new Mesh(
      new CircleGeometry(2.2, 48),
      new MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.scene.add(this.pivot);
    this.camera.position.set(0, 1.9, 5.4);
    this.camera.lookAt(0, 1.2, 0);
  }

  /** Creates the renderer, loads the unit models and starts the render loop. */
  async init(ids: readonly string[]): Promise<void> {
    if (this.destroyed) return;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.setSize(VIEW_WIDTH, VIEW_HEIGHT);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    this.host.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.bindDrag(renderer.domElement);
    await this.models.load([...ids, ...ids.map((id) => `weapon:${id}`)]);
    if (this.destroyed) return;
    renderer.setAnimationLoop((time) => this.frame(time));
  }

  /** Names of every animation clip available (empty until the models are loaded). */
  clipNames(): string[] {
    return this.models.clipNames();
  }

  /** Shows the model with this id (`hero`, `skeleton`); false when it is not loaded. */
  show(id: string): boolean {
    if (this.current) this.pivot.remove(this.current);
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.current = null;
    const model = this.models.create(id);
    if (!model) return false;
    model.scale.setScalar(SHOWN_HEIGHT / this.models.height(id));
    this.models.attachWeapon(model, id);
    this.pivot.add(model);
    this.current = model;
    this.mixer = new AnimationMixer(model);
    this.play('Idle_A');
    return true;
  }

  /** Plays a clip in a loop (blending from the previous one). */
  play(name: string): void {
    const clip = this.models.clip(name);
    if (!clip || !this.mixer) return;
    const next = this.mixer.clipAction(clip);
    this.mixer.stopAllAction();
    next.reset().play();
  }

  destroy(): void {
    this.destroyed = true;
    this.renderer?.setAnimationLoop(null);
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
  }

  /** Dragging with the mouse turns the model around. */
  private bindDrag(el: HTMLElement): void {
    el.addEventListener('pointerdown', () => (this.dragging = true));
    window.addEventListener('pointerup', () => (this.dragging = false));
    window.addEventListener('pointermove', (e) => {
      if (this.dragging) this.pivot.rotation.y += e.movementX * 0.01;
    });
  }

  private frame(time: number): void {
    const dt = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.mixer?.update(dt);
    this.renderer?.render(this.scene, this.camera);
  }
}
