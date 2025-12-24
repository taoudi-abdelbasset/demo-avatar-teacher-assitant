import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export type AnimationState = 'idle' | 'thinking' | 'talking';

interface AnimationClip {
  name: string;
  clip: THREE.AnimationClip;
  action?: THREE.AnimationAction;
  state: AnimationState;
}

@Injectable({
  providedIn: 'root'
})
export class BodyAnimationLoaderService {
  private avatarModel: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private animationClips: AnimationClip[] = [];
  private currentAction: THREE.AnimationAction | null = null;
  private clock = new THREE.Clock();
  private isLoading = false;
  private isLoaded = false;
  
  private idleAnimations: AnimationClip[] = [];
  private thinkingAnimations: AnimationClip[] = [];
  private talkingAnimations: AnimationClip[] = [];

  // 🎯 INSTANT SWITCH - Only 0.3s crossfade at transition moment
  private crossFadeDuration = 0.3; // Super quick blend

  private animationPaths = {
    idle: [
      '/assets/body-animations/idle/breathing_idle.fbx',
      '/assets/body-animations/idle/standing_idle.fbx',
      '/assets/body-animations/idle/looking_around.fbx'
    ],
    thinking: [
      '/assets/body-animations/thinking/looking_around.fbx'
    ],
    talking: [
      '/assets/body-animations/talking/talking.fbx',
      '/assets/body-animations/talking/explaining.fbx'
    ]
  };

  constructor() {}

  setAvatarModel(model: THREE.Object3D, animations?: THREE.AnimationClip[]) {
    this.avatarModel = model;
    
    if (this.avatarModel) {
      this.mixer = new THREE.AnimationMixer(this.avatarModel);
      console.log('🎬 Animation mixer created');
      
      const bones: string[] = [];
      this.avatarModel.traverse((node: any) => {
        if (node.isBone) {
          bones.push(node.name);
        }
      });
      console.log(`🦴 Found ${bones.length} bones:`, bones.slice(0, 10).join(', '));
    }

    if (animations && animations.length > 0) {
      console.log('✅ Using built-in animations');
      this.loadBuiltInAnimations(animations);
    } else {
      console.log('📦 Loading external FBX animations...');
      this.loadExternalAnimations();
    }
  }

  private loadBuiltInAnimations(clips: THREE.AnimationClip[]) {
    this.animationClips = [];
    this.idleAnimations = [];
    this.thinkingAnimations = [];
    this.talkingAnimations = [];

    clips.forEach((clip: THREE.AnimationClip, index: number) => {
      const name = clip.name.toLowerCase();
      let state: AnimationState = 'idle';
      
      if (name.includes('think') || name.includes('ponder')) {
        state = 'thinking';
      } else if (name.includes('talk') || name.includes('speak')) {
        state = 'talking';
      }

      const animClip: AnimationClip = {
        name: clip.name,
        clip: clip,
        state: state
      };

      this.animationClips.push(animClip);

      if (state === 'idle') this.idleAnimations.push(animClip);
      else if (state === 'thinking') this.thinkingAnimations.push(animClip);
      else if (state === 'talking') this.talkingAnimations.push(animClip);

      console.log(`📋 Animation ${index}: "${clip.name}" (${clip.duration.toFixed(2)}s)`);
    });

    this.isLoaded = true;
    this.logAnimationStats();
  }

  private async loadExternalAnimations() {
    if (this.isLoading || this.isLoaded) return;
    this.isLoading = true;

    const loader = new FBXLoader();
    const loadPromises: Promise<void>[] = [];

    this.animationPaths.idle.forEach(path => {
      const promise = this.loadAnimation(loader, path, 'idle');
      loadPromises.push(promise);
    });

    this.animationPaths.thinking.forEach(path => {
      const promise = this.loadAnimation(loader, path, 'thinking');
      loadPromises.push(promise);
    });

    this.animationPaths.talking.forEach(path => {
      const promise = this.loadAnimation(loader, path, 'talking');
      loadPromises.push(promise);
    });

    await Promise.all(loadPromises);
    
    this.isLoaded = true;
    this.isLoading = false;
    this.logAnimationStats();
  }

  private loadAnimation(loader: FBXLoader, path: string, state: AnimationState): Promise<void> {
    return new Promise((resolve) => {
      loader.load(
        path,
        (fbx) => {
          if (fbx.animations && fbx.animations.length > 0) {
            fbx.animations.forEach((clip) => {
              console.log(`📊 Original FBX: ${clip.name} (${clip.duration.toFixed(2)}s, ${clip.tracks.length} tracks)`);
              
              const retargetedClip = this.retargetAnimation(clip);
              
              const animClip: AnimationClip = {
                name: path.split('/').pop()?.replace('.fbx', '') || 'unknown',
                clip: retargetedClip,
                state: state
              };

              this.animationClips.push(animClip);

              if (state === 'idle') this.idleAnimations.push(animClip);
              else if (state === 'thinking') this.thinkingAnimations.push(animClip);
              else if (state === 'talking') this.talkingAnimations.push(animClip);

              console.log(`✅ Loaded & retargeted ${state} animation: ${animClip.name}`);
            });
          }
          resolve();
        },
        undefined,
        (error) => {
          console.warn(`⚠️ Failed to load animation ${path}:`, error);
          resolve();
        }
      );
    });
  }

