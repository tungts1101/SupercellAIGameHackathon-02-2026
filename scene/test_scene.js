import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/FBXLoader.js";
import { Boss } from "./Boss.js";
import { FaceTracker, headPoseToCamera } from "../headTracking.js";

// Simple Character class for loading models
class SimpleCharacter {
  constructor(sceneObj, name) {
    this.sceneObj = sceneObj;
    this.name = name;
    this.model = null;
    this.mixer = null;
  }

  async load(modelPath) {
    const fbxLoader = new FBXLoader();
    this.model = await new Promise((resolve, reject) => {
      fbxLoader.load(modelPath, resolve, undefined, reject);
    });
    
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.side = THREE.DoubleSide;
        }
      }
    });
    
    this.sceneObj.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    
    if (this.model.animations && this.model.animations.length > 0) {
      const idleAction = this.mixer.clipAction(this.model.animations[0]);
      idleAction.play();
    }
    
    console.log(`✓ ${this.name} loaded`);
    return this.model;
  }
  
  setPosition(x, y, z) {
    if (this.model) this.model.position.set(x, y, z);
  }
  
  setScale(x, y, z) {
    if (this.model) this.model.scale.set(x, y, z);
  }
  
  setRotation(x, y, z) {
    if (this.model) this.model.rotation.set(x, y, z);
  }
}

