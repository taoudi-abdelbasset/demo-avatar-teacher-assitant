import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AvatarAnimationService } from '../services/avatar-animation.service';

@Component({
  selector: 'app-avatar-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './avatar-viewer.html',
  styleUrls: ['./avatar-viewer.css']
})
export class AvatarViewerComponent implements OnInit, OnDestroy {
  isLoading = false;
  loadingProgress = 0;
  loadingStatus = 'Initializing...';
  showAvatarCreator = false;
  avatarCreatorUrl: SafeResourceUrl;
  circumference = 2 * Math.PI * 56; // Circle circumference for progress
  
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private currentAvatarUrl = 'https://models.readyplayer.me/66473ec24c3b647e2d45ab9b.glb?morphTargets=ARKit&textureAtlas=1024';
  private isBrowser: boolean;
  private headBone: any = null;

  constructor(
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) platformId: Object,
    private animationService: AvatarAnimationService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.avatarCreatorUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://demo.readyplayer.me/avatar?frameApi'
    );
  }

  ngOnInit() {
    if (!this.isBrowser) return;

    // Load saved avatar URL from localStorage
    const savedAvatar = localStorage.getItem('avatarUrl');
    if (savedAvatar) {
      this.currentAvatarUrl = savedAvatar;
    }

    this.initScene();
    this.loadAvatar(this.currentAvatarUrl);

    // Listen for Ready Player Me messages
    window.addEventListener('message', this.handleAvatarMessage.bind(this));
  }

  ngOnDestroy() {
    if (!this.isBrowser) return;
    
    window.removeEventListener('message', this.handleAvatarMessage.bind(this));
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private initScene() {
    const container = document.getElementById('viewer');
    if (!container) return;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x667eea);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0.15, 0.4);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.15, 0);
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 3;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());

    // Start animation loop
    this.animate();
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    
    // Update body animations
    this.animationService.updateBodyAnimations();
    
    // Make head follow camera (only if not overridden by animations)
    if (this.headBone && this.camera) {
      const headWorldPos = new THREE.Vector3();
      this.headBone.getWorldPosition(headWorldPos);
      
      const direction = new THREE.Vector3();
      direction.subVectors(this.camera.position, headWorldPos).normalize();
      
      const horizontalAngle = Math.atan2(direction.x, direction.z);
      const verticalAngle = Math.asin(direction.y);
      
      this.headBone.rotation.y = THREE.MathUtils.clamp(horizontalAngle, -0.7, 0.7);
      this.headBone.rotation.x = THREE.MathUtils.clamp(-verticalAngle, -0.5, 0.5);
    }
    
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private onWindowResize() {
    const container = document.getElementById('viewer');
    if (!container) return;

    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  private loadAvatar(url: string) {
    this.isLoading = true;
    this.loadingProgress = 0;
    this.loadingStatus = 'Connecting to server...';
    
    const loader = new GLTFLoader();
    
    loader.load(
      url,
      (gltf: any) => {
        this.loadingStatus = 'Processing model...';
        this.loadingProgress = 90;

        // Clear previous avatar (keep lights)
        const objectsToRemove: THREE.Object3D[] = [];
        this.scene.children.forEach((child) => {
          if (!(child instanceof THREE.Light)) {
            objectsToRemove.push(child);
          }
        });
        objectsToRemove.forEach((obj) => this.scene.remove(obj));

        // Add new avatar
        this.scene.add(gltf.scene);
        
        // Center the model
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);

        // Store morph target meshes
        const morphMeshes: any[] = [];
        gltf.scene.traverse((node: any) => {
          if (node.morphTargetDictionary && node.morphTargetInfluences) {
            morphMeshes.push(node);
          }
        });

        // Find and store head bone for camera tracking
        this.headBone = null;
        gltf.scene.traverse((node: any) => {
          if (node.isBone) {
            const name = node.name.toLowerCase();
            if (name.includes('head') || name === 'head') {
              this.headBone = node;
              console.log('ðŸŽ¯ Found head bone:', node.name);
            }
          }
        });

        // Share with service
        this.animationService.setAvatarData(morphMeshes, gltf.scene);
        console.log('ðŸ“¤ Sent', morphMeshes.length, 'morph meshes to service');

        this.loadingProgress = 100;
        this.loadingStatus = 'Complete!';

        setTimeout(() => {
          this.isLoading = false;
          console.log('âœ… Avatar loaded successfully');
        }, 500);
      },
      (progress: any) => {
        if (progress.total > 0) {
          const percent = Math.floor((progress.loaded / progress.total) * 90); // 0-90%
          this.loadingProgress = percent;
          
          if (percent < 30) {
            this.loadingStatus = 'Downloading model...';
          } else if (percent < 60) {
            this.loadingStatus = 'Loading textures...';
          } else {
            this.loadingStatus = 'Almost ready...';
          }
        }
      },
      (error: any) => {
        console.error('âŒ Error loading avatar:', error);
        this.loadingStatus = 'Error loading avatar';
        this.isLoading = false;
      }
    );
  }

  changeAvatar() {
    this.showAvatarCreator = true;
  }

  resetCamera() {
    if (this.camera && this.controls) {
      this.camera.position.set(0, 0.15, 0.4);
      this.controls.target.set(0, 0.15, 0);
      this.controls.update();
    }
  }

  private handleAvatarMessage(event: MessageEvent) {
    try {
      const json = JSON.parse(event.data);
      
      if (json?.source !== 'readyplayerme') return;

      // Subscribe to events when iframe is ready
      if (json.eventName === 'v1.frame.ready') {
        const iframe = document.querySelector('iframe');
        iframe?.contentWindow?.postMessage(
          JSON.stringify({
            target: 'readyplayerme',
            type: 'subscribe',
            eventName: 'v1.**'
          }),
          '*'
        );
      }

      // Handle avatar export
      if (json.eventName === 'v1.avatar.exported') {
        console.log('ðŸŽ‰ New avatar created:', json.data.url);
        this.currentAvatarUrl = json.data.url;
        
        // Save to localStorage
        localStorage.setItem('avatarUrl', json.data.url);
        
        // Close iframe and load new avatar
        this.showAvatarCreator = false;
        this.loadAvatar(this.currentAvatarUrl);
      }
    } catch (e) {
      // Not a JSON message, ignore
    }
  }
}