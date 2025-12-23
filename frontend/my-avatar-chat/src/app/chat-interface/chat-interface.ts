import { Component, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  images?: string[];
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

  sendMessage() {
    if (!this.inputMessage.trim() && this.selectedImages.length === 0) return;

    const userMessage: Message = {
      id: this.messages.length + 1,
      role: 'user',
      content: this.inputMessage || '📷 Sent images',
      timestamp: new Date(),
      images: this.selectedImages.length > 0 ? [...this.selectedImages] : undefined
    };

    this.messages.push(userMessage);
    
    // Update conversation last message
    const conv = this.conversations.find(c => c.id === this.selectedConversationId);
    if (conv) {
      conv.lastMessage = userMessage.content;
      conv.timestamp = new Date();
    }

    this.inputMessage = '';
    this.selectedImages = [];
    this.shouldScroll = true;

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: this.messages.length + 1,
        role: 'assistant',
        content: 'Thanks for your message! This is a demo response.',
        timestamp: new Date()
      };
      this.messages.push(aiMessage);

      if (conv) {
        conv.lastMessage = aiMessage.content;
        conv.timestamp = new Date();
      }
      this.shouldScroll = true;
    }, 1000);
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
    
    // Reset input
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
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    } catch (err) {
      console.error('Scroll error:', err);
    }
  }
}