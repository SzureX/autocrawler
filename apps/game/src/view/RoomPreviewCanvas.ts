import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { gameData } from '../store/gameStore';
import { builderFiles, propFiles } from './builderCatalog';
import { sharedModels } from './models';
import { RoomStage } from './roomStage';
import { showRoom, type RoomLook } from './roomShow';

const PITCH_DEG = 48;
const FOV = 35;
/** Half the diagonal of a room with its walls: the camera keeps this sphere in view. */
const ROOM_RADIUS = 7.2;

/**
 * A small live picture of one room, the same 3D room the raid plays in, seen from the raid's angle
 * Used on the tile cards.
 */
export class RoomPreviewCanvas {
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly stage = new RoomStage(gameData.balance.combat.board);
  private readonly models = sharedModels;
  private destroyed = false;
  private lastRender = -1e9;

  constructor(
    private readonly host: HTMLElement,
    private readonly width: number,
    private readonly height: number,
  ) {
    this.camera = new PerspectiveCamera(FOV, width / height, 0.5, 200);
    this.scene.background = new Color(0x161922);
    this.scene.add(this.stage.group);
  }

  async init(look: RoomLook): Promise<void> {
    if (this.destroyed) return;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.setSize(this.width, this.height);
    this.host.appendChild(renderer.domElement);
    this.renderer = renderer;
    await this.models.load();
    if (this.destroyed) return;
    this.models.register({ ...builderFiles(), ...propFiles() });
    this.stage.applyModels(this.models);
    showRoom(this.stage, this.models, look, () => !this.destroyed);
    renderer.setAnimationLoop((time) => this.frame(time));
  }

  destroy(): void {
    this.destroyed = true;
    this.renderer?.setAnimationLoop(null);
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
    this.renderer = null;
  }

  /** The picture stands still; it is redrawn now and then (the room's pieces may still arrive). */
  private frame(time: number): void {
    if (time - this.lastRender < 250) return;
    this.lastRender = time;
    const pitch = (PITCH_DEG * Math.PI) / 180;
    const distance = (ROOM_RADIUS / Math.sin((FOV * Math.PI) / 360)) * 0.92;
    this.camera.position.set(0, Math.sin(pitch) * distance + 0.3, Math.cos(pitch) * distance);
    this.camera.lookAt(0, 0.3, 0);
    this.renderer?.render(this.scene, this.camera);
  }
}
