import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AvatarAnimationService {
  private morphTargetMeshes: any[] = [];
  private avatarModel: any = null;

  // Observable for when avatar is loaded
  private avatarLoadedSubject = new BehaviorSubject<boolean>(false);
  avatarLoaded$ = this.avatarLoadedSubject.asObservable();

  setAvatarData(meshes: any[], model: any) {
    this.morphTargetMeshes = meshes;
    this.avatarModel = model;
    this.avatarLoadedSubject.next(true);
    console.log('âœ… Avatar data set in service:', meshes.length, 'meshes');
  }

  // Apply face blendshapes
  applyFaceBlendshapes(params: any) {
    if (this.morphTargetMeshes.length === 0) {
      console.warn('âš ï¸ No morph target meshes available');
      return;
    }

    this.morphTargetMeshes.forEach(mesh => {
      const dict = mesh.morphTargetDictionary;
      if (!dict) return;

      // Map UI params to actual blendshape names
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
        const normalizedValue = value / 100; // Convert 0-100 to 0-1

        blendshapeNames.forEach((shapeName: string) => {
          if (dict[shapeName] !== undefined) {
            mesh.morphTargetInfluences[dict[shapeName]] = normalizedValue;
          }
        });
      });
    });
  }

  // Apply body bone rotations
  applyBodyRotations(params: any) {
    if (!this.avatarModel) {
      console.warn('âš ï¸ No avatar model available');
      return;
    }

    // Find head bone
    const head = this.avatarModel.getObjectByName('Head') || 
                 this.avatarModel.getObjectByName('head') ||
                 this.avatarModel.getObjectByName('mixamorigHead');
    
    if (head) {
      head.rotation.x = (params.headRotationX / 100) * 0.5; // Convert to radians
      head.rotation.y = (params.headRotationY / 100) * 0.5;
      head.rotation.z = (params.headRotationZ / 100) * 0.5;
    }

    // Find spine bone
    const spine = this.avatarModel.getObjectByName('Spine') ||
                  this.avatarModel.getObjectByName('spine') ||
                  this.avatarModel.getObjectByName('mixamorigSpine');
    
    if (spine) {
      spine.rotation.x = (params.spineBend / 100) * 0.3;
      spine.rotation.y = (params.spineTwist / 100) * 0.3;
    }
  }

  resetAll() {
    // Reset face
    this.morphTargetMeshes.forEach(mesh => {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences.fill(0);
      }
    });

    // Reset body
    if (this.avatarModel) {
      this.avatarModel.traverse((node: any) => {
        if (node.isBone) {
          node.rotation.set(0, 0, 0);
        }
      });
    }
  }
}