  private retargetAnimation(clip: THREE.AnimationClip): THREE.AnimationClip {
    const newTracks = clip.tracks
      .filter(track => {
        if (track.name.includes('.position')) {
          console.log(`❌ Removed position track: ${track.name}`);
          return false;
        }
        return true;
      })
      .map(track => {
        const newTrack = track.clone();
        newTrack.name = track.name.replace('mixamorig', '');
        return newTrack;
      });

    const retargetedClip = new THREE.AnimationClip(clip.name, clip.duration, newTracks);
    console.log(`✅ Retargeted to ${newTracks.length} tracks (rotations only)`);
    
    return retargetedClip;
  }

  private logAnimationStats() {
    console.log(`🎬 Animation Summary:`);
    console.log(`   Total: ${this.animationClips.length}`);
    console.log(`   Idle: ${this.idleAnimations.length}`);
    console.log(`   Thinking: ${this.thinkingAnimations.length}`);
    console.log(`   Talking: ${this.talkingAnimations.length}`);
  }

  playRandomAnimation(state: AnimationState, loop: boolean = true) {
    if (!this.mixer) {
      console.warn('⚠️ No animation mixer available');
      return;
    }

    if (!this.isLoaded) {
      console.log('⏳ Animations still loading...');
      return;
    }

    let availableAnimations: AnimationClip[] = [];
    
    switch (state) {
      case 'idle':
        availableAnimations = this.idleAnimations;
        break;
      case 'thinking':
        availableAnimations = this.thinkingAnimations.length > 0 
          ? this.thinkingAnimations 
          : this.idleAnimations;
        break;
      case 'talking':
        availableAnimations = this.talkingAnimations.length > 0 
          ? this.talkingAnimations 
          : this.idleAnimations;
        break;
    }

    if (availableAnimations.length === 0) {
      console.log(`⚠️ No animations for state: ${state}`);
      return;
    }

    const randomAnim = availableAnimations[Math.floor(Math.random() * availableAnimations.length)];

    // 🎯 INSTANT SWITCH - Quick 0.3s crossfade ONLY at transition
    if (this.currentAction) {
      const newAction = this.mixer.clipAction(randomAnim.clip);
      
      // Quick crossfade at transition moment
      this.currentAction.crossFadeTo(newAction, this.crossFadeDuration, true);
      
      newAction.reset();
      newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      newAction.clampWhenFinished = false;
      newAction.enabled = true;
      newAction.setEffectiveTimeScale(1);
      newAction.setEffectiveWeight(1);
      newAction.play();
      
      this.currentAction = newAction;
      
      console.log(`🎭 Switching to ${state}: "${randomAnim.name}" (${this.crossFadeDuration}s blend)`);
    } else {
      // First animation - start immediately
      const action = this.mixer.clipAction(randomAnim.clip);
      action.reset();
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      action.clampWhenFinished = false;
      action.play();
      
      this.currentAction = action;
      console.log(`🎭 Starting ${state}: "${randomAnim.name}"`);
    }
  }

  playAnimation(name: string, loop: boolean = true) {
    if (!this.mixer) return;

    const animData = this.animationClips.find(a => a.name === name);
    if (!animData) {
      console.warn(`⚠️ Animation not found: ${name}`);
      return;
    }

    if (this.currentAction) {
      const newAction = this.mixer.clipAction(animData.clip);
      this.currentAction.crossFadeTo(newAction, this.crossFadeDuration, true);
      
      newAction.reset();
      newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      newAction.clampWhenFinished = false;
      newAction.enabled = true;
      newAction.setEffectiveTimeScale(1);
      newAction.setEffectiveWeight(1);
      newAction.play();
      
      this.currentAction = newAction;
    } else {
      const action = this.mixer.clipAction(animData.clip);
      action.reset();
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      action.clampWhenFinished = false;
      action.play();
      
      this.currentAction = action;
    }
    
    console.log(`🎭 Playing: "${name}"`);
  }

  stopAnimation() {
    if (this.currentAction) {
      this.currentAction.fadeOut(this.crossFadeDuration);
      setTimeout(() => {
        if (this.currentAction) {
          this.currentAction.stop();
          this.currentAction = null;
        }
      }, this.crossFadeDuration * 1000);
    }
  }

  update() {
    if (this.mixer) {
      const delta = this.clock.getDelta();
      this.mixer.update(delta);
    }
  }

  getAvailableAnimations(): string[] {
    return this.animationClips.map(a => a.name);
  }

  hasAnimations(): boolean {
    return this.animationClips.length > 0;
  }

  isReady(): boolean {
    return this.isLoaded;
  }
}