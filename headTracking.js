// Head tracking utilities using MediaPipe Face Landmarker
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

export class HeadPoseTracker {
  constructor(smoothingFactor = 0.3) {
    this.smoothedPose = { x: 0.5, y: 0.5, z: 1 };
    this.smoothingFactor = Math.max(0.1, Math.min(0.9, smoothingFactor));
    this.baseInterOcularDistance = 0.1;
  }

  extractHeadPoseFromLandmarks(landmarks) {
    if (!landmarks || landmarks.length < 468) {
      return null;
    }

    // Key facial landmarks indices (MediaPipe Face Mesh)
    const leftEyeInner = landmarks[133];
    const rightEyeInner = landmarks[362];
    const noseTip = landmarks[1];
    const leftEyeOuter = landmarks[33];
    const rightEyeOuter = landmarks[263];

    // Calculate face center position
    const faceX = (leftEyeInner.x + rightEyeInner.x + noseTip.x) / 3;
    const faceY = (leftEyeInner.y + rightEyeInner.y + noseTip.y) / 3;

    // Calculate inter-ocular distance (depth proxy)
    const interOcularDist = Math.sqrt(
      Math.pow(rightEyeInner.x - leftEyeInner.x, 2) +
      Math.pow(rightEyeInner.y - leftEyeInner.y, 2)
    );

    const eyeWidth = Math.sqrt(
      Math.pow(rightEyeOuter.x - leftEyeOuter.x, 2) +
      Math.pow(rightEyeOuter.y - leftEyeOuter.y, 2)
    );

    // Depth estimation based on face size
    const depthProxy = (interOcularDist + eyeWidth * 0.5) / (this.baseInterOcularDistance * 1.5);

    // Clamp values to prevent extreme movements
    const clampedX = Math.max(0.2, Math.min(0.8, faceX));
    const clampedY = Math.max(0.2, Math.min(0.8, faceY));
    const clampedZ = Math.max(0.5, Math.min(2.0, depthProxy));

    // Apply exponential moving average smoothing
    this.smoothedPose.x = this.smoothedPose.x + this.smoothingFactor * (clampedX - this.smoothedPose.x);
    this.smoothedPose.y = this.smoothedPose.y + this.smoothingFactor * (clampedY - this.smoothedPose.y);
    this.smoothedPose.z = this.smoothedPose.z + this.smoothingFactor * (clampedZ - this.smoothedPose.z);

    return { ...this.smoothedPose };
  }

  getSmoothedPose() {
    return { ...this.smoothedPose };
  }

  reset() {
    this.smoothedPose = { x: 0.5, y: 0.5, z: 1 };
  }
}

export class FaceTracker {
  constructor() {
    this.faceLandmarker = null;
    this.isReady = false;
    this.isRunning = false;
    this.videoElement = null;
    this.lastVideoTime = -1;
    this.headPoseTracker = new HeadPoseTracker(0.3);
    this.onHeadPoseUpdate = null;
  }

