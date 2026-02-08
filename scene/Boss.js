import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

// Boss class for managing the dragon boss
export class Boss {
  constructor(sceneObj, effectManager) {
    this.sceneObj = sceneObj;
    this.effectManager = effectManager;
    this.model = null;
    this.mixer = null;
    this.animations = {};
    this.currentAction = null;
    this.idleAction = null;
    this.combatSystem = null; // Will be set later
    
    // Combat stats
    this.maxHealth = 300;
    this.health = 300;
    this.isDead = false;
    
    // UI elements
    this.healthBar = null;
    this.uiGroup = null;
    this.camera = null;
    this.healthBarWidth = 40;
  }

  async load(gltfPath, texturesPath, loadingMessage) {
    const gltfLoader = new GLTFLoader();
    gltfLoader.setPath(texturesPath);
    
    console.log("Loading boss model...");
    const gltf = await new Promise((resolve, reject) => {
      gltfLoader.load(
        gltfPath,
        resolve,
        (progress) => {
          console.log("Prepare for battle ...");
          if (loadingMessage) {
            loadingMessage.innerHTML = `Prepare for battle ...`;
          }
        },
        reject
      );
    });
    
    this.model = gltf.scene;
    this.sceneObj.add(this.model);
    this.setupAnimations(gltf.animations, texturesPath);
    
    return this.model;
  }

  setupAnimations(animationClips, texturesPath) {
    if (!animationClips || animationClips.length === 0) {
      console.log("No animations found in boss model");
      return;
    }

    console.log(`Found ${animationClips.length} boss animations`);
    
    // Fix animation timings (they're sequential)
    let previousEndTime = 0;
    animationClips.forEach((clip, index) => {
      const originalDuration = clip.duration;
      const actualDuration = originalDuration - previousEndTime;
      
      const tracks = clip.tracks.map(track => {
        const newTrack = track.clone();
        newTrack.times = newTrack.times.map(t => t - previousEndTime);
        return newTrack;
      });
      
      const correctedClip = new THREE.AnimationClip(clip.name, actualDuration, tracks);
      this.animations[clip.name] = correctedClip;
      
      previousEndTime = originalDuration;
    });
    
    // Create animation mixer
    this.mixer = new THREE.AnimationMixer(this.model);
    
    // Find and play idle animation
    const standAnimNames = ['Qishilong_stand', 'stand', 'idle', 'Idle', 'Stand'];
    let standAnimName = standAnimNames.find(name => this.animations[name]);
    
    if (!standAnimName) {
      const allNames = Object.keys(this.animations);
      standAnimName = allNames.find(n => n.toLowerCase().includes('stand') || n.toLowerCase().includes('idle'));
    }
    
    if (standAnimName && this.animations[standAnimName]) {
      this.idleAction = this.mixer.clipAction(this.animations[standAnimName]);
      this.idleAction.play();
      this.currentAction = this.idleAction;
      console.log(`✓ Playing boss idle animation: "${standAnimName}"`);
    }
  }

