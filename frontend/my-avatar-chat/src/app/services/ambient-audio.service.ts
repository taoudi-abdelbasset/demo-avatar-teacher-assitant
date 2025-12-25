// 🔧 FIXED: Ambient audio that plays face animation without changing body state

import { Injectable, OnDestroy } from '@angular/core';
import { AudioPlaybackService } from './audio-playback.service';
import { FaceAnimationService } from './face-animation.service';
import { AvatarAnimationService } from './avatar-animation.service';
import { BackendService } from './backend.service';

type AvatarState = 'idle' | 'thinking' | 'talking';

interface AmbientClip {
  audioPath: string;
  csvPath: string;
  forState: AvatarState;
  chance: number;
}

@Injectable({
  providedIn: 'root'
})
export class AmbientAudioService implements OnDestroy {
  private isPlaying = false;
  private currentBodyState: AvatarState = 'idle';
  private enabled = true;
  private intervalId: any = null;
  
  private ambientClips: AmbientClip[] = [
    // 🧘 IDLE body state + idle voice clips
    {
      audioPath: '/assets/ambient-audio/idle/hello.wav',
      csvPath: '/assets/ambient-audio/idle/hello.csv',
      forState: 'idle',
      chance: 0.6
    },
    {
      audioPath: '/assets/ambient-audio/idle/still_waiting.wav',
      csvPath: '/assets/ambient-audio/idle/still_waiting.csv',
      forState: 'idle',
      chance: 0.7
    },
    {
      audioPath: '/assets/ambient-audio/idle/here_to_help.wav',
      csvPath: '/assets/ambient-audio/idle/here_to_help.csv',
      forState: 'idle',
      chance: 0.95
    },
    
    // 🤔 THINKING body state + thinking voice clips
    {
      audioPath: '/assets/ambient-audio/thinking/let_me_think.wav',
      csvPath: '/assets/ambient-audio/thinking/let_me_think.csv',
      forState: 'thinking',
      chance: 0.8
    }
  ];

  constructor(
    private audioPlayback: AudioPlaybackService,
    private faceAnimationService: FaceAnimationService,
    private avatarAnimationService: AvatarAnimationService,
    private backend: BackendService
  ) {
    console.log('🎵 Ambient Audio Service initialized');
    this.initializeListeners();
  }

  private initializeListeners() {
    // Listen to BODY state changes from orchestrator
    this.avatarAnimationService.avatarState$.subscribe((state: AvatarState) => {
      this.currentBodyState = state;
      this.handleBodyStateChange(state);
    });

    // Start periodic checks
    this.startPeriodicCheck();
    
    console.log('✅ Ambient audio listeners initialized');
  }

  ngOnDestroy() {
    this.stopPeriodicCheck();
  }

  /**
   * Handle body animation state changes
   * Manage timer based on body state
   */
  private handleBodyStateChange(state: AvatarState) {
    console.log('🎭 Ambient audio sees body state:', state);
    
    // Stop timer when body is in "talking" state
    if (state === 'talking') {
      this.stopPeriodicCheck();
    } 
    // Start timer when body is idle/thinking
    else if (state === 'idle' || state === 'thinking') {
      this.startPeriodicCheck();
    }
  }

  /**
   * Start periodic ambient audio checks
   */
  private startPeriodicCheck() {
    if (this.intervalId) {
      return;
    }
    
    console.log('🎵 Starting periodic ambient audio checks');
    
    const checkInterval = () => {
      this.tryPlayAmbient();
      
      // Random interval (8-12 seconds)
      const nextInterval = 8000 + Math.random() * 4000;
      console.log(`⏰ Next check in ${(nextInterval / 1000).toFixed(1)}s`);
      this.intervalId = setTimeout(checkInterval, nextInterval);
    };
    
    // First check after 8-12 seconds
    const firstInterval = 8000 + Math.random() * 4000;
    console.log(`⏰ First check in ${(firstInterval / 1000).toFixed(1)}s`);
    this.intervalId = setTimeout(checkInterval, firstInterval);
  }