  async initialize() {
    try {
      console.log("Initializing FaceLandmarker...");
      
      // Load the vision module
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );

      // Try GPU first, fallback to CPU on Windows if GPU fails
      let delegate = 'GPU';
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1
        });
      } catch (gpuError) {
        console.warn('GPU delegate failed, falling back to CPU:', gpuError);
        delegate = 'CPU';
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU'
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1
        });
      }

      this.isReady = true;
      console.log(`✓ FaceLandmarker initialized successfully with ${delegate} delegate`);
      return true;
    } catch (error) {
      console.error('Error initializing FaceLandmarker:', error);
      return false;
    }
  }

  async startTracking(videoElement, onHeadPoseUpdate) {
    if (!this.isReady) {
      console.error('FaceLandmarker not initialized');
      return false;
    }

    if (!videoElement) {
      console.error('No video element provided');
      return false;
    }

    // Ensure video is ready
    if (videoElement.readyState < 2) {
      console.log('Waiting for video to be ready...');
      await new Promise((resolve) => {
        const checkReady = () => {
          if (videoElement.readyState >= 2) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }

    this.videoElement = videoElement;
    this.onHeadPoseUpdate = onHeadPoseUpdate;
    this.isRunning = true;

    // Start the detection loop
    this.detect();
    console.log("✓ Head tracking started, video readyState:", videoElement.readyState);
    return true;
  }

  detect() {
    if (!this.isRunning || !this.videoElement) return;

    const startTimeMs = performance.now();

    // Only process if we have a new frame
    if (this.videoElement.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.videoElement.currentTime;

      // Detect face landmarks
      const results = this.faceLandmarker.detectForVideo(this.videoElement, startTimeMs);

      // Extract head pose if face detected
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const headPose = this.headPoseTracker.extractHeadPoseFromLandmarks(landmarks);
        
        if (headPose && this.onHeadPoseUpdate) {
          this.onHeadPoseUpdate(headPose);
        }
      }
    }

    // Continue detection loop
    requestAnimationFrame(() => this.detect());
  }

  stopTracking() {
    this.isRunning = false;
    console.log("Head tracking stopped");
  }

  dispose() {
    this.stopTracking();
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
    }
  }
}

// Off-Axis Camera implementation
// Based on off-axis-sneaker repository implementation
export class OffAxisCamera {
  constructor(camera, options = {}) {
    this.camera = camera;
    
    // Physical calibration (in world units - adjusted for your scene scale)
    this.screenWidthWorld = options.screenWidthWorld || 60;
    this.screenHeightWorld = options.screenHeightWorld || 33.75; // 16:9 aspect ratio
    this.viewingDistanceWorld = options.viewingDistanceWorld || 70;
    
    // Base position offsets (to move camera without affecting head tracking)
    this.baseXOffset = options.baseXOffset || 0;
    this.baseYOffset = options.baseYOffset || 0;
    
    // Near and far planes
    this.nearPlane = 0.1;
    this.farPlane = 1000;
    
    // Movement sensitivity
    this.movementScale = options.movementScale || 1.5;
    this.depthScale = options.depthScale || 1.0;
  }
  
  headPoseToWorldPosition(headPose) {
    // Convert normalized head pose to world coordinates
    const normalizedX = headPose.x;
    const normalizedY = headPose.y;
    
    // Invert X and Y for natural movement
    const headXWorld = -(normalizedX - 0.5) * this.screenWidthWorld * this.movementScale + this.baseXOffset;
    const headYWorld = -(normalizedY - 0.5) * this.screenHeightWorld * this.movementScale + this.baseYOffset;
    
    // Map depth (z) to viewing distance
    const depthProxy = 1.0 / headPose.z;
    const headZWorld = this.viewingDistanceWorld * depthProxy * this.depthScale;
    
    return { x: headXWorld, y: headYWorld, z: headZWorld };
  }
  
  updateProjectionMatrix(headPosition) {
    const near = this.nearPlane;
    const far = this.farPlane;
    
    // Define screen bounds in world space (screen is at z=0)
    const screenLeft = -this.screenWidthWorld / 2;
    const screenRight = this.screenWidthWorld / 2;
    const screenBottom = -this.screenHeightWorld / 2;
    const screenTop = this.screenHeightWorld / 2;
    
    const eyeX = headPosition.x;
    const eyeY = headPosition.y;
    const eyeZ = headPosition.z;
    
    // Screen is at z=0
    const screenZ = 0;
    const viewerToScreenDistance = eyeZ - screenZ;
    
    // Prevent division by zero or negative distance
    if (viewerToScreenDistance <= 0.1) {
      return;
    }
    
    // Calculate frustum based on eye position
    // Scale by near plane distance
    const n_over_d = near / viewerToScreenDistance;
    
    const left = (screenLeft - eyeX) * n_over_d;
    const right = (screenRight - eyeX) * n_over_d;
    const bottom = (screenBottom - eyeY) * n_over_d;
    const top = (screenTop - eyeY) * n_over_d;
    
    // Update camera projection matrix with off-axis frustum
    this.camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }
  
