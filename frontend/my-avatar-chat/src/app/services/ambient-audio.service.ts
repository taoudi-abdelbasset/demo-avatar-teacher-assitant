import { Injectable, OnDestroy } from '@angular/core';
import { AudioPlaybackService } from './audio-playback.service';
import { AvatarAnimationService, AvatarState } from './avatar-animation.service';
import { BackendService } from './backend.service';
import { BodyAnimationLoaderService } from './body-animation-loader.service';

interface AmbientClip {
  audioPath: string;
  csvPath: string;
  state: AvatarState;
  chance: number; // 0-1 probability of playing (e.g., 0.3 = 30% chance)
}

@Injectable({
  providedIn: 'root'
})
export class AmbientAudioService implements OnDestroy {
  private isPlaying = false;
  private currentState: AvatarState = 'idle';
  private enabled = true;
  private intervalId: any = null;
  
  // 🎵 CONFIGURE YOUR AMBIENT CLIPS HERE
  private ambientClips: AmbientClip[] = [
    // Idle clips
    {
      audioPath: '/assets/ambient-audio/idle/hello.wav',
      csvPath: '/assets/ambient-audio/idle/hello.csv',
      state: 'idle',
      chance: 0.3 // 30% chance when idle animation plays
    },
    {
      audioPath: '/assets/ambient-audio/idle/still_waiting.wav',
      csvPath: '/assets/ambient-audio/idle/still_waiting.csv',
      state: 'idle',
      chance: 0.7
    },
    {
      audioPath: '/assets/ambient-audio/idle/here_to_help.wav',
      csvPath: '/assets/ambient-audio/idle/here_to_help.csv',
      state: 'idle',
      chance: 0.95
    },
    
    // Thinking clips
    {
      audioPath: '/assets/ambient-audio/thinking/let_me_think.wav',
      csvPath: '/assets/ambient-audio/thinking/let_me_think.csv',
      state: 'thinking',
      chance: 0.3
    }
  ];

  constructor(
    private audioPlayback: AudioPlaybackService,
    private animationService: AvatarAnimationService,
    private backend: BackendService,
    private bodyAnimationLoader: BodyAnimationLoaderService
  ) {
    // Listen to avatar state changes
    this.animationService.avatarState$.subscribe(state => {
      this.currentState = state;
      this.handleStateChange(state);
    });

    // 🎯 Method 1: Listen to body animation changes
    this.bodyAnimationLoader.animationChanged$.subscribe(state => {
      if (state === 'idle' || state === 'thinking') {
        this.tryPlayAmbient();
      }
    });

    // 🎯 Method 2: Timer-based backup (checks every 8-12 seconds)
    this.startPeriodicCheck();
  }

  ngOnDestroy() {
    this.stopPeriodicCheck();
  }

  private handleStateChange(state: AvatarState) {
    // Stop timer when talking
    if (state === 'talking') {
      this.stopPeriodicCheck();
    } else if (state === 'idle' || state === 'thinking') {
      // Restart timer when returning to idle/thinking
      this.startPeriodicCheck();
    }
  }

  private startPeriodicCheck() {
    if (this.intervalId) return; // Already running
    
    console.log('🎵 Starting periodic ambient audio checks');
    
    // Recursive function with random intervals
    const checkInterval = () => {
      this.tryPlayAmbient();
      
      // Random next interval (8-12 seconds)
      const nextInterval = 1000 + Math.random() * 1000;
      this.intervalId = setTimeout(checkInterval, nextInterval);
    };
    
    // Start first check after 8-12 seconds
    const firstInterval = 1000 + Math.random() * 1000;
    this.intervalId = setTimeout(checkInterval, firstInterval);
  }

  private stopPeriodicCheck() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
      console.log('🔇 Stopped periodic ambient audio checks');
    }
  }

  private async tryPlayAmbient() {
    // Check if enabled
    if (!this.enabled) {
      return;
    }

    // Don't interrupt if already playing audio
    if (this.isPlaying || this.audioPlayback.isPlaying()) {
      console.log('🎲 Skipped ambient audio (already playing)');
      return;
    }

    // Only play during idle/thinking
    if (this.currentState !== 'idle' && this.currentState !== 'thinking') {
      return;
    }

    // Get clips for current state
    const availableClips = this.ambientClips.filter(
      clip => clip.state === this.currentState
    );

    if (availableClips.length === 0) {
      console.log('🎲 No ambient clips for state:', this.currentState);
      return;
    }

    // Pick a random clip
    const randomClip = availableClips[Math.floor(Math.random() * availableClips.length)];

    // Roll the dice - should we play it?
    if (Math.random() > randomClip.chance) {
      console.log(`🎲 Skipped ambient audio (${(randomClip.chance * 100).toFixed(0)}% chance)`);
      return;
    }

    console.log(`🎵 Playing ambient: ${randomClip.audioPath}`);
    await this.playAmbientClip(randomClip);
  }

  private async playAmbientClip(clip: AmbientClip) {
    try {
      this.isPlaying = true;

      // Load CSV data
      const csvResponse = await fetch(clip.csvPath);
      const csvText = await csvResponse.text();
      const csvData = this.backend.parseCSV(csvText);

      // Start audio and lip-sync
      const audioStartTime = performance.now() / 1000;
      
      // Start lip-sync
      this.animationService.startLipSync(csvData, audioStartTime);

      // Play audio
      await this.audioPlayback.playAudio(clip.audioPath);

      // Stop lip-sync when done
      this.animationService.stopLipSync();

    } catch (error) {
      console.warn('⚠️ Failed to play ambient audio:', error);
      console.warn('Check if files exist:', clip.audioPath, clip.csvPath);
    } finally {
      this.isPlaying = false;
    }
  }

  /**
   * Manually trigger an ambient clip (for testing)
   */
  async playSpecificClip(audioPath: string, csvPath: string) {
    if (this.isPlaying) return;

    await this.playAmbientClip({
      audioPath,
      csvPath,
      state: this.currentState,
      chance: 1.0
    });
  }

  /**
   * Enable/disable ambient audio
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    console.log(enabled ? '🎵 Ambient audio enabled' : '🔇 Ambient audio disabled');
    
    if (enabled) {
      this.startPeriodicCheck();
    } else {
      this.stopPeriodicCheck();
    }
  }

  /**
   * Check if ambient audio is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}