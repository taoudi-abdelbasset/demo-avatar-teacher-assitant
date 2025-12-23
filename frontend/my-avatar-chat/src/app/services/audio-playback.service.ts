import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  messageId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AudioPlaybackService {
  private audio: HTMLAudioElement | null = null;
  private playbackState = new BehaviorSubject<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0
  });

  playbackState$ = this.playbackState.asObservable();

  /**
   * Play audio and return a promise that resolves when done
   */
  async playAudio(audioUrl: string, messageId?: number): Promise<void> {
    // Stop any current playback
    this.stop();

    return new Promise((resolve, reject) => {
      this.audio = new Audio(audioUrl);
      
      this.audio.addEventListener('loadedmetadata', () => {
        this.playbackState.next({
          isPlaying: true,
          currentTime: 0,
          duration: this.audio!.duration,
          messageId
        });
      });

      this.audio.addEventListener('timeupdate', () => {
        if (this.audio) {
          this.playbackState.next({
            isPlaying: true,
            currentTime: this.audio.currentTime,
            duration: this.audio.duration,
            messageId
          });
        }
      });

      this.audio.addEventListener('ended', () => {
        this.playbackState.next({
          isPlaying: false,
          currentTime: 0,
          duration: 0
        });
        resolve();
      });

      this.audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        this.playbackState.next({
          isPlaying: false,
          currentTime: 0,
          duration: 0
        });
        reject(e);
      });

      this.audio.play().catch(reject);
    });
  }

  /**
   * Stop current playback
   */
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
      this.playbackState.next({
        isPlaying: false,
        currentTime: 0,
        duration: 0
      });
    }
  }

  /**
   * Get current playback time (useful for syncing)
   */
  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  /**
   * Check if currently playing
   */
  isPlaying(): boolean {
    return this.playbackState.value.isPlaying;
  }
}