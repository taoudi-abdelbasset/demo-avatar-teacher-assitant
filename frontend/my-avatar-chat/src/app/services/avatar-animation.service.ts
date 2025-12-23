import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { BodyAnimationLoaderService } from './body-animation-loader.service';

export type AvatarState = 'idle' | 'thinking' | 'talking';

@Injectable({
  providedIn: 'root'
})
export class AvatarAnimationService {
  private morphTargetMeshes: any[] = [];
  private avatarModel: any = null;
  private animationFrameId: number | null = null;
  private lipSyncData: any[] = [];
  private lipSyncStartTime: number = 0;

  // Avatar state
  private avatarStateSubject = new BehaviorSubject<AvatarState>('idle');
  avatarState$ = this.avatarStateSubject.asObservable();

  // Observable for when avatar is loaded
  private avatarLoadedSubject = new BehaviorSubject<boolean>(false);
  avatarLoaded$ = this.avatarLoadedSubject.asObservable();

  constructor(private bodyAnimationLoader: BodyAnimationLoaderService) {}

  setAvatarData(meshes: any[], model: any) {
    this.morphTargetMeshes = meshes;
    this.avatarModel = model;
    this.avatarLoadedSubject.next(true);
    
    // Initialize body animation loader
    this.bodyAnimationLoader.setAvatarModel(model);
    
    console.log('✅ Avatar data set in service:', meshes.length, 'meshes');
    
    // Start idle animation by default
    this.setAvatarState('idle');
  }

  /**
   * Set avatar state (idle, thinking, talking)
   */
  setAvatarState(state: AvatarState) {
    this.avatarStateSubject.next(state);
    console.log('🎭 Avatar state:', state);
    
    // Play corresponding body animation
    this.bodyAnimationLoader.playRandomAnimation(state, true);
  }

  /**
   * Update body animations (call in animation loop)
   */
  updateBodyAnimations() {
    this.bodyAnimationLoader.update();
  }

  /**
   * Start lip-sync animation with CSV data
   */
  startLipSync(csvData: any[], audioStartTime: number) {
    this.stopLipSync();
    this.lipSyncData = csvData;
    this.lipSyncStartTime = audioStartTime;
    this.setAvatarState('talking');
    this.animateLipSync();
  }

  /**
   * Stop lip-sync animation
   */
  stopLipSync() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.setAvatarState('idle');
    this.resetFace();
  }

  /**
   * Animate lip-sync based on CSV data
   */
  private animateLipSync = () => {
    if (!this.lipSyncData.length) return;

    const currentTime = (performance.now() - this.lipSyncStartTime) / 1000;
    
    // Find the closest frame in CSV data
    const frame = this.lipSyncData.find(f => 
      Math.abs(f.timeCode - currentTime) < 0.033 // ~30fps tolerance
    ) || this.lipSyncData[this.lipSyncData.length - 1];

    if (frame) {
      // Apply blendshapes from CSV
      this.applyCSVBlendshapes(frame);
    }

    // Check if we've reached the end
    if (currentTime < this.lipSyncData[this.lipSyncData.length - 1].timeCode) {
      this.animationFrameId = requestAnimationFrame(this.animateLipSync);
    } else {
      this.stopLipSync();
    }
  }

  /**
   * Apply blendshapes from CSV data
   */
  private applyCSVBlendshapes(frame: any) {
    if (this.morphTargetMeshes.length === 0) return;

    this.morphTargetMeshes.forEach(mesh => {
      const dict = mesh.morphTargetDictionary;
      if (!dict) return;

      // Process each key in the frame
      Object.keys(frame).forEach(csvKey => {
        // Skip non-blendshape keys
        if (!csvKey.startsWith('blendShapes.')) return;
        
        // Convert CSV key to Three.js morph target name
        // "blendShapes.EyeBlinkLeft" -> "eyeBlinkLeft"
        const morphKey = csvKey.replace('blendShapes.', '');
        const morphKeyLowerFirst = morphKey.charAt(0).toLowerCase() + morphKey.slice(1);
        
        // Try to find the morph target
        const dictIndex = dict[morphKeyLowerFirst];
        if (dictIndex !== undefined) {
          mesh.morphTargetInfluences[dictIndex] = frame[csvKey];
        } else {
          // Also try the original case in case the avatar uses it
          const dictIndexAlt = dict[morphKey];
          if (dictIndexAlt !== undefined) {
            mesh.morphTargetInfluences[dictIndexAlt] = frame[csvKey];
          }
        }
      });
    });
  }

  /**
   * Apply face blendshapes (manual control)
   */
  applyFaceBlendshapes(params: any) {
    if (this.morphTargetMeshes.length === 0) {
      console.warn('⚠️ No morph target meshes available');
      return;
    }

    this.morphTargetMeshes.forEach(mesh => {
      const dict = mesh.morphTargetDictionary;
      if (!dict) return;

      const mappings: any = {
        eyeBlink: ['eyeBlinkLeft', 'eyeBlinkRight'],
        eyeWide: ['eyeWideLeft', 'eyeWideRight'],
        eyeSquint: ['eyeSquintLeft', 'eyeSquintRight'],
        smile: ['mouthSmileLeft', 'mouthSmileRight'],
        jawOpen: ['jawOpen'],
        mouthFrown: ['mouthFrownLeft', 'mouthFrownRight'],
        browUp: ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'],
        browDown: ['browDownLeft', 'browDownRight']
      };

      Object.entries(params).forEach(([paramName, value]: [string, any]) => {
        const blendshapeNames = mappings[paramName] || [];
        const normalizedValue = value / 100;

        blendshapeNames.forEach((shapeName: string) => {
          if (dict[shapeName] !== undefined) {
            mesh.morphTargetInfluences[dict[shapeName]] = normalizedValue;
          }
        });
      });
    });
  }

  /**
   * Apply body bone rotations
   */
  applyBodyRotations(params: any) {
    if (!this.avatarModel) {
      console.warn('⚠️ No avatar model available');
      return;
    }

    const head = this.avatarModel.getObjectByName('Head') || 
                 this.avatarModel.getObjectByName('head') ||
                 this.avatarModel.getObjectByName('mixamorigHead');
    
    if (head) {
      head.rotation.x = (params.headRotationX / 100) * 0.5;
      head.rotation.y = (params.headRotationY / 100) * 0.5;
      head.rotation.z = (params.headRotationZ / 100) * 0.5;
    }

    const spine = this.avatarModel.getObjectByName('Spine') ||
                  this.avatarModel.getObjectByName('spine') ||
                  this.avatarModel.getObjectByName('mixamorigSpine');
    
    if (spine) {
      spine.rotation.x = (params.spineBend / 100) * 0.3;
      spine.rotation.y = (params.spineTwist / 100) * 0.3;
    }
  }

  /**
   * Reset face to neutral
   */
  private resetFace() {
    this.morphTargetMeshes.forEach(mesh => {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences.fill(0);
      }
    });
  }

  /**
   * Reset all animations
   */
  resetAll() {
    this.stopLipSync();
    this.resetFace();

    if (this.avatarModel) {
      this.avatarModel.traverse((node: any) => {
        if (node.isBone) {
          node.rotation.set(0, 0, 0);
        }
      });
    }
  }
}