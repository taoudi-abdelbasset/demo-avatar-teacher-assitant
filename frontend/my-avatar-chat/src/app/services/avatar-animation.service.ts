import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription, Observable } from 'rxjs';
import { BodyAnimationLoaderService } from './body-animation-loader.service';
import { AudioPlaybackService } from './audio-playback.service';

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
  private builtInAnimations: any[] = [];

  private avatarStateSubject = new BehaviorSubject<AvatarState>('idle');
  avatarState$ = this.avatarStateSubject.asObservable();

  private avatarLoadedSubject = new BehaviorSubject<boolean>(false);
  avatarLoaded$ = this.avatarLoadedSubject.asObservable();

  private pendingState: AvatarState | null = null;
  private readySub: Subscription | null = null;

  constructor(
    private bodyAnimationLoader: BodyAnimationLoaderService,
    private audioPlayback: AudioPlaybackService
  ) {}

  // ✅ Expose body animation loader ready state as a getter
  get ready$(): Observable<boolean> {
    return this.bodyAnimationLoader.ready$;
  }

  setAvatarData(meshes: any[], model: any, animations?: any[]) {
    this.morphTargetMeshes = meshes;
    this.avatarModel = model;
    this.builtInAnimations = animations || [];
    this.avatarLoadedSubject.next(true);
    
    this.bodyAnimationLoader.setAvatarModel(model, animations);
    
    console.log('✅ Avatar data set:', meshes.length, 'meshes');
    if (this.builtInAnimations.length > 0) {
      console.log('🎬 Built-in animations:', this.builtInAnimations.length);
    }
  }

  setAvatarState(state: AvatarState) {
    const previousState = this.avatarStateSubject.value;
    
    // Don't change if already in this state
    if (previousState === state) {
      return;
    }
    
    this.avatarStateSubject.next(state);
    console.log(`🎭 Avatar: ${previousState} → ${state}`);
    
    if (this.bodyAnimationLoader.isReady()) {
      this.bodyAnimationLoader.playRandomAnimation(state, true);
    } else {
      this.pendingState = state;
      
      if (this.readySub) {
        this.readySub.unsubscribe();
      }
      
      this.readySub = this.bodyAnimationLoader.ready$.subscribe(ready => {
        if (ready && this.pendingState) {
          this.bodyAnimationLoader.playRandomAnimation(this.pendingState, true);
          this.pendingState = null;
        }
        if (this.readySub) {
          this.readySub.unsubscribe();
          this.readySub = null;
        }
      });
    }
  }

  updateBodyAnimations() {
    this.bodyAnimationLoader.update();
  }

  startLipSync(csvData: any[], audioStartTime: number) {
    this.stopLipSync();
    this.lipSyncData = csvData;
    this.lipSyncStartTime = audioStartTime;
    this.setAvatarState('talking');
    console.log('🎤 Starting lip-sync with', csvData.length, 'frames');
    this.animateLipSync();
  }

  stopLipSync() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.resetFace();
    console.log('🛑 Lip-sync stopped');
  }

  private animateLipSync = () => {
    if (!this.lipSyncData.length) {
      console.warn('⚠️ No lip-sync data available');
      return;
    }

    // Use audio's actual current time for perfect sync
    const currentTime = this.audioPlayback.getCurrentTime();
    
    // Find closest frame (30fps = 0.033s tolerance)
    const frame = this.lipSyncData.find(f => 
      Math.abs(f.timeCode - currentTime) < 0.033
    );

    if (frame) {
      this.applyCSVBlendshapes(frame);
    }

    this.animationFrameId = requestAnimationFrame(this.animateLipSync);
  }

  private applyCSVBlendshapes(frame: any) {
    if (this.morphTargetMeshes.length === 0) return;

    this.morphTargetMeshes.forEach(mesh => {
      const dict = mesh.morphTargetDictionary;
      if (!dict) return;

      Object.keys(frame).forEach(csvKey => {
        if (!csvKey.startsWith('blendShapes.')) return;
        
        const morphKey = csvKey.replace('blendShapes.', '');
        const morphKeyLowerFirst = morphKey.charAt(0).toLowerCase() + morphKey.slice(1);
        
        const dictIndex = dict[morphKeyLowerFirst];
        if (dictIndex !== undefined) {
          mesh.morphTargetInfluences[dictIndex] = frame[csvKey];
        } else {
          const dictIndexAlt = dict[morphKey];
          if (dictIndexAlt !== undefined) {
            mesh.morphTargetInfluences[dictIndexAlt] = frame[csvKey];
          }
        }
      });
    });
  }

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

  private resetFace() {
    this.morphTargetMeshes.forEach(mesh => {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences.fill(0);
      }
    });
  }

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
    
    this.setAvatarState('idle');
  }
}