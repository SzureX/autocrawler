import { Box3, LoadingManager, Object3D, Vector3, type AnimationClip, type Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/** glTF files live in `public/models` (served as-is, no network needed at runtime). */
const ROOT = `${import.meta.env.BASE_URL}models/`;

/**
 * Model files by view id. Unit ids are monster/boss ids, `hero` is the player; keys starting with
 * `floor:`, `wall:` and `door:` are room pieces. Units without an entry keep their placeholder.
 */
export const MODEL_FILES: Record<string, string> = {
  hero: 'characters/warrior/Knight.glb',
  skeleton: 'enemies/skeleton/Skeleton_Warrior.glb',
  'weapon:hero': 'items/knight_sword_1handed.gltf',
  'weapon:skeleton': 'items/Skeleton_Axe.gltf',
  'prop:chest': 'environment/props/chest.obj',
  'prop:chest_lid': 'environment/props/chest_lid.obj',
  'prop:chest_gold': 'environment/props/chest_gold.obj',
  'floor:stone': 'environment/floors/floor_tile_small.gltf',
  'floor:stone_broken_a': 'environment/floors/floor_tile_small_broken_A.gltf',
  'floor:stone_broken_b': 'environment/floors/floor_tile_small_broken_B.gltf',
  'floor:stone_decorated': 'environment/floors/floor_tile_small_decorated.gltf',
  'floor:stone_weeds_a': 'environment/floors/floor_tile_small_weeds_A.gltf',
  'floor:stone_weeds_b': 'environment/floors/floor_tile_small_weeds_B.gltf',
  'floor:grate': 'environment/floors/floor_tile_grate.gltf',
  'floor:wood': 'environment/floors/floor_wood_small.gltf',
  'floor:wood_dark': 'environment/floors/floor_wood_small_dark.gltf',
  'floor:dirt_a': 'environment/floors/floor_dirt_small_A.gltf',
  'floor:dirt_b': 'environment/floors/floor_dirt_small_B.gltf',
  'floor:dirt_c': 'environment/floors/floor_dirt_small_C.gltf',
  'floor:dirt_d': 'environment/floors/floor_dirt_small_D.gltf',
  'wall:arched': 'environment/walls/wall_arched.gltf',
  'wall:plain': 'environment/walls/wall_gated.gltf',
  'wall:half': 'environment/walls/wall_half.gltf',
  'wall:pillar': 'environment/walls/wall_pillar.gltf',
  'wall:window': 'environment/walls/wall_window_closed.gltf',
  'wall:corner': 'environment/walls/wall_corner.gltf',
  'door:doorway': 'environment/doors/wall_doorway.gltf',
};

/** Animation packs of the shared `Rig_Medium` skeleton (Knight and Skeleton use the same rig). */
const ANIMATION_FILES = [
  'characters/Rig_Medium/Rig_Medium_General.glb',
  'characters/Rig_Medium/Rig_Medium_MovementBasic.glb',
];

/** The shared dungeon texture sits in its own folder; the .gltf files ask for it next to them. */
const SHARED_TEXTURES: Record<string, string> = {
  'dungeon_texture.png': 'environment/textures/dungeon_texture.png',
};

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LoadedModel {
  scene: Object3D;
  min: Vec3;
  max: Vec3;
  /** Height of the model in its own units (used to place labels and bars). */
  height: number;
}

/** Loads and caches the glTF models; `create` hands out independent copies. */
export class ModelLibrary {
  private readonly models: Record<string, LoadedModel> = {};
  private readonly clips: Record<string, AnimationClip> = {};

  /** Loads every listed model; one that fails to load is skipped (its placeholder stays). */
  /** Adds models to the library's file table (used by the room builder's asset catalogue). */
  register(entries: Record<string, string>): void {
    Object.assign(this.files, entries);
  }

  /**
   * Loads the listed models (default: the game's own table) and, unless switched off, the shared
   * animation packs. Every id is fetched once; one that fails to load is skipped (placeholder).
   */
  async load(
    ids: readonly string[] = Object.keys(MODEL_FILES),
    options: { animations?: boolean } = {},
  ): Promise<void> {
    const loader = this.loader();
    const jobs: Promise<void>[] = [];
    if (options.animations ?? true)
      jobs.push(this.once('animations', () => this.fetchClips(loader)));
    for (const id of ids) jobs.push(this.once(`model:${id}`, () => this.fetchModel(loader, id)));
    await Promise.all(jobs);
  }

  private readonly files: Record<string, string> = { ...MODEL_FILES };
  private readonly inFlight: Record<string, Promise<void>> = {};
  private gltfLoader: GLTFLoader | null = null;
  private readonly manager = new LoadingManager();

  private once(key: string, job: () => Promise<void>): Promise<void> {
    return (this.inFlight[key] ??= job());
  }

  private loader(): GLTFLoader {
    if (this.gltfLoader) return this.gltfLoader;
    const manager = this.manager;
    manager.setURLModifier((url) => {
      const name = url.split('/').pop() ?? url;
      const shared = SHARED_TEXTURES[name];
      return shared ? `${ROOT}${shared}` : url;
    });
    this.gltfLoader = new GLTFLoader(manager);
    return this.gltfLoader;
  }

  private async fetchClips(loader: GLTFLoader): Promise<void> {
    await Promise.all(
      ANIMATION_FILES.map(async (file) => {
        try {
          const gltf = await loader.loadAsync(`${ROOT}${file}`);
          for (const clip of gltf.animations) this.clips[clip.name] = clip;
        } catch (error) {
          console.warn(`Animations ${file} failed to load, units will not animate`, error);
        }
      }),
    );
  }

  private async fetchModel(loader: GLTFLoader, id: string): Promise<void> {
    const file = this.files[id];
    if (!file) return;
    try {
      const scene = file.endsWith('.obj')
        ? await this.loadObj(`${ROOT}${file}`)
        : (await loader.loadAsync(`${ROOT}${file}`)).scene;
      const box = new Box3().setFromObject(scene);
      const size = box.getSize(new Vector3());
      this.models[id] = {
        scene,
        height: size.y,
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z },
      };
    } catch (error) {
      console.warn(`Model ${id} (${file}) failed to load, using a placeholder`, error);
    }
  }

  /** Loads an OBJ with its MTL (the texture named in the MTL sits next to the files). */
  private async loadObj(url: string): Promise<Object3D> {
    const dir = url.slice(0, url.lastIndexOf('/') + 1);
    const stem = url.slice(dir.length, -'.obj'.length);
    const materials = await new MTLLoader(this.manager).setPath(dir).loadAsync(`${stem}.mtl`);
    materials.preload();
    return new OBJLoader(this.manager)
      .setMaterials(materials)
      .setPath(dir)
      .loadAsync(`${stem}.obj`);
  }

  /** Bounding box of a loaded model in its own units (zeros when it is not loaded). */
  bounds(id: string): { min: Vec3; max: Vec3 } {
    const m = this.models[id];
    return m
      ? { min: m.min, max: m.max }
      : { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }

  /** A loaded animation by its clip name (e.g. `Idle_A`), or undefined. */
  clip(name: string): AnimationClip | undefined {
    return this.clips[name];
  }

  /** Names of every loaded animation clip, sorted. */
  clipNames(): string[] {
    return Object.keys(this.clips).sort();
  }

  /** Puts the unit's weapon model (`weapon:<id>`) into the right hand bone, when both exist. */
  attachWeapon(unit: Object3D, id: string): void {
    const weapon = this.create(`weapon:${id}`);
    // GLTFLoader strips dots from node names, so `handslot.r` arrives as `handslotr`.
    const slot = unit.getObjectByName('handslotr') ?? unit.getObjectByName('handslot.r');
    if (weapon && slot) slot.add(weapon);
  }

  has(id: string): boolean {
    return id in this.models;
  }

  height(id: string): number {
    return this.models[id]?.height ?? 0;
  }

  /**
   * A fresh copy (skinned models are cloned with their skeleton). Units get their own materials so
   * a hit flash does not light up every copy; static room pieces share them.
   */
  create(id: string, ownMaterials = true): Object3D | null {
    const model = this.models[id];
    if (!model) return null;
    const copy = cloneSkinned(model.scene);
    copy.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!ownMaterials) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    });
    return copy;
  }
}

/** One library for the whole app: the files are fetched once, every raid just clones them. */
export const sharedModels = new ModelLibrary();