// Test scene for dragon and camera work
export async function run({ scene }) {
  const { sceneObj, camera, renderer, loader, loadingMessage, mainLayer } = scene.prepare3DModel();
  
  console.log("Test Scene: Dragon Camera Work");
  
  // Switch to perspective camera for 3D viewing (from scene_02)
  const perspectiveCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  perspectiveCamera.position.set(0, 5, 100); // Initial position from scene_02
  perspectiveCamera.lookAt(0, 60, 0); // Initial target from scene_02
  
  // Setup webcam and head tracking
  const videoElement = document.createElement('video');
  videoElement.style.position = 'fixed';
  videoElement.style.bottom = '20px';
  videoElement.style.right = '20px';
  videoElement.style.width = '320px';
  videoElement.style.height = '240px';
  videoElement.style.border = '2px solid white';
  videoElement.style.borderRadius = '10px';
  videoElement.style.zIndex = '10001';
  videoElement.style.transform = 'scaleX(-1)'; // Flip horizontally
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  document.body.appendChild(videoElement);
  
  // Get webcam stream
  let headTrackingEnabled = false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480, facingMode: 'user' } 
    });
    videoElement.srcObject = stream;
    await videoElement.play();
    
    // Initialize face tracker
    const faceTracker = new FaceTracker();
    const initialized = await faceTracker.initialize();
    
    if (initialized) {
      // Start tracking
      await faceTracker.startTracking(videoElement, (headPose) => {
        if (headTrackingEnabled) {
          // Convert head pose to camera position
          const cameraPos = headPoseToCamera(headPose);
          perspectiveCamera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
          perspectiveCamera.lookAt(0, 60, 0);
        }
      });
      console.log("✓ Head tracking initialized");
    }
  } catch (error) {
    console.warn('Webcam not available:', error);
    videoElement.remove();
  }
  
  // Add lighting for metallic dragon (from scene_02)
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  sceneObj.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  sceneObj.add(directionalLight);
  
  sceneObj.background = new THREE.Color(0x1a1a2e);
  
  // Add 3D grid floor (like off-axis-sneaker)
  const gridSize = 400;
  const gridDivisions = 40;
  const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x222222);
  gridHelper.position.y = -10;
  sceneObj.add(gridHelper);
  
  // Add reference grid on back wall
  const backWallGrid = new THREE.GridHelper(400, 40, 0x444444, 0x222222);
  backWallGrid.rotation.x = Math.PI / 2;
  backWallGrid.position.z = -100;
  backWallGrid.position.y = 30;
  sceneObj.add(backWallGrid);
  
  // Create game entities using the Boss class (from scene_02)
  const boss = new Boss(sceneObj, null);
  
  try {
    // Load the dragon boss (exact implementation from scene_02)
    const dragon = await boss.load('scene.gltf', './assets/tarisland_dragon/', loadingMessage);
    dragon.position.set(0, 0, 0);
    dragon.scale.set(2, 2, 2);
    
    // Log bounding box to see model size (from scene_02)
    const box = new THREE.Box3().setFromObject(dragon);
    const size = box.getSize(new THREE.Vector3());
    console.log("Dragon size:", size);
    console.log("Dragon bounding box:", box);
    
    console.log("\n========== CAMERA TEST INFO ==========");
    console.log("Camera position:", perspectiveCamera.position);
    console.log("Camera target: (0, 60, 0)");
    
    // Test animation if available
    if (boss.mixer && boss.animations['Qishilong_stand']) {
      const idleAction = boss.mixer.clipAction(boss.animations['Qishilong_stand']);
      idleAction.play();
      console.log("Playing dragon idle animation");
    }
    
    // Load swordman on the left (using same path pattern as scene_02)
    const swordman = new SimpleCharacter(sceneObj, 'Swordman');
    await swordman.load('./assets/swordman_anim/swordman_idle.fbx');
    swordman.setPosition(-50, 0, 0); // Left side
    swordman.setScale(15, 15, 15); // Same scale as scene_02
    swordman.setRotation(0, Math.PI, 0); // Face camera
    
    // Load magician on the right (using same path pattern as scene_02)
    const magician = new SimpleCharacter(sceneObj, 'Magician');
    await magician.load('./assets/magician_anim/magician_idle.fbx');
    magician.setPosition(50, 0, 0); // Right side
    magician.setScale(15, 15, 15); // Same scale as scene_02
    magician.setRotation(0, Math.PI, 0); // Face camera
    
    // Remove loading message
    if (loadingMessage && loadingMessage.parentNode) {
      loadingMessage.remove();
    }
    
    // Animation loop with perspective camera (from scene_02)
    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      
      const delta = clock.getDelta();
      if (boss.mixer) boss.mixer.update(delta);
      if (swordman.mixer) swordman.mixer.update(delta);
      if (magician.mixer) magician.mixer.update(delta);
      
      renderer.render(sceneObj, perspectiveCamera);
    }
    animate();
    
    // Handle window resize (from scene_02)
    window.addEventListener('resize', () => {
      perspectiveCamera.aspect = window.innerWidth / window.innerHeight;
      perspectiveCamera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Camera test controls
    const controlsDiv = document.createElement('div');
    controlsDiv.style.position = 'fixed';
    controlsDiv.style.top = '20px';
    controlsDiv.style.left = '20px';
    controlsDiv.style.background = 'rgba(0, 0, 0, 0.8)';
    controlsDiv.style.padding = '20px';
    controlsDiv.style.borderRadius = '10px';
    controlsDiv.style.color = 'white';
    controlsDiv.style.zIndex = '10000';
    controlsDiv.style.fontFamily = 'monospace';
    controlsDiv.innerHTML = `
      <h3>🎥 Camera Test (Head Tracking)</h3>
      <p>Camera follows your head movement</p>
      <p id="camPos">Position: ${perspectiveCamera.position.x.toFixed(1)}, ${perspectiveCamera.position.y.toFixed(1)}, ${perspectiveCamera.position.z.toFixed(1)}</p>
      <p>Looking at: 0, 60, 0</p>
      <button id="toggleTracking" style="margin-top: 10px; padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Enable Head Tracking</button>
    `;
    document.body.appendChild(controlsDiv);
    
    // Toggle head tracking
    const toggleBtn = document.getElementById('toggleTracking');
    toggleBtn.addEventListener('click', () => {
      headTrackingEnabled = !headTrackingEnabled;
      toggleBtn.textContent = headTrackingEnabled ? 'Disable Head Tracking' : 'Enable Head Tracking';
      toggleBtn.style.background = headTrackingEnabled ? '#f44336' : '#4CAF50';
      
      if (!headTrackingEnabled) {
        // Reset to original position
        perspectiveCamera.position.set(0, 5, 100);
        perspectiveCamera.lookAt(0, 60, 0);
      }
    });
    
    // Update position display
    setInterval(() => {
      const pos = perspectiveCamera.position;
      const posElement = document.getElementById('camPos');
      if (posElement) {
        posElement.textContent = `Position: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
      }
    }, 100);

    
  } catch (error) {
    console.error('Error loading dragon:', error);
    if (loadingMessage) {
      loadingMessage.textContent = 'Failed to load dragon model';
    }
  }
}