  playAnimation(animationNames, returnToIdle = true) {
    let currentIndex = 0;
    
    if (this.idleAction) {
      this.idleAction.stop();
    }
    
    const playNext = () => {
      if (currentIndex >= animationNames.length) {
        if (returnToIdle && this.idleAction) {
          this.idleAction.reset();
          this.idleAction.play();
          this.currentAction = this.idleAction;
        }
        return;
      }
      
      const animName = animationNames[currentIndex];
      const clip = this.animations[animName];
      
      if (!clip) {
        console.warn(`Boss animation "${animName}" not found`);
        currentIndex++;
        playNext();
        return;
      }
      
      this.mixer.stopAllAction();
      const action = this.mixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      this.currentAction = action;
      
      // Trigger combat system for attacks
      if (this.combatSystem) {
        const effectDelay = clip.duration * 0.3; // Start decision window earlier
        setTimeout(() => {
          this.combatSystem.handleBossAttack(animName);
        }, effectDelay * 1000);
      }
      
      // Trigger effects based on animation
      if (this.effectManager) {
        const effectDelay = clip.duration * 0.5;
        
        // BreathFireHigh - fire explosion on 3-5 random locations
        if (animName === 'Qishilong_skill10') {
          setTimeout(() => {
            const dragonPos = this.model.position.clone();
            dragonPos.y += 80;
            dragonPos.z += 30;
            this.effectManager.createFireExplosion(dragonPos, 3.0, Math.floor(Math.random() * 3) + 3);
          }, effectDelay * 1000);
        }
        
        // BreathFireLow - fire wave from left to right
        if (animName === 'Qishilong_skill06') {
          setTimeout(() => {
            this.effectManager.createFireWave();
          }, effectDelay * 1000);
        }
        
        // Roar - camera shake + broken screen
        if (animName === 'Qishilong_skill09') {
          setTimeout(() => {
            this.effectManager.createCameraShake(2.0, 0.6);
            this.effectManager.createBrokenScreenEffect();
          }, effectDelay * 1000);
        }
        
        // SweptClaw - triple diagonal claw slashes
        if (animName === 'Qishilong_attack01') {
          setTimeout(() => {
            this.effectManager.createClawSlashEffect();
          }, effectDelay * 1000);
        }
        
        // SweptTail - horizontal slash across screen
        if (animName === 'Qishilong_skill11') {
          setTimeout(() => {
            const slash = document.createElement('div');
            slash.style.position = 'fixed';
            slash.style.top = '50%';
            slash.style.left = '0';
            slash.style.pointerEvents = 'none';
            slash.style.zIndex = '1000';
            slash.style.width = '100%';
            slash.style.height = '10px';
            slash.style.background = 'linear-gradient(90deg, transparent 0%, rgba(100, 150, 255, 0.9) 50%, transparent 100%)';
            slash.style.boxShadow = '0 0 30px rgba(100, 150, 255, 0.8), 0 0 60px rgba(100, 150, 255, 0.6)';
            slash.style.transform = 'translateY(-50%) scaleX(0)';
            slash.style.transformOrigin = 'left center';
            slash.style.animation = 'slashHorizontal 0.5s ease-out forwards';
            
            document.body.appendChild(slash);
            
            // Ensure animation exists
            if (!document.getElementById('slash-horizontal-style')) {
              const style = document.createElement('style');
              style.id = 'slash-horizontal-style';
              style.textContent = `
                @keyframes slashHorizontal {
                  0% {
                    transform: translateY(-50%) scaleX(0);
                    opacity: 1;
                  }
                  70% {
                    transform: translateY(-50%) scaleX(1);
                    opacity: 1;
                  }
                  100% {
                    transform: translateY(-50%) scaleX(1);
                    opacity: 0;
                  }
                }
              `;
              document.head.appendChild(style);
            }
            
            setTimeout(() => {
              slash.remove();
            }, 600);
          }, effectDelay * 1000);
        }
        
        // StompFoot - camera shake up and down
        if (animName === 'Qishilong_attack02') {
          setTimeout(() => {
            this.effectManager.createCameraShake(1.5, 0.4, 'vertical');
          }, effectDelay * 1000);
        }
        
        // RoarVictory - violent camera shake
        if (animName === 'Qishilong_skill02') {
          setTimeout(() => {
            this.effectManager.createCameraShake(3.0, 1.0);
          }, effectDelay * 1000);
        }
      }
      
      const onFinished = (e) => {
        if (e.action === action) {
          this.mixer.removeEventListener('finished', onFinished);
          currentIndex++;
          playNext();
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    };
    
    playNext();
  }

  createUI(camera) {
    // Create 2D health bar at top of screen (DOM-based)
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.width = '85%'; // A bit wider
    container.style.zIndex = '1000';
    container.style.pointerEvents = 'none';
    
    // Health bar container
    const barContainer = document.createElement('div');
    barContainer.style.width = '100%';
    barContainer.style.height = '12px';
    barContainer.style.background = 'rgba(0, 0, 0, 0.7)';
    barContainer.style.border = '2px solid #fff';
    barContainer.style.borderRadius = '6px';
    barContainer.style.overflow = 'hidden';
    barContainer.style.position = 'relative';
    
    // Health bar fill
    this.healthBar = document.createElement('div');
    this.healthBar.style.width = '100%';
    this.healthBar.style.height = '100%';
    this.healthBar.style.background = 'linear-gradient(to bottom, #ff4444, #aa0000)';
    this.healthBar.style.transition = 'width 0.3s ease';
    barContainer.appendChild(this.healthBar);
    
    container.appendChild(barContainer);
    document.body.appendChild(container);
    
    this.camera = camera;
    this.healthBarContainer = container;
    
    console.log('✓ Boss health bar created at top of screen');
  }
  
  updateUIPosition() {
    // No need to update position for screen-based UI
  }
  
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    
    if (this.healthBar) {
      const healthPercent = (this.health / this.maxHealth) * 100;
      this.healthBar.style.width = healthPercent + '%';
    }
    
    console.log(`Boss took ${amount} damage. Health: ${this.health}/${this.maxHealth}`);
    
    if (this.health <= 0 && !this.isDead) {
      this.die();
    }
  }
  
  die() {
    if (this.isDead) return;
    
    this.isDead = true;
    this.health = 0;
    console.log('🏆 Boss defeated!');
    
    // Play death animation and stay at death position
    const dieAnim = this.animations['Qishilong_die'];
    if (dieAnim) {
      this.mixer.stopAllAction();
      const dieAction = this.mixer.clipAction(dieAnim);
      dieAction.reset();
      dieAction.setLoop(THREE.LoopOnce);
      dieAction.clampWhenFinished = true; // Stay at final frame
      dieAction.play();
      console.log('Playing boss death animation - will hold final pose');
      
      // Wait for death animation to finish before showing victory
      const onFinished = (e) => {
        if (e.action === dieAction) {
          this.mixer.removeEventListener('finished', onFinished);
          // Check win condition after animation completes
          if (window.turnSystem) {
            setTimeout(() => {
              window.turnSystem.checkGameOver();
            }, 500); // Small delay after animation
          }
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    } else {
      // No death animation, check immediately
      if (window.turnSystem) {
        window.turnSystem.checkGameOver();
      }
    }
    
    // Dim boss health bar
    if (this.healthBar) {
      this.healthBar.parentElement.style.opacity = '0.5';
      this.healthBar.parentElement.style.filter = 'grayscale(100%)';
    }
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
    
    // No need to update UI for screen-based health bar
  }
}
