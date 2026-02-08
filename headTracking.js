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

      // Create FaceLandmarker
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1
      });

      this.isReady = true;
      console.log("✓ FaceLandmarker initialized successfully");
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

    this.videoElement = videoElement;
    this.onHeadPoseUpdate = onHeadPoseUpdate;
    this.isRunning = true;

    // Start the detection loop
    this.detect();
    console.log("✓ Head tracking started");
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

// Convert head pose to camera position
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
