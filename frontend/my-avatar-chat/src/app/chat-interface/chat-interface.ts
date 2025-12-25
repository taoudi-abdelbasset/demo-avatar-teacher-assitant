import { Component, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackendService, BackendResponse } from '../services/backend.service';
import { AudioPlaybackService } from '../services/audio-playback.service';
import { AvatarAnimationService } from '../services/avatar-animation.service';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  images?: string[];
  audioUrl?: string;
  csvData?: string;
  isPlaying?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
}

@Component({
  selector: 'app-chat-interface',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-interface.html',
  styleUrls: ['./chat-interface.css']
})
export class ChatInterfaceComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  isSidebarExpanded = true;
  conversations: Conversation[] = [
    {
      id: '1',
      title: 'First Conversation',
      lastMessage: 'Hello! How can I help you today?',
      timestamp: new Date(),
      messages: [
        {
          id: 1,
          role: 'assistant',
          content: 'Hello! How can I help you today?',
          timestamp: new Date()
        }
      ]
    }
  ];

  selectedConversationId = '1';
  messages: Message[] = this.conversations[0].messages;
  inputMessage = '';
  selectedImages: string[] = [];
  private shouldScroll = false;
  isProcessing = false;
  private currentPlaybackId: number = 0;

  constructor(
    private backendService: BackendService,
    private audioService: AudioPlaybackService,
    private animationService: AvatarAnimationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  toggleSidebar() {
    this.isSidebarExpanded = !this.isSidebarExpanded;
  }

  selectConversation(id: string) {
    this.selectedConversationId = id;
    const conv = this.conversations.find(c => c.id === id);
    if (conv) {
      this.messages = conv.messages;
      this.shouldScroll = true;
    }
  }

  getCurrentConversation(): Conversation | undefined {
    return this.conversations.find(c => c.id === this.selectedConversationId);
  }

  async sendMessage() {
    if (!this.inputMessage.trim() && this.selectedImages.length === 0) return;
    if (this.isProcessing) return;

    // 🛑 STOP EVERYTHING FIRST
    this.stopAllPlayback();
    this.currentPlaybackId++;

    const userMessage: Message = {
      id: this.messages.length + 1,
      role: 'user',
      content: this.inputMessage || '📷 Sent images',
      timestamp: new Date(),
      images: this.selectedImages.length > 0 ? [...this.selectedImages] : undefined
    };

    this.messages.push(userMessage);
    
    const conv = this.conversations.find(c => c.id === this.selectedConversationId);
    if (conv) {
      conv.lastMessage = userMessage.content;
      conv.timestamp = new Date();
    }

    const messageText = this.inputMessage;
    const messageImages = this.selectedImages.length > 0 ? [...this.selectedImages] : undefined;
    
    this.inputMessage = '';
    this.selectedImages = [];
    this.shouldScroll = true;
    this.isProcessing = true;

    // 🎯 CORRECT FLOW: idle → thinking (while waiting for response)
    await new Promise(resolve => setTimeout(resolve, 100));
    this.animationService.setAvatarState('thinking');
    console.log('💭 User sent message → Avatar thinking...');

    try {
      // Call backend (takes 4-10 seconds with "thinking" animation)
      const response = await this.backendService.sendMessage(messageText, messageImages);
      
      const aiMessage: Message = {
        id: this.messages.length + 1,
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
        audioUrl: response.audioUrl,
        csvData: response.csvData
      };

      this.messages.push(aiMessage);

      if (conv) {
        conv.lastMessage = aiMessage.content;
        conv.timestamp = new Date();
      }
      
      // Set isProcessing to false IMMEDIATELY
      this.isProcessing = false;
      this.cdr.detectChanges();
      this.shouldScroll = true;

      // 🎯 CORRECT FLOW: thinking → talking (when audio plays)
      const playbackId = this.currentPlaybackId;
      this.playMessageAudio(aiMessage, playbackId, false); // false = NOT a replay

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: this.messages.length + 1,
        role: 'assistant',
        content: 'Sorry, there was an error processing your message.',
        timestamp: new Date()
      };
      
      this.messages.push(errorMessage);
      this.isProcessing = false;
      this.cdr.detectChanges();
      this.shouldScroll = true;
      
      // 🎯 Error → back to idle
      this.animationService.setAvatarState('idle');
      console.log('❌ Error → Avatar idle');
    }
  }

  /**
   * Play audio and lip-sync animation
   * @param isReplay - true when user clicks replay button, false for new messages
   */
  async playMessageAudio(message: Message, playbackId?: number, isReplay: boolean = false) {
    if (!message.audioUrl) return;

    // Check if cancelled
    if (playbackId !== undefined && playbackId !== this.currentPlaybackId) {
      console.log('⚠️ Playback cancelled - newer message sent');
      return;
    }

    // 🛑 STOP EVERYTHING
    this.stopAllPlayback();
    message.isPlaying = true;

    try {
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check again after delay
      if (playbackId !== undefined && playbackId !== this.currentPlaybackId) {
        console.log('⚠️ Playback cancelled during delay');
        message.isPlaying = false;
        return;
      }

      // Parse CSV data
      let csvData: any[] = [];
      if (message.csvData) {
        csvData = this.backendService.parseCSV(message.csvData);
      }

      // 🎯 CORRECT FLOW for REPLAY: idle → talking (skip thinking)
      if (isReplay) {
        console.log('🔁 Replay → Avatar talking directly (no thinking)');
        // Don't set thinking state for replays
      }
      
      // Start lip-sync and set to talking
      if (csvData.length > 0) {
        const audioStartTime = performance.now();
        this.animationService.startLipSync(csvData, audioStartTime);
        console.log('🎤 Lip-sync started → Avatar talking');
      } else {
        // No CSV but still has audio - just set talking state
        this.animationService.setAvatarState('talking');
        console.log('🎤 Audio only (no lip-sync) → Avatar talking');
      }

      // Play audio
      await this.audioService.playAudio(message.audioUrl, message.id);
      console.log('✅ Audio finished');

    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      // Clean up only if this playback is still active
      if (playbackId === undefined || playbackId === this.currentPlaybackId) {
        message.isPlaying = false;
        this.animationService.stopLipSync();
        
        // 🎯 CORRECT FLOW: talking → idle (after audio ends)
        this.animationService.setAvatarState('idle');
        console.log('🎤 Audio ended → Avatar idle');
      }
    }
  }

  /**
   * 🎯 REPLAY: Should be idle → talking → idle (NO thinking state)
   */
  replayMessage(message: Message) {
    console.log('🔁 Replay button clicked');
    
    // Stop everything
    this.stopAllPlayback();
    this.currentPlaybackId++;
    
    // Small delay, then play with isReplay=true
    setTimeout(() => {
      this.playMessageAudio(message, this.currentPlaybackId, true); // true = IS a replay
    }, 100);
  }

  /**
   * Stop all audio playback and animations
   */
  private stopAllPlayback() {
    this.audioService.stop();
    this.animationService.stopLipSync();
    this.messages.forEach(msg => msg.isPlaying = false);
    console.log('🛑 Stopped all playback');
  }

  newChat() {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: `Chat ${this.conversations.length + 1}`,
      lastMessage: 'New conversation started',
      timestamp: new Date(),
      messages: [
        {
          id: 1,
          role: 'assistant',
          content: 'Hello! How can I help you today?',
          timestamp: new Date()
        }
      ]
    };

    this.conversations.unshift(newConv);
    this.selectedConversationId = newConv.id;
    this.messages = newConv.messages;
    this.shouldScroll = true;
  }

  clearChat() {
    const conv = this.getCurrentConversation();
    if (conv && confirm('Are you sure you want to clear this chat?')) {
      conv.messages = [
        {
          id: 1,
          role: 'assistant',
          content: 'Chat cleared. How can I help you?',
          timestamp: new Date()
        }
      ];
      this.messages = conv.messages;
      conv.lastMessage = 'Chat cleared';
      this.shouldScroll = true;
    }
  }

  handleImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          this.selectedImages.push(result);
        };
        reader.readAsDataURL(file);
      });
    }
    
    input.value = '';
  }

  removeImage(index: number) {
    this.selectedImages.splice(index, 1);
  }

  openImage(src: string) {
    window.open(src, '_blank');
  }

  private scrollToBottom() {
    try {
      this.messagesContainer.nativeElement.scrollTop = 
        this.messagesContainer.nativeElement.scrollHeight;
    } catch (err) {
      console.error('Scroll error:', err);
    }
  }
}

// 🎯 ANIMATION STATE FLOW SUMMARY:
// 
// NEW MESSAGE:
// 1. User types and sends → idle
// 2. Backend processing → thinking (4-10 seconds)
// 3. Response received, audio plays → talking
// 4. Audio ends → idle
//
// REPLAY:
// 1. User clicks replay → idle
// 2. Audio plays immediately → talking (NO thinking)
// 3. Audio ends → idle