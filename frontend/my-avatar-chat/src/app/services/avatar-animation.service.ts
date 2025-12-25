// 🎯 NEW ARCHITECTURE: Avatar Animation Orchestrator
// Manages BODY state and coordinates both services

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BodyAnimationLoaderService } from './body-animation-loader.service';
import { FaceAnimationService } from './face-animation.service';

export type AvatarState = 'idle' | 'thinking' | 'talking';

@Injectable({
  providedIn: 'root'
})
export class AvatarAnimationService {
  private avatarModel: any = null;
  
  // 🎭 Body state (what body animation is playing)
  private avatarStateSubject = new BehaviorSubject<AvatarState>('idle');
  avatarState$ = this.avatarStateSubject.asObservable();

  private avatarLoadedSubject = new BehaviorSubject<boolean>(false);
  avatarLoaded$ = this.avatarLoadedSubject.asObservable();

  constructor(
    private bodyAnimationLoader: BodyAnimationLoaderService,
    private faceAnimationService: FaceAnimationService
  ) {
    console.log('🎭 Avatar Animation Orchestrator initialized');
  }

  /**
   * Set avatar data - distribute to both services
   */
  setAvatarData(meshes: any[], model: any, animations?: any[]) {
    this.avatarModel = model;
    
    // Give face meshes to FaceAnimationService
    this.faceAnimationService.setMorphTargetMeshes(meshes);
    
    // Give body model to BodyAnimationLoaderService
    this.bodyAnimationLoader.setAvatarModel(model, animations);
    
    this.avatarLoadedSubject.next(true);
    
    console.log('✅ Avatar data distributed:');
    console.log('   - Face meshes:', meshes.length);
    console.log('   - Body model:', model ? '✓' : '✗');
    console.log('   - Animations:', animations?.length || 0);
  }

  /**
   * 🎭 Change BODY animation state (idle/thinking/talking)
   */
  setAvatarState(state: AvatarState) {
    const previousState = this.avatarStateSubject.value;
    
    if (previousState === state) {
      return; // Already in this state
    }
    
    this.avatarStateSubject.next(state);
    console.log(`🎭 Body state: ${previousState} → ${state}`);
    
    // Change body animation
    if (this.bodyAnimationLoader.isReady()) {
      this.bodyAnimationLoader.playRandomAnimation(state, true);
    } else {
      console.log('⏳ Waiting for body animations to load...');
      setTimeout(() => {
        if (this.bodyAnimationLoader.isReady()) {
          this.bodyAnimationLoader.playRandomAnimation(state, true);
        }
      }, 1000);
    }
  }

  /**
   * 🎤 Start lip-sync (FACE only - doesn't change body state!)
   */
  startLipSync(csvData: any[]) {
    // Only face animation changes
    this.faceAnimationService.startLipSync(csvData);
    console.log('🎤 Lip-sync started (body animation unchanged)');
  }

  /**
   * 🛑 Stop lip-sync (FACE only)
   */
  stopLipSync() {
    this.faceAnimationService.stopLipSync();
    console.log('🛑 Lip-sync stopped');
  }

  /**
   * Update body animations (call every frame)
   */
  updateBodyAnimations() {
    this.bodyAnimationLoader.update();
  }

  /**
   * Manual face blendshapes (for testing/controls)
   */
  applyFaceBlendshapes(params: any) {
    this.faceAnimationService.applyFaceBlendshapes(params);
  }

  /**
   * Manual body rotations (for testing/controls)
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
   * Reset everything
   */
  resetAll() {
    this.faceAnimationService.stopLipSync();
    this.bodyAnimationLoader.stopAnimation();
    
    if (this.avatarModel) {
      this.avatarModel.traverse((node: any) => {
        if (node.isBone) {
          node.rotation.set(0, 0, 0);
        }
      });
    }
    
    this.setAvatarState('idle');
    console.log('🔄 Avatar reset complete');
  }

  /**
   * Get current body state
   */
  getCurrentState(): AvatarState {
    return this.avatarStateSubject.value;
  }

  /**
   * Check if body animations are ready
   */
  get ready$(): Observable<boolean> {
    return this.bodyAnimationLoader.ready$;
  }
}