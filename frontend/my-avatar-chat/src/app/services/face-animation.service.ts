import { Injectable } from '@angular/core';
import { AudioPlaybackService } from './audio-playback.service';

@Injectable({
  providedIn: 'root'
})
export class FaceAnimationService {
  private morphTargetMeshes: any[] = [];
  private animationFrameId: number | null = null;
  private lipSyncData: any[] = [];
  private isAnimating = false;

  constructor(private audioPlayback: AudioPlaybackService) {
    console.log('😊 Face Animation Service initialized');
  }

  /**
   * Set meshes with morph targets for face animations
   */
  setMorphTargetMeshes(meshes: any[]) {
    this.morphTargetMeshes = meshes;
    console.log('✅ Face meshes set:', meshes.length, 'meshes');
  }

  /**
   * 🎤 START LIP-SYNC - Face animations only
   * Does NOT change body animation state!
   * Works independently - can run during ANY body animation (idle/thinking/talking)
   */
  startLipSync(csvData: any[]) {
    this.stopLipSync();
    this.lipSyncData = csvData;
    this.isAnimating = true;
    console.log('🎤 Starting lip-sync with', csvData.length, 'frames');
    this.animateLipSync();
  }

  /**
   * 🛑 STOP LIP-SYNC
   */
  stopLipSync() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isAnimating = false;
    this.resetFace();
    console.log('🛑 Lip-sync stopped');
  }

  /**
   * Check if currently animating face
   */
  isPlaying(): boolean {
    return this.isAnimating;
  }

  /**
   * 🎬 Animate lip-sync frame by frame
   * Syncs with audio playback time
   */
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

  /**
   * Apply CSV blendshapes to face meshes
   */
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

  /**
   * Reset face to neutral expression
   */
  private resetFace() {
    this.morphTargetMeshes.forEach(mesh => {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences.fill(0);
      }
    });
  }

  /**
   * Manual control: Apply face blendshapes (for testing/controls)
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
}