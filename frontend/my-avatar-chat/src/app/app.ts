import { Component } from '@angular/core';
import { AvatarViewerComponent } from './avatar-viewer/avatar-viewer';
import { ChatInterfaceComponent } from './chat-interface/chat-interface';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AvatarViewerComponent, ChatInterfaceComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent {
  title = 'my-avatar-chat';
}