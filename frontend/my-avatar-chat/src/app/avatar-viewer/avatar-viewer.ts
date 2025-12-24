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
  circumference = 2 * Math.PI * 56;
  
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private currentAvatarUrl = 'https://models.readyplayer.me/66473ec24c3b647e2d45ab9b.glb?morphTargets=ARKit&textureAtlas=1024';
  private isBrowser: boolean;
  private headBone: any = null;
  
  // For smooth camera following
  private targetCameraPosition = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();
  private cameraOffset = new THREE.Vector3(0, 0, 0.8); // Offset from head
  private smoothingFactor = 0.1; // Lower = smoother, 0.1 = smooth
  private followHeadMode = true; // Toggle for camera following
  private userInteracted = false; // Track if user manually moved camera

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

    const savedAvatar = localStorage.getItem('avatarUrl');
    if (savedAvatar) {
      this.currentAvatarUrl = savedAvatar;
    }

    this.initScene();
    this.loadAvatar(this.currentAvatarUrl);
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

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x667eea);

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.6, 0.8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1.6, 0);
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 2;

    // Detect when user interacts with controls to disable follow mode
    this.controls.addEventListener('start', () => {
      this.userInteracted = true;
      this.followHeadMode = false;
    });

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    
    this.animationService.updateBodyAnimations();
    
    // **SMOOTH CAMERA FOLLOWING WITH ROTATION** 🎯
    if (this.headBone && this.followHeadMode) {
      // Get head world position
      const headWorldPos = new THREE.Vector3();
      this.headBone.getWorldPosition(headWorldPos);
      
      // Get head world rotation
      const headWorldQuat = new THREE.Quaternion();
      this.headBone.getWorldQuaternion(headWorldQuat);
      
      // Calculate camera offset based on head rotation
      const rotatedOffset = this.cameraOffset.clone().applyQuaternion(headWorldQuat);
      
      // Target camera position = head position + rotated offset
      this.targetCameraPosition.copy(headWorldPos).add(rotatedOffset);
      
      // Smoothly interpolate camera position
      this.camera.position.lerp(this.targetCameraPosition, this.smoothingFactor);
      
      // Smoothly interpolate look-at target
      this.targetLookAt.copy(headWorldPos);
      this.controls.target.lerp(this.targetLookAt, this.smoothingFactor);
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

        const objectsToRemove: THREE.Object3D[] = [];
        this.scene.children.forEach((child) => {
          if (!(child instanceof THREE.Light)) {
            objectsToRemove.push(child);
          }
        });
        objectsToRemove.forEach((obj) => this.scene.remove(obj));

        this.scene.add(gltf.scene);
        
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        gltf.scene.position.sub(center);
        gltf.scene.position.y = 0;
        
        console.log(`📏 Avatar size: ${size.y.toFixed(2)}m tall`);
        console.log(`📍 Avatar positioned at origin`);

        const morphMeshes: any[] = [];
        gltf.scene.traverse((node: any) => {
          if (node.morphTargetDictionary && node.morphTargetInfluences) {
            morphMeshes.push(node);
          }
        });

        this.headBone = null;
        gltf.scene.traverse((node: any) => {
          if (node.isBone) {
            const name = node.name.toLowerCase();
            if (name === 'head' || name.includes('head')) {
              this.headBone = node;
              console.log('🎯 Found head bone:', node.name);
            }
          }
        });

        if (gltf.animations && gltf.animations.length > 0) {
          console.log('🎬 Built-in animations found:', gltf.animations.length);
          gltf.animations.forEach((clip: THREE.AnimationClip, i: number) => {
            console.log(`  ${i}: ${clip.name} (${clip.duration.toFixed(2)}s)`);
          });
        } else {
          console.log('ℹ️ No built-in animations in this model');
        }

        this.animationService.setAvatarData(morphMeshes, gltf.scene, gltf.animations);
        console.log('📤 Sent', morphMeshes.length, 'morph meshes to service');

        this.loadingProgress = 100;
        this.loadingStatus = 'Complete!';

        setTimeout(() => {
          this.isLoading = false;
          console.log('✅ Avatar loaded successfully');
        }, 500);
      },
      (progress: any) => {
        if (progress.total > 0) {
          const percent = Math.floor((progress.loaded / progress.total) * 90);
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
        console.error('❌ Error loading avatar:', error);
        this.loadingStatus = 'Error loading avatar';
        this.isLoading = false;
      }
    );
  }

  changeAvatar() {
    this.showAvatarCreator = true;
  }

  resetCamera() {
    this.followHeadMode = true;
    this.userInteracted = false;
    if (this.camera && this.controls) {
      this.camera.position.set(0, 1.6, 0.8);
      this.controls.target.set(0, 1.6, 0);
      this.controls.update();
    }
  }

  toggleFollowMode() {
    this.followHeadMode = !this.followHeadMode;
    console.log('📷 Follow mode:', this.followHeadMode ? 'ON' : 'OFF');
  }

  private handleAvatarMessage(event: MessageEvent) {
    try {
      const json = JSON.parse(event.data);
      
      if (json?.source !== 'readyplayerme') return;

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

      if (json.eventName === 'v1.avatar.exported') {
        console.log('🎨 New avatar created:', json.data.url);
        this.currentAvatarUrl = json.data.url;
        localStorage.setItem('avatarUrl', json.data.url);
        this.showAvatarCreator = false;
        this.loadAvatar(this.currentAvatarUrl);
      }
    } catch (e) {
      // Not a JSON message, ignore
    }
  }
}