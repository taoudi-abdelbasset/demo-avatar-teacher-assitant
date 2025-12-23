import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FaceParameters {
  eyeBlink: number;
  eyeWide: number;
  eyeSquint: number;
  smile: number;
  jawOpen: number;
  mouthFrown: number;
  browUp: number;
  browDown: number;
}

export interface BodyParameters {
  headRotationX: number;
  headRotationY: number;
  headRotationZ: number;
  spineBend: number;
  spineTwist: number;
}

@Component({
  selector: 'app-avatar-controls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './avatar-controls.html',
  styleUrls: ['./avatar-controls.css']
})
export class AvatarControlsComponent {
  @Output() faceChanged = new EventEmitter<FaceParameters>();
  @Output() bodyChanged = new EventEmitter<BodyParameters>();

  isExpanded = true;
  activeTab: 'face' | 'body' = 'face';

  faceParams: FaceParameters = {
    eyeBlink: 0,
    eyeWide: 0,
    eyeSquint: 0,
    smile: 0,
    jawOpen: 0,
    mouthFrown: 0,
    browUp: 0,
    browDown: 0
  };

  bodyParams: BodyParameters = {
    headRotationX: 0,
    headRotationY: 0,
    headRotationZ: 0,
    spineBend: 0,
    spineTwist: 0
  };

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
  }

  onFaceChange() {
    this.faceChanged.emit({ ...this.faceParams });
  }

  onBodyChange() {
    this.bodyChanged.emit({ ...this.bodyParams });
  }

  applyPreset(preset: string) {
    switch (preset) {
      case 'smile':
        this.faceParams = { ...this.faceParams, smile: 70, browUp: 30, eyeWide: 20 };
        break;
      case 'surprise':
        this.faceParams = { ...this.faceParams, eyeWide: 80, jawOpen: 50, browUp: 60 };
        break;
      case 'angry':
        this.faceParams = { ...this.faceParams, browDown: 70, eyeSquint: 50, mouthFrown: 40 };
        break;
      case 'reset':
        this.faceParams = {
          eyeBlink: 0, eyeWide: 0, eyeSquint: 0,
          smile: 0, jawOpen: 0, mouthFrown: 0,
          browUp: 0, browDown: 0
        };
        break;
    }
    this.onFaceChange();
  }

  applyBodyPreset(preset: string) {
    switch (preset) {
      case 'nod':
        this.bodyParams = { ...this.bodyParams, headRotationX: 30 };
        break;
      case 'shake':
        this.bodyParams = { ...this.bodyParams, headRotationY: -40 };
        break;
      case 'tilt':
        this.bodyParams = { ...this.bodyParams, headRotationZ: 25 };
        break;
      case 'reset':
        this.bodyParams = {
          headRotationX: 0, headRotationY: 0, headRotationZ: 0,
          spineBend: 0, spineTwist: 0
        };
        break;
    }
    this.onBodyChange();
  }

  resetAll() {
    this.faceParams = {
      eyeBlink: 0, eyeWide: 0, eyeSquint: 0,
      smile: 0, jawOpen: 0, mouthFrown: 0,
      browUp: 0, browDown: 0
    };
    this.bodyParams = {
      headRotationX: 0, headRotationY: 0, headRotationZ: 0,
      spineBend: 0, spineTwist: 0
    };
    this.onFaceChange();
    this.onBodyChange();
  }

  // PUBLIC METHOD: Set face params from external data (backend array)
  public setFaceParams(params: Partial<FaceParameters>) {
    this.faceParams = { ...this.faceParams, ...params };
    this.onFaceChange();
  }

  // PUBLIC METHOD: Set body params from external data (backend array)
  public setBodyParams(params: Partial<BodyParameters>) {
    this.bodyParams = { ...this.bodyParams, ...params };
    this.onBodyChange();
  }
}