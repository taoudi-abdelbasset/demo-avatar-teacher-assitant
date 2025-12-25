// 🔧 UPDATED: src/app/avatar-viewer/avatar-viewer.ts
// Initializes both body and face animation services

import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { AvatarAnimationService } from '../services/avatar-animation.service';
import { FaceAnimationService } from '../services/face-animation.service';
import { filter, take } from 'rxjs/operators';

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
  
  private defaultAvatarUrl = 'https://models.readyplayer.me/66473ec24c3b647e2d45ab9b.glb?morphTargets=ARKit&textureAtlas=1024';
  private localAvatarPath = '/assets/default-avatar.glb';
  private currentAvatarUrl = '';
  
  private isBrowser: boolean;
  
  // 🎯 HEAD TRACKING - Avatar looks at camera
  private headBone: any = null;
  private neckBone: any = null;
  private spineBone: any = null;
  private avatarRoot: any = null;
  private enableHeadTracking = true;
  
  private targetCameraPosition = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();
  private cameraOffset = new THREE.Vector3(0, 0, 0.8);
  private smoothingFactor = 0.1;
  private followHeadMode = false;
  private userInteracted = false;

  constructor(
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) platformId: Object,
    private bodyAnimationService: AvatarAnimationService,
    private faceAnimationService: FaceAnimationService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.avatarCreatorUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://demo.readyplayer.me/avatar?frameApi'
    );
  }

  ngOnInit() {
    if (!this.isBrowser) return;

    this.initScene();
    this.loadAvatarWithFallback();
    window.addEventListener('message', this.handleAvatarMessage.bind(this));
  }

  ngOnDestroy() {
    if (!this.isBrowser) return;
    window.removeEventListener('message', this.handleAvatarMessage.bind(this));
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private async initScene() {
    const container = document.getElementById('viewer');
    if (!container) return;

    this.scene = new THREE.Scene();
    
    this.loadHDREnvironment();

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.6, 2.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1.6, 0);
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 5.0;

    this.controls.addEventListener('start', () => {
      this.userInteracted = true;
      this.followHeadMode = false;
    });

    // Ground plane
    const groundGeometry = new THREE.CircleGeometry(10, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      opacity: 0.3
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(5, 10, 0x888888, 0x444444);
    gridHelper.position.y = 0.01;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.2;
    this.scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(1);
    axesHelper.position.set(0, 0, 0);
    this.scene.add(axesHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  private loadHDREnvironment() {
    const rgbeLoader = new RGBELoader();
    
    rgbeLoader.load(
      '/assets/environment.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = texture;
        this.scene.environment = texture;
        console.log('✅ HDR environment loaded');
      },
      undefined,
      (error) => {
        console.warn('⚠️ HDR not found, using gradient sky');
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.5, '#B0E0E6');
        gradient.addColorStop(1, '#F0F8FF');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = texture;
        console.log('✅ Gradient sky created');
      }
    );
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    
    // 🎬 Update BODY animations FIRST
    this.bodyAnimationService.updateBodyAnimations();
    
    // 👀 THEN apply head tracking (works on top of body animations)
    if (this.enableHeadTracking && this.headBone) {
      this.updateHeadLookAt();
    }
    
    // 📷 Camera follow mode
    if (this.headBone && this.followHeadMode) {
      const headWorldPos = new THREE.Vector3();
      this.headBone.getWorldPosition(headWorldPos);
      
      const headWorldQuat = new THREE.Quaternion();
      this.headBone.getWorldQuaternion(headWorldQuat);
      
      const rotatedOffset = this.cameraOffset.clone().applyQuaternion(headWorldQuat);
      
      this.targetCameraPosition.copy(headWorldPos).add(rotatedOffset);
      this.camera.position.lerp(this.targetCameraPosition, this.smoothingFactor);
      
      this.targetLookAt.copy(headWorldPos);
      this.controls.target.lerp(this.targetLookAt, this.smoothingFactor);
    }
    
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // 🎯 HEAD TRACKING - Works with body animations
  private updateHeadLookAt() {
    if (!this.headBone) return;

    const cameraWorldPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraWorldPos);
    
    const headWorldPos = new THREE.Vector3();
    this.headBone.getWorldPosition(headWorldPos);
    
    const direction = new THREE.Vector3().subVectors(cameraWorldPos, headWorldPos);
    direction.normalize();
    
    const targetQuaternion = new THREE.Quaternion();
    const lookAtMatrix = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    
    lookAtMatrix.lookAt(cameraWorldPos, headWorldPos, up);
    targetQuaternion.setFromRotationMatrix(lookAtMatrix);
    
    if (this.headBone.parent) {
      const parentWorldQuat = new THREE.Quaternion();
      this.headBone.parent.getWorldQuaternion(parentWorldQuat);
      parentWorldQuat.invert();
      targetQuaternion.premultiply(parentWorldQuat);
    }
    
    const euler = new THREE.Euler().setFromQuaternion(targetQuaternion, 'XYZ');
    
    const maxYaw = Math.PI / 3;
    const maxPitch = Math.PI / 4;
    
    euler.y = THREE.MathUtils.clamp(euler.y, -maxYaw, maxYaw);
    euler.x = THREE.MathUtils.clamp(euler.x, -maxPitch, maxPitch);
    euler.z = 0;
    
    const smoothFactor = 0.05;
    
    this.headBone.rotation.x = THREE.MathUtils.lerp(
      this.headBone.rotation.x,
      euler.x,
      smoothFactor
    );
    
    this.headBone.rotation.y = THREE.MathUtils.lerp(
      this.headBone.rotation.y,
      euler.y,
      smoothFactor
    );
    
    this.headBone.rotation.z = THREE.MathUtils.lerp(
      this.headBone.rotation.z,
      euler.z,
      smoothFactor
    );
    
    if (this.neckBone) {
      this.neckBone.rotation.x = THREE.MathUtils.lerp(
        this.neckBone.rotation.x,
        euler.x * 0.3,
        smoothFactor
      );
      
      this.neckBone.rotation.y = THREE.MathUtils.lerp(
        this.neckBone.rotation.y,
        euler.y * 0.3,
        smoothFactor
      );
    }
  }

  private onWindowResize() {
    const container = document.getElementById('viewer');
    if (!container) return;

    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  private async loadAvatarWithFallback() {
    const savedAvatar = localStorage.getItem('avatarUrl');
    
    if (savedAvatar) {
      console.log('📥 Trying saved avatar:', savedAvatar);
      const success = await this.tryLoadAvatar(savedAvatar);
      if (success) return;
      console.warn('⚠️ Saved avatar failed, trying fallbacks...');
    }

    console.log('📥 Trying local asset:', this.localAvatarPath);
    const localSuccess = await this.tryLoadAvatar(this.localAvatarPath);
    if (localSuccess) {
      console.log('✅ Loaded local backup avatar');
      return;
    }

    console.log('📥 Trying default online avatar:', this.defaultAvatarUrl);
    const onlineSuccess = await this.tryLoadAvatar(this.defaultAvatarUrl);
    if (onlineSuccess) {
      console.log('✅ Loaded default online avatar');
      return;
    }

    console.error('❌ All avatar sources failed!');
    this.loadingStatus = 'Failed to load avatar';
    this.isLoading = false;
  }

  private async tryLoadAvatar(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.isLoading = true;
      this.loadingProgress = 0;
      this.loadingStatus = 'Loading avatar...';
      this.currentAvatarUrl = url;
      
      const loader = new GLTFLoader();
      
      loader.load(
        url,
        (gltf: any) => {
          this.loadingStatus = 'Processing model...';
          this.loadingProgress = 90;

          // Clear scene
          const objectsToRemove: THREE.Object3D[] = [];
          this.scene.children.forEach((child) => {
            if (!(child instanceof THREE.Light) && 
                !(child instanceof THREE.GridHelper) && 
                !(child instanceof THREE.AxesHelper) &&
                !(child instanceof THREE.Mesh && child.geometry instanceof THREE.CircleGeometry)) {
              objectsToRemove.push(child);
            }
          });
          objectsToRemove.forEach((obj) => this.scene.remove(obj));

          this.scene.add(gltf.scene);
          this.avatarRoot = gltf.scene;
          
          // Center avatar
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          gltf.scene.position.sub(center);
          gltf.scene.position.y = 0;
          
          console.log(`📏 Avatar size: ${size.y.toFixed(2)}m tall`);

          // 😊 Find FACE meshes with morph targets
          const morphMeshes: any[] = [];
          gltf.scene.traverse((node: any) => {
            if (node.morphTargetDictionary && node.morphTargetInfluences) {
              morphMeshes.push(node);
            }
          });
          console.log('😊 Found', morphMeshes.length, 'face meshes');

          // 🎯 Find bones for head tracking
          this.headBone = null;
          this.neckBone = null;
          this.spineBone = null;
          
          gltf.scene.traverse((node: any) => {
            if (node.isBone) {
              const name = node.name.toLowerCase();
              
              if (name === 'head' || name.includes('head')) {
                this.headBone = node;
                console.log('🎯 Found HEAD bone:', node.name);
              }
              
              if (name === 'neck' || name.includes('neck')) {
                this.neckBone = node;
                console.log('🎯 Found NECK bone:', node.name);
              }
              
              if (name === 'spine' || name.includes('spine')) {
                this.spineBone = node;
              }
            }
          });

          // 🎬 Initialize with BOTH face meshes AND body data
          this.bodyAnimationService.setAvatarData(morphMeshes, gltf.scene, gltf.animations);
          console.log('🎬 Body animation service initialized');

          // 😊 Initialize FACE animation service
          this.faceAnimationService.setMorphTargetMeshes(morphMeshes);
          console.log('😊 Face animation service initialized');

          this.loadingProgress = 100;
          this.loadingStatus = 'Complete!';

          // ✅ Wait for body animations to load, THEN start idle
          const readySub = this.bodyAnimationService.ready$
            .pipe(
              filter((ready: boolean) => ready === true),
              take(1)
            )
            .subscribe(() => {
              console.log('🎬 Body animations ready → Starting idle');
              this.bodyAnimationService.setAvatarState('idle');
              
              // Hide loading screen
              setTimeout(() => {
                this.isLoading = false;
                console.log('✅ Avatar fully loaded');
                console.log('👀 Head tracking:', this.enableHeadTracking ? 'ENABLED' : 'DISABLED');
              }, 200);
            });

          resolve(true);
        },
        (progress: any) => {
          if (progress.total > 0) {
            const percent = Math.floor((progress.loaded / progress.total) * 90);
            this.loadingProgress = percent;
            
            if (percent < 30) this.loadingStatus = 'Downloading model...';
            else if (percent < 60) this.loadingStatus = 'Loading textures...';
            else this.loadingStatus = 'Almost ready...';
          }
        },
        (error: any) => {
          console.error('❌ Error loading avatar:', error);
          this.isLoading = false;
          resolve(false);
        }
      );
    });
  }

  changeAvatar() {
    this.showAvatarCreator = true;
  }

  resetCamera() {
    this.followHeadMode = false;
    this.userInteracted = false;
    if (this.camera && this.controls) {
      this.camera.position.set(0, 1.6, 2.5);
      this.controls.target.set(0, 1.6, 0);
      this.controls.update();
    }
  }

  toggleFollowMode() {
    this.followHeadMode = !this.followHeadMode;
    console.log('📷 Camera follow mode:', this.followHeadMode ? 'ON' : 'OFF');
  }

  toggleHeadTracking() {
    this.enableHeadTracking = !this.enableHeadTracking;
    console.log('👀 Head tracking:', this.enableHeadTracking ? 'ON' : 'OFF');
    
    if (!this.enableHeadTracking) {
      if (this.headBone) {
        this.headBone.rotation.set(0, 0, 0);
      }
      if (this.neckBone) {
        this.neckBone.rotation.set(0, 0, 0);
      }
    }
  }

  async downloadCurrentModel() {
    if (!this.currentAvatarUrl) {
      console.warn('⚠️ No model loaded to download');
      return;
    }

    try {
      console.log('📥 Downloading model...');
      const response = await fetch(this.currentAvatarUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'default-avatar.glb';
      a.click();
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Model downloaded! Save to /assets/ folder');
    } catch (error) {
      console.error('❌ Download failed:', error);
    }
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
        this.tryLoadAvatar(this.currentAvatarUrl);
      }
    } catch (e) {
      // Not a JSON message
    }
  }
}