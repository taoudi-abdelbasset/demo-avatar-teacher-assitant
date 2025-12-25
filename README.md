# AI Avatar Chat System

An interactive 3D avatar chat application with real-time lip-sync, body animations, and ambient behaviors built with Angular and Three.js.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Service Layer](#service-layer)
- [Animation System](#animation-system)
- [Flow Diagrams](#flow-diagrams)
- [Project Structure](#project-structure)
- [Setup](#setup)

---

## Features

### 1. Avatar System
- **3D Avatar Rendering** - Ready Player Me avatars with full rigging
- **Facial Animation** - 52 ARKit blendshapes for realistic expressions
- **Body Animation** - Idle, thinking, and talking poses with smooth transitions
- **Head Tracking** - Avatar looks at camera with natural eye contact
- **Ambient Behaviors** - Random idle animations and voice clips

### 2. Chat Interface
- **Multi-conversation** - Switch between different chat sessions
- **Image Upload** - Send images with messages
- **Audio Playback** - Listen to avatar responses with lip-sync
- **Replay Messages** - Re-listen to any message
- **Real-time Status** - Visual indicators for thinking/talking states

---

## Architecture Overview

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[Chat Interface]
        AV[Avatar Viewer]
    end

    subgraph "Service Layer"
        AS[Avatar Animation Service<br/>Orchestrator]
        FAS[Face Animation Service<br/>Lip-sync & Expressions]
        BAS[Body Animation Loader<br/>Body Poses]
        APS[Audio Playback Service<br/>Audio Management]
        AAS[Ambient Audio Service<br/>Background Voice]
        BS[Backend Service<br/>API Communication]
    end

    subgraph "3D Rendering"
        THREE[Three.js Scene]
        GLTF[GLTF Loader]
        FBX[FBX Loader]
    end

    UI -->|Send Message| BS
    UI -->|Replay| APS
    
    BS -->|Response + CSV| AS
    
    AS -->|Face Meshes| FAS
    AS -->|Body Model| BAS
    AS -->|State Changes| AAS
    
    FAS -->|Blendshapes| THREE
    BAS -->|Bone Rotations| THREE
    APS -->|Current Time| FAS
    
    AAS -->|Trigger Clips| APS
    AAS -->|Lip-sync Data| FAS
    
    AV -->|Load Avatar| GLTF
    BAS -->|Load Animations| FBX
    
    THREE -->|Render| AV
    
    style AS fill:#9333ea,color:#fff
    style FAS fill:#ec4899,color:#fff
    style BAS fill:#3b82f6,color:#fff
    style AAS fill:#10b981,color:#fff
```

---

## Service Layer

### 1. Avatar Animation Service (Orchestrator)
**Role:** Central coordinator for all avatar animations

```typescript
class AvatarAnimationService {
  // Manages body state (idle/thinking/talking)
  setAvatarState(state: 'idle' | 'thinking' | 'talking')
  
  // Face animation (lip-sync)
  startLipSync(csvData: any[])
  stopLipSync()
  
  // Distributes data to specialized services
  setAvatarData(meshes, model, animations)
}
```

**Coordinates:**
- Face animations (through FaceAnimationService)
- Body animations (through BodyAnimationLoaderService)
- State transitions (idle ↔ thinking ↔ talking)

---

### 2. Face Animation Service
**Role:** Controls facial expressions and lip-sync

```typescript
class FaceAnimationService {
  // Morph target meshes (face)
  setMorphTargetMeshes(meshes: any[])
  
  // Lip-sync with audio
  startLipSync(csvData: any[])
  stopLipSync()
  
  // Manual expressions
  applyFaceBlendshapes(params: any)
}
```

**Features:**
- **Independent from body** - Face can animate while body is idle/thinking
- **Audio-synced** - Reads audio playback time for perfect sync
- **52 Blendshapes** - Full ARKit facial animation support

---

### 3. Body Animation Loader Service
**Role:** Manages body poses and animations

```typescript
class BodyAnimationLoaderService {
  // Load and setup
  setAvatarModel(model: Object3D, animations: AnimationClip[])
  
  // Play animations
  playRandomAnimation(state: 'idle' | 'thinking' | 'talking')
  
  // Animation system
  update() // Called every frame
}
```

**Animation States:**
- **Idle** - Breathing, standing, looking around
- **Thinking** - Contemplative poses
- **Talking** - Hand gestures, body movement

---

### 4. Audio Playback Service
**Role:** Handles all audio playback

```typescript
class AudioPlaybackService {
  playAudio(url: string): Promise<void>
  stop()
  getCurrentTime(): number // For lip-sync
  isPlaying(): boolean
}
```

**Features:**
- Promise-based playback
- Real-time position tracking
- State management

---

### 5. Ambient Audio Service
**Role:** Plays background voice clips during idle/thinking

```typescript
class AmbientAudioService {
  // Automatic playback every 8-12 seconds
  // Plays FACE animation WITHOUT changing body state
  
  setEnabled(enabled: boolean)
  playSpecificClip(audioPath, csvPath)
}
```

**Behavior:**
- Monitors body state (idle/thinking)
- Random probability checks (30%, 70%, 95%)
- Face lip-sync only - body keeps current animation

---

### 6. Backend Service
**Role:** API communication and data processing

```typescript
class BackendService {
  sendMessage(text: string, images?: string[]): Promise<Response>
  parseCSV(csvData: string): any[]
}
```

---

## Animation System

### 1. State Flow

```mermaid
stateDiagram-v2
    [*] --> Idle: Avatar Loads
    
    Idle --> Thinking: User Sends Message
    Thinking --> Talking: Response Received
    Talking --> Idle: Audio Ends
    
    Idle --> Idle: Ambient Audio<br/>(Face only)
    Thinking --> Thinking: Ambient Audio<br/>(Face only)
    
    Idle --> Talking: Replay Message
    Talking --> Idle: Replay Ends
    
    note right of Idle
        Body: Breathing/Standing
        Face: Neutral + Blinks
        Ambient: Active
    end note
    
    note right of Thinking
        Body: Contemplative Pose
        Face: Thinking Expression
        Ambient: Active
    end note
    
    note right of Talking
        Body: Gesturing/Moving
        Face: Lip-sync Active
        Ambient: Disabled
    end note
```

### 2. Animation Layers

```mermaid
graph LR
    subgraph "Body Layer"
        B1[Idle Animation]
        B2[Thinking Animation]
        B3[Talking Animation]
    end
    
    subgraph "Face Layer"
        F1[Lip-sync<br/>Blendshapes]
        F2[Expressions]
    end
    
    subgraph "Head Layer"
        H1[Head Tracking<br/>Look at Camera]
    end
    
    B1 --> Avatar
    B2 --> Avatar
    B3 --> Avatar
    
    F1 --> Avatar
    F2 --> Avatar
    
    H1 --> Avatar
    
    Avatar[3D Avatar]
    
    style B1 fill:#3b82f6
    style B2 fill:#3b82f6
    style B3 fill:#3b82f6
    style F1 fill:#ec4899
    style F2 fill:#ec4899
    style H1 fill:#10b981
```

**Key Concept:** Each layer operates independently and combines in real-time!

---

## Message Flow

### 1. New Message Flow

```mermaid
sequenceDiagram
    participant User
    participant ChatUI
    participant Backend
    participant Avatar
    participant Face
    participant Body
    participant Audio

    User->>ChatUI: Types & Sends Message
    ChatUI->>Body: setState('thinking')
    Body->>Body: Play Thinking Animation
    
    ChatUI->>Backend: sendMessage(text)
    Note over Backend: 10 seconds processing
    
    Backend-->>ChatUI: Response (text + audio + CSV)
    
    ChatUI->>Body: setState('talking')
    Body->>Body: Switch to Talking Animation
    
    ChatUI->>Face: startLipSync(csvData)
    ChatUI->>Audio: playAudio(url)
    
    par Parallel Playback
        Face->>Face: Animate Mouth (synced)
        Body->>Body: Animate Body (gestures)
        Audio->>Audio: Play Sound
    end
    
    Audio-->>ChatUI: Audio Finished
    
    ChatUI->>Face: stopLipSync()
    ChatUI->>Body: setState('idle')
    
    Body->>Body: Return to Idle Animation
```

### 2. Ambient Audio Flow

```mermaid
sequenceDiagram
    participant Timer
    participant Ambient
    participant Body
    participant Face
    participant Audio

    Note over Timer: Every 8-12 seconds
    
    Timer->>Ambient: Check if can play
    Ambient->>Ambient: Check state (idle/thinking)
    Ambient->>Ambient: Roll probability (30%-95%)
    
    alt Passed Check
        Ambient->>Audio: playAudio(clip)
        Ambient->>Face: startLipSync(csvData)
        
        Note over Body: Body animation<br/>UNCHANGED
        Note over Face: Face animates<br/>for lip-sync
        
        Audio-->>Ambient: Finished
        Ambient->>Face: stopLipSync()
        
        Note over Body: Still in<br/>idle/thinking
    else Failed Check
        Ambient->>Timer: Wait for next check
    end
```

---

## Project Structure

```
src/app/
├── services/                    # Business Logic Layer
│   ├── avatar-animation.service.ts      # Orchestrator
│   ├── face-animation.service.ts        # Face/Lip-sync
│   ├── body-animation-loader.service.ts # Body Animations
│   ├── audio-playback.service.ts        # Audio Control
│   ├── ambient-audio.service.ts         # Background Voice
│   └── backend.service.ts               # API Communication
│
├── avatar-viewer/               # 3D Rendering Component
│   ├── avatar-viewer.ts         # Three.js scene setup
│   ├── avatar-viewer.html       # Canvas + controls
│   └── avatar-viewer.css        # Styling
│
└── chat-interface/              # Chat UI Component
    ├── chat-interface.ts        # Message handling
    ├── chat-interface.html      # Sidebar + messages
    └── chat-interface.css       # Chat styling

public/assets/
├── ambient-audio/               # Ambient voice clips
│   ├── idle/                    # Idle state clips
│   │   ├── hello.wav + .csv
│   │   ├── still_waiting.wav + .csv
│   │   └── here_to_help.wav + .csv
│   └── thinking/                # Thinking state clips
│       └── let_me_think.wav + .csv
│
├── body-animations/             # FBX animations
│   ├── idle/                    # Idle poses
│   ├── thinking/                # Thinking poses
│   └── talking/                 # Talking gestures
│
├── default-avatar.glb           # 3D avatar model
├── environment.hdr              # HDR lighting
├── animation_frames.csv         # Response lip-sync data
└── out.wav                      # Response audio
```

---

## Setup

### 1. Prerequisites
```bash
Node.js >= 18
Angular CLI >= 18
```

### 2. Installation
```bash
# Install dependencies
npm install

# Start development server
ng serve

# Open browser
http://localhost:4200
```

### 3. Adding Assets

**Avatar Model:**
1. Export from Ready Player Me with ARKit morphTargets
2. Save as `default-avatar.glb` in `public/assets/`

**Body Animations:**
1. Export from Mixamo as FBX
2. Place in appropriate state folder:
   - `public/assets/body-animations/idle/`
   - `public/assets/body-animations/thinking/`
   - `public/assets/body-animations/talking/`

**Ambient Audio:**
1. Create audio file (WAV format)
2. Generate CSV with blendshape data (same format as response)
3. Place both in:
   - `public/assets/ambient-audio/idle/` or
   - `public/assets/ambient-audio/thinking/`

---

## Performance

- **FPS Target:** 60 FPS
- **Animation Update:** Every frame
- **State Checks:** Every 8-12 seconds (ambient)
- **CSV Parsing:** Once per response
- **Audio Sync:** 30 FPS tolerance (0.033s)

---

## Customization

### 1. Adding New Body Animations
1. Export FBX from Mixamo
2. Place in appropriate state folder
3. Service auto-loads and categorizes by folder name

### 2. Adding New Ambient Clips
1. Record voice line
2. Generate CSV blendshapes
3. Add to `ambientClips` array in `ambient-audio.service.ts`:
```typescript
{
  audioPath: '/assets/ambient-audio/idle/new_clip.wav',
  csvPath: '/assets/ambient-audio/idle/new_clip.csv',
  forState: 'idle',
  chance: 0.5
}
```

### 3. Changing Probabilities
Edit chances in `ambient-audio.service.ts`:
```typescript
chance: 0.3  // 30% chance
chance: 0.7  // 70% chance
chance: 0.95 // 95% chance
```

---

## License

MIT

---

## Contributing

Pull requests welcome! Please follow existing code style and add appropriate console logging.