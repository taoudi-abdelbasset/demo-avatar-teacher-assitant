import { Component } from '@angular/core';
import { AvatarViewerComponent } from './avatar-viewer/avatar-viewer';
import { ChatInterfaceComponent } from './chat-interface/chat-interface';
import { AvatarControlsComponent, FaceParameters, BodyParameters } from './avatar-controls/avatar-controls';
import { AvatarAnimationService } from './avatar-animation.service'; // Import the service

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AvatarViewerComponent, ChatInterfaceComponent, AvatarControlsComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent {
  title = 'my-avatar-chat';

  // Inject the service
  constructor(private animationService: AvatarAnimationService) {}

  onFaceChanged(params: FaceParameters) {
    console.log('Face params changed:', params);
    // Apply to avatar via service
    this.animationService.applyFaceBlendshapes(params);
  }

  onBodyChanged(params: BodyParameters) {
    console.log('Body params changed:', params);
    // Apply to avatar via service
    this.animationService.applyBodyRotations(params);
  }
}