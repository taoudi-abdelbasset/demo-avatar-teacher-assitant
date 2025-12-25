import { Injectable, OnDestroy } from '@angular/core';
import { AudioPlaybackService } from './audio-playback.service';
import { AvatarAnimationService, AvatarState } from './avatar-animation.service';
import { BackendService } from './backend.service';
import { BodyAnimationLoaderService } from './body-animation-loader.service';

interface AmbientClip {
  audioPath: string;
  csvPath: string;
  state: AvatarState;
  chance: number;
}

@Injectable({
  providedIn: 'root'
})
export class AmbientAudioService implements OnDestroy {
  private isPlaying = false;
  private currentState: AvatarState = 'idle';
  private enabled = true; // ✅ Enabled by default
  private intervalId: any = null;
  
  private ambientClips: AmbientClip[] = [
    // Idle clips
    {
      audioPath: '/assets/ambient-audio/idle/hello.wav',
      csvPath: '/assets/ambient-audio/idle/hello.csv',
      state: 'idle',
      chance: 0.3
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
    console.log('🎵 Ambient Audio Service initialized');
    
    // Listen to avatar state changes
    this.animationService.avatarState$.subscribe(state => {
      this.currentState = state;
      this.handleStateChange(state);
    });

    // Listen to body animation changes
    this.bodyAnimationLoader.animationChanged$.subscribe(state => {
      if (state === 'idle' || state === 'thinking') {
        this.tryPlayAmbient();
      }
    });

    // Start periodic checks
    this.startPeriodicCheck();
  }

  ngOnDestroy() {
    this.stopPeriodicCheck();
  }

  private handleStateChange(state: AvatarState) {
    console.log('🎭 Ambient audio sees state change:', state);
    
    // Stop timer when talking
    if (state === 'talking') {
      this.stopPeriodicCheck();
    } else if (state === 'idle' || state === 'thinking') {
      // Restart timer when returning to idle/thinking
      this.startPeriodicCheck();
    }
  }

  private startPeriodicCheck() {
    if (this.intervalId) {
      console.log('⏭️ Timer already running, skipping');
      return;
    }
    
    console.log('🎵 Starting periodic ambient audio checks');
    
    const checkInterval = () => {
      this.tryPlayAmbient();
      
      // ✅ FIXED: Random interval (8-12 seconds)
      const nextInterval = 3000 + Math.random() * 4000; // 8000-12000ms = 8-12 seconds
      console.log(`⏰ Next ambient check in ${(nextInterval / 1000).toFixed(1)}s`);
      this.intervalId = setTimeout(checkInterval, nextInterval);
    };
    
    // Start first check after 8-12 seconds
    const firstInterval = 3000 + Math.random() * 4000;
    console.log(`⏰ First ambient check in ${(firstInterval / 1000).toFixed(1)}s`);
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
    console.log('🎲 Trying to play ambient audio...');
    console.log('   - Enabled:', this.enabled);
    console.log('   - Is playing:', this.isPlaying);
    console.log('   - Audio service playing:', this.audioPlayback.isPlaying());
    console.log('   - Current state:', this.currentState);
    
    // Check if enabled
    if (!this.enabled) {
      console.log('🎲 Skipped: Service disabled');
      return;
    }

    // Don't interrupt if already playing audio
    if (this.isPlaying || this.audioPlayback.isPlaying()) {
      console.log('🎲 Skipped: Already playing audio');
      return;
    }

    // Only play during idle/thinking
    if (this.currentState !== 'idle' && this.currentState !== 'thinking') {
      console.log('🎲 Skipped: Not in idle/thinking state');
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

    // Roll the dice
    const roll = Math.random();
    console.log(`🎲 Rolled ${(roll * 100).toFixed(0)}% vs ${(randomClip.chance * 100).toFixed(0)}% chance`);
    
    if (roll > randomClip.chance) {
      console.log(`🎲 Skipped: Failed probability check`);
      return;
    }

    console.log(`🎵 ✅ Playing ambient: ${randomClip.audioPath}`);
    await this.playAmbientClip(randomClip);
  }

  private async playAmbientClip(clip: AmbientClip) {
    try {
      this.isPlaying = true;

      // Load CSV data
      const csvResponse = await fetch(clip.csvPath);
      if (!csvResponse.ok) {
        throw new Error(`CSV not found: ${clip.csvPath}`);
      }
      const csvText = await csvResponse.text();
      const csvData = this.backend.parseCSV(csvText);

      // Check if audio file exists
      const audioResponse = await fetch(clip.audioPath, { method: 'HEAD' });
      if (!audioResponse.ok) {
        throw new Error(`Audio not found: ${clip.audioPath}`);
      }

      // Start audio and lip-sync
      const audioStartTime = performance.now() / 1000;
      
      // Start lip-sync
      this.animationService.startLipSync(csvData, audioStartTime);
      console.log('🎤 Ambient lip-sync started');

      // Play audio
      await this.audioPlayback.playAudio(clip.audioPath);
      console.log('✅ Ambient audio finished');

      // Stop lip-sync when done
      this.animationService.stopLipSync();

    } catch (error) {
      console.warn('⚠️ Failed to play ambient audio:', error);
      console.warn('📁 Check if files exist:');
      console.warn('   Audio:', clip.audioPath);
      console.warn('   CSV:', clip.csvPath);
    } finally {
      this.isPlaying = false;
    }
  }

  /**
   * Manually trigger an ambient clip (for testing)
   */
  async playSpecificClip(audioPath: string, csvPath: string) {
    if (this.isPlaying) {
      console.log('⚠️ Already playing, skipping manual trigger');
      return;
    }

    console.log('🎵 Manual trigger:', audioPath);
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
    console.log(enabled ? '🎵 Ambient audio ENABLED' : '🔇 Ambient audio DISABLED');
    
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