  setCameraPosition(headPosition) {
    // Position camera at viewer's eye position
    this.camera.position.set(headPosition.x, headPosition.y, headPosition.z);
    // Look at the dragon/boss area
    this.camera.lookAt(0, 40, -80);
  }
  
  updateFromHeadPose(headPose) {
    // Convert head pose to world position
    const worldPos = this.headPoseToWorldPosition(headPose);
    
    // Update camera position
    this.setCameraPosition(worldPos);
    
    // Update projection matrix for off-axis effect
    this.updateProjectionMatrix(worldPos);
  }
}

// Convert head pose to camera position (legacy function for compatibility)
// Based on off-axis-sneaker implementation
export function headPoseToCamera(headPose, strengthX = 4, strengthY = 4, strengthZ = 2, baseZ = 100, baseY = 5) {
  // Invert X and Y for natural movement
  const cameraX = (0.5 - headPose.x) * strengthX * 20; // Scale up for your scene
  const cameraY = (0.5 - headPose.y) * strengthY * 20 + baseY; // Use baseY as the center position
  const cameraZ = baseZ - (headPose.z - 1) * strengthZ * 20;

  // Clamp camera position to reasonable limits
  const clampedX = Math.max(-60, Math.min(60, cameraX));
  const clampedY = Math.max(baseY - 40, Math.min(baseY + 40, cameraY)); // Clamp around baseY
  const clampedZ = Math.max(60, Math.min(140, cameraZ));

  return { x: clampedX, y: clampedY, z: clampedZ };
}

// Utility function to get webcam stream with Windows compatibility
export async function getWebcamStream(videoElement, options = {}) {
  const defaultOptions = {
    width: 640,
    height: 480,
    facingMode: 'user'
  };
  
  const constraints = {
    audio: false,
    video: {
      width: { ideal: options.width || defaultOptions.width },
      height: { ideal: options.height || defaultOptions.height },
      facingMode: options.facingMode || defaultOptions.facingMode
    }
  };

  try {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser');
    }

    // Request camera access
    console.log('Requesting camera access...');
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Set up video element
    videoElement.srcObject = stream;
    videoElement.setAttribute('playsinline', ''); // Important for iOS and some browsers
    videoElement.setAttribute('autoplay', '');
    videoElement.muted = true; // Mute to avoid feedback
    
    // Wait for video to be ready
    await new Promise((resolve, reject) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play()
          .then(resolve)
          .catch(reject);
      };
      videoElement.onerror = reject;
      
      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Video loading timeout')), 5000);
    });

    console.log('✓ Webcam stream initialized');
    return stream;
  } catch (error) {
    // Provide helpful error messages
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      throw new Error('Camera permission denied. Please allow camera access in your browser settings.');
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      throw new Error('No camera found. Please connect a camera and try again.');
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      throw new Error('Camera is already in use by another application. Please close other applications using the camera.');
    } else if (error.name === 'OverconstrainedError') {
      // Try again with less strict constraints
      console.warn('Camera constraints too strict, trying with relaxed constraints...');
      try {
        const relaxedStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true // Minimal constraints
        });
        videoElement.srcObject = relaxedStream;
        await videoElement.play();
        console.log('✓ Webcam stream initialized with relaxed constraints');
        return relaxedStream;
      } catch (relaxedError) {
        throw new Error('Camera available but does not support requested settings: ' + relaxedError.message);
      }
    } else if (error.name === 'SecurityError') {
      throw new Error('Camera access blocked due to security settings. Please use HTTPS or localhost.');
    } else {
      throw new Error('Failed to access camera: ' + error.message);
    }
  }
}