  /**
   * Stop periodic checks
   */
  private stopPeriodicCheck() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
      console.log('🔇 Stopped periodic checks');
    }
  }

  /**
   * Try to play ambient audio
   * 🎯 KEY: Plays FACE animation WITHOUT changing body animation!
   */
  private async tryPlayAmbient() {
    console.log('🎲 Trying ambient audio...');
    console.log('   - Enabled:', this.enabled);
    console.log('   - Playing:', this.isPlaying);
    console.log('   - Body state:', this.currentBodyState);
    
    // Check if enabled
    if (!this.enabled) {
      console.log('   ❌ Service disabled');
      return;
    }

    // Don't interrupt if already playing
    if (this.audioPlayback.isPlaying()) {
      console.log('   ❌ Audio service is playing');
      return;
    }

    // 🔧 SAFETY: Reset stuck flag if audio service says nothing is playing
    if (this.isPlaying && !this.audioPlayback.isPlaying()) {
      console.warn('   ⚠️ Flag was stuck! Resetting...');
      this.isPlaying = false;
    }

    if (this.isPlaying) {
      console.log('   ❌ Ambient playback in progress');
      return;
    }

    // Only play during idle/thinking body states
    if (this.currentBodyState !== 'idle' && this.currentBodyState !== 'thinking') {
      console.log('   ❌ Body not idle/thinking');
      return;
    }

    // Get clips matching current body state
    const availableClips = this.ambientClips.filter(
      clip => clip.forState === this.currentBodyState
    );

    if (availableClips.length === 0) {
      console.log('   ❌ No clips for:', this.currentBodyState);
      return;
    }

    // Pick random clip
    const randomClip = availableClips[Math.floor(Math.random() * availableClips.length)];

    // Roll probability
    const roll = Math.random();
    console.log(`   🎲 ${(roll * 100).toFixed(0)}% vs ${(randomClip.chance * 100).toFixed(0)}%`);
    
    if (roll > randomClip.chance) {
      console.log('   ❌ Failed probability');
      return;
    }

    console.log(`   ✅ Playing: ${randomClip.audioPath}`);
    await this.playAmbientClip(randomClip);
  }

  /**
   * Play ambient clip
   * 🎯 ONLY animates FACE - body animation continues unchanged!
   */
  private async playAmbientClip(clip: AmbientClip) {
    try {
      this.isPlaying = true;

      // Load CSV
      const csvResponse = await fetch(clip.csvPath);
      if (!csvResponse.ok) {
        throw new Error(`CSV not found: ${clip.csvPath}`);
      }
      const csvText = await csvResponse.text();
      const csvData = this.backend.parseCSV(csvText);

      // Check audio exists
      const audioResponse = await fetch(clip.audioPath, { method: 'HEAD' });
      if (!audioResponse.ok) {
        throw new Error(`Audio not found: ${clip.audioPath}`);
      }

      // 🎯 Start FACE lip-sync ONLY (body animation unchanged!)
      this.faceAnimationService.startLipSync(csvData);
      console.log('🎤 Face lip-sync started (body: ' + this.currentBodyState + ')');

      // Play audio
      await this.audioPlayback.playAudio(clip.audioPath);
      console.log('✅ Ambient audio finished');

      // Stop FACE lip-sync
      this.faceAnimationService.stopLipSync();

    } catch (error) {
      console.warn('⚠️ Ambient audio failed:', error);
    } finally {
      this.isPlaying = false;
    }
  }

  /**
   * Manual trigger (for testing)
   */
  async playSpecificClip(audioPath: string, csvPath: string) {
    if (this.isPlaying) {
      console.log('⚠️ Already playing');
      return;
    }

    console.log('🎵 Manual trigger:', audioPath);
    await this.playAmbientClip({
      audioPath,
      csvPath,
      forState: this.currentBodyState,
      chance: 1.0
    });
  }

  /**
   * Enable/disable
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    console.log(enabled ? '🎵 ENABLED' : '🔇 DISABLED');
    
    if (enabled) {
      this.startPeriodicCheck();
    } else {
      this.stopPeriodicCheck();
    }
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}