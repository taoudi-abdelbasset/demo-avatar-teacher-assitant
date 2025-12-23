import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type BodyAnimationState = 'idle' | 'thinking' | 'talking';

@Injectable({
  providedIn: 'root'
})
export class BodyAnimationLoaderService {
  private mixer: THREE.AnimationMixer | null = null;
  private currentAction: THREE.AnimationAction | null = null;
  private clock = new THREE.Clock();
  private avatarModel: any = null;
  private animationCache = new Map<string, THREE.AnimationClip>();

  // Animation file paths - YOU CAN USE FBX OR GLB!
  private animationPaths = {
    idle: [
      '/assets/body-animations/idle/breathing_idle.fbx',
      '/assets/body-animations/idle/standing_idle.fbx',
      '/assets/body-animations/idle/looking_around.fbx'
    ],
    thinking: [
    ],
    talking: [
      '/assets/body-animations/talking/talking.fbx',
      '/assets/body-animations/talking/explaining.fbx'
    ]
  };

  setAvatarModel(model: any) {
    this.avatarModel = model;
    this.mixer = new THREE.AnimationMixer(model);
    console.log('🎬 Animation mixer initialized for body animations');
  }

  /**
   * Play a random animation from the specified category
   */
  async playRandomAnimation(state: BodyAnimationState, loop: boolean = true) {
    if (!this.mixer || !this.avatarModel) {
      console.warn('⚠️ Avatar not ready for animations');
      return;
    }

    // Stop current animation
    this.stop();

    // Select random animation from category
    const animations = this.animationPaths[state];
    const randomIndex = Math.floor(Math.random() * animations.length);
    const selectedPath = animations[randomIndex];

    console.log(`🎭 Loading ${state} animation: ${selectedPath}`);

    try {
      // Load animation
      const clip = await this.loadAnimation(selectedPath);
      
      if (clip) {
        // Play animation
        this.playAnimation(clip, loop);
      } else {
        console.warn('⚠️ No animation clip found, using procedural fallback');
        this.playProceduralAnimation(state);
      }
    } catch (error) {
      console.error('Failed to load animation:', error);
      this.playProceduralAnimation(state);
    }
  }

  /**
   * Load animation from FBX or GLB file
   */
  private async loadAnimation(path: string): Promise<THREE.AnimationClip | null> {
    // Check cache first
    if (this.animationCache.has(path)) {
      return this.animationCache.get(path)!;
    }

    return new Promise((resolve, reject) => {
      const extension = path.split('.').pop()?.toLowerCase();

      if (extension === 'fbx') {
        const loader = new FBXLoader();
        loader.load(
          path,
          (object) => {
            if (object.animations && object.animations.length > 0) {
              const clip = object.animations[0];
              this.animationCache.set(path, clip);
              console.log('✅ Loaded FBX animation:', path);
              resolve(clip);
            } else {
              console.warn('⚠️ No animations in FBX file');
              resolve(null);
            }
          },
          undefined,
          (error) => {
            console.error('Error loading FBX:', error);
            reject(error);
          }
        );
      } else if (extension === 'glb' || extension === 'gltf') {
        const loader = new GLTFLoader();
        loader.load(
          path,
          (gltf) => {
            if (gltf.animations && gltf.animations.length > 0) {
              const clip = gltf.animations[0];
              this.animationCache.set(path, clip);
              console.log('✅ Loaded GLB animation:', path);
              resolve(clip);
            } else {
              console.warn('⚠️ No animations in GLB file');
              resolve(null);
            }
          },
          undefined,
          (error) => {
            console.error('Error loading GLB:', error);
            reject(error);
          }
        );
      } else {
        reject(new Error('Unsupported file format: ' + extension));
      }
    });
  }

  /**
   * Play animation clip
   */
  private playAnimation(clip: THREE.AnimationClip, loop: boolean) {
    if (!this.mixer) return;

    // Create action
    this.currentAction = this.mixer.clipAction(clip);
    
    // Set loop mode
    this.currentAction.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
    this.currentAction.clampWhenFinished = !loop;
    
    // Fade in animation
    this.currentAction.reset();
    this.currentAction.fadeIn(0.5);
    this.currentAction.play();

    console.log('▶️ Playing animation');
  }

  /**
   * Update animation mixer (call this in animation loop)
   */
  update() {
    if (this.mixer) {
      const delta = this.clock.getDelta();
      this.mixer.update(delta);
    }
  }

  /**
   * Stop current animation
   */
  stop() {
    if (this.currentAction) {
      this.currentAction.fadeOut(0.5);
      this.currentAction = null;
    }
  }

  /**
   * Procedural fallback animation if files not available
   */
  private playProceduralAnimation(state: BodyAnimationState) {
    console.log('🔄 Using procedural animation for', state);
    
    // Create simple keyframe animation
    const clip = this.createProceduralClip(state);
    if (clip) {
      this.playAnimation(clip, true);
    }
  }

  /**
   * Create simple procedural animation clip
   */
  private createProceduralClip(state: BodyAnimationState): THREE.AnimationClip | null {
    if (!this.avatarModel) return null;

    // Find spine bone
    const spine = this.avatarModel.getObjectByName('Spine') ||
                  this.avatarModel.getObjectByName('mixamorigSpine');
    
    if (!spine) return null;

    const times = [0, 1, 2];
    let values: number[] = [];

    switch (state) {
      case 'idle':
        // Subtle breathing
        values = [
          0, 0, 0, 1,  // Frame 0: neutral quaternion
          0.02, 0, 0, 0.9998,  // Frame 1: slight forward
          0, 0, 0, 1   // Frame 2: back to neutral
        ];
        break;

      case 'thinking':
        // Head tilt
        values = [
          0, 0, 0, 1,
          0, 0, 0.1, 0.995,
          0, 0, 0, 1
        ];
        break;

      case 'talking':
        // Slight movement
        values = [
          0, 0, 0, 1,
          0, 0.05, 0, 0.999,
          0, 0, 0, 1
        ];
        break;
    }

    const track = new THREE.QuaternionKeyframeTrack(
      spine.name + '.quaternion',
      times,
      values
    );

    return new THREE.AnimationClip('procedural_' + state, 2, [track]);
  }

  /**
   * Clear animation cache
   */
  clearCache() {
    this.animationCache.clear();
  }

  /**
   * Check if animation is currently playing
   */
  isPlaying(): boolean {
    return this.currentAction !== null && this.currentAction.isRunning();
  }
}