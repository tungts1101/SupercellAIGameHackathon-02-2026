import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/FBXLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { EffectManager } from "./EffectManager.js";
import { Boss } from "./Boss.js";
import { FaceTracker, headPoseToCamera, getWebcamStream } from '../headTracking.js';

// Character class for managing hero characters (Swordman, Archer, Magician)
class Character {
  constructor(sceneObj, name, controlType = 'AI') {
    this.sceneObj = sceneObj;
    this.name = name;
    this.controlType = controlType; // 'AI' or 'USER'
    this.model = null;
    this.mixer = null;
    this.animations = {};
    this.currentAction = null;
    this.actionMap = {}; // Maps action names to animation names
    
    // Combat stats
    this.maxHealth = 50;
    this.health = 50;
    this.maxStamina = 50;
    this.stamina = 50;
    this.isInDecisionWindow = false;
    this.decisionTimeLeft = 0;
    this.decisionCallback = null;
    this.isDead = false;
    
    // UI elements
    this.healthBar = null;
    this.staminaBar = null;
    this.decisionBar = null;
    this.uiContainer = null;
  }

  async load(idleModelPath, animationModelPath = null) {
    const fbxLoader = new FBXLoader();
    
    console.log(`Loading ${this.name} model...`);
    const model = await new Promise((resolve, reject) => {
      fbxLoader.load(
        idleModelPath,
        resolve,
        (progress) => {
          console.log("Prepare for battle ...");
        },
        reject
      );
    });
    
    this.model = model;
    this.sceneObj.add(this.model);
    
    // Setup materials
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      }
    });
    
    // Create animation mixer
    this.mixer = new THREE.AnimationMixer(this.model);
    
    // Load animations from the model
    if (this.model.animations && this.model.animations.length > 0) {
      console.log(`${this.name}: Found ${this.model.animations.length} animations in main model`);
      this.model.animations.forEach((clip, index) => {
        this.animations[`anim_${index}`] = clip;
        console.log(`  - Animation ${index}: ${clip.name} (${clip.duration}s)`);
      });
    }
    
    // Load additional animation if provided
    if (animationModelPath) {
      await this.loadAdditionalAnimation(animationModelPath);
    }
    
    console.log(`✓ ${this.name} loaded successfully (${this.controlType} controlled)`);
    return this.model;
  }

  async loadAdditionalAnimation(animationModelPath) {
    const fbxLoader = new FBXLoader();
    
    console.log(`Loading additional animation for ${this.name}...`);
    const animModel = await new Promise((resolve, reject) => {
      fbxLoader.load(
        animationModelPath,
        resolve,
        (progress) => {
          console.log("Prepare for battle ...");
        },
        reject
      );
    });
    
    if (animModel.animations && animModel.animations.length > 0) {
      console.log(`${this.name}: Found ${animModel.animations.length} additional animations from ${animationModelPath}`);
      
      // Extract unique key from file path (e.g., 'swordman_slash' from 'swordman_slash.fbx')
      const fileName = animationModelPath.split('/').pop().replace('.fbx', '');
      const animKey = fileName.replace(/^(swordman_|archer_|magician_)/, '');
      
      animModel.animations.forEach((clip, index) => {
        // Use file-based key instead of clip.name to avoid collisions
        const uniqueKey = index === 0 ? animKey : `${animKey}_${index}`;
        this.animations[uniqueKey] = clip;
        console.log(`  - Stored as "${uniqueKey}" (original: ${clip.name}, ${clip.duration}s)`);
      });
    }
  }

  setPosition(x, y, z) {
    if (this.model) {
      this.model.position.set(x, y, z);
    }
  }

  setRotation(x, y, z) {
    if (this.model) {
      this.model.rotation.set(x, y, z);
    }
  }

  setScale(x, y, z) {
    if (this.model) {
      this.model.scale.set(x, y, z);
    }
  }

  playAnimation(animationName, loop = THREE.LoopRepeat) {
    const clip = this.animations[animationName];
    if (!clip) {
      console.warn(`${this.name}: Animation "${animationName}" not found`);
      return;
    }
    
    if (this.currentAction) {
      this.currentAction.stop();
    }
    
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.setLoop(loop);
    this.currentAction.play();
    console.log(`${this.name}: Playing animation "${animationName}"`);
  }

  stopAnimation() {
    if (this.currentAction) {
      this.currentAction.stop();
    }
  }

  onHit() {
    // Play impact animation when character gets hit
    const clip = this.animations['impact'];
    if (clip && this.mixer) {
      console.log(`${this.name}: Playing impact animation`);
      const impactAction = this.mixer.clipAction(clip);
      impactAction.reset();
      impactAction.setLoop(THREE.LoopOnce);
      impactAction.clampWhenFinished = false;
      impactAction.play();
      
      // Return to previous action after impact
      const previousAction = this.currentAction;
      setTimeout(() => {
        if (previousAction && previousAction !== impactAction) {
          previousAction.play();
        }
      }, clip.duration * 1000);
    }
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
    
    // Update decision window timer
    if (this.isInDecisionWindow) {
      this.decisionTimeLeft -= delta;
      
      if (this.decisionTimeLeft <= 0) {
        // Time ran out, fail to defend
        this.isInDecisionWindow = false;
        this.decisionTimeLeft = 0;
        if (this.decisionCallback) {
          this.decisionCallback(false);
          this.decisionCallback = null;
        }
      }
      
      // Update decision bar
      if (this.decisionBar) {
        const progress = Math.max(0, this.decisionTimeLeft / 5.0);
        this.decisionBar.style.width = (progress * 100) + '%';
      }
    }
    
    // Update UI bar positions
    this.updateUIPosition();
  }
  
  createUI(camera, index = 0) {
    // Create 2D UI on left side of screen (DOM-based)
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '20px';
    container.style.bottom = (index * 150 + 20) + 'px'; // Stack vertically with proper spacing
    container.style.width = '180px';
    container.style.zIndex = '1000';
    container.style.pointerEvents = 'none';
    
    // Store the character index for z-index calculations
    this.uiIndex = index;
    container.style.background = 'rgba(0, 0, 0, 0.6)';
    container.style.padding = '8px';
    container.style.borderRadius = '8px';
    container.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    
    // Character name
    const nameLabel = document.createElement('div');
    nameLabel.textContent = this.name;
    nameLabel.style.color = '#fff';
    nameLabel.style.fontSize = '13px';
    nameLabel.style.fontWeight = 'bold';
    nameLabel.style.marginBottom = '5px';
    nameLabel.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    container.appendChild(nameLabel);
    
    // Health bar label
    const healthLabel = document.createElement('div');
    healthLabel.textContent = 'Health';
    healthLabel.style.color = '#aaa';
    healthLabel.style.fontSize = '9px';
    healthLabel.style.marginBottom = '1px';
    container.appendChild(healthLabel);
    
    // Health bar container
    const healthBarContainer = document.createElement('div');
    healthBarContainer.style.width = '100%';
    healthBarContainer.style.height = '12px';
    healthBarContainer.style.background = 'rgba(0, 0, 0, 0.5)';
    healthBarContainer.style.border = '1px solid #555';
    healthBarContainer.style.borderRadius = '4px';
    healthBarContainer.style.overflow = 'hidden';
    healthBarContainer.style.marginBottom = '5px';
    
    this.healthBar = document.createElement('div');
    this.healthBar.style.width = '100%';
    this.healthBar.style.height = '100%';
    this.healthBar.style.background = 'linear-gradient(to bottom, #00ff00, #00aa00)';
    this.healthBar.style.transition = 'width 0.3s ease';
    healthBarContainer.appendChild(this.healthBar);
    container.appendChild(healthBarContainer);
    
    // Stamina bar label
    const staminaLabel = document.createElement('div');
    staminaLabel.textContent = 'Stamina';
    staminaLabel.style.color = '#aaa';
    staminaLabel.style.fontSize = '9px';
    staminaLabel.style.marginBottom = '1px';
    container.appendChild(staminaLabel);
    
    // Stamina bar container
    const staminaBarContainer = document.createElement('div');
    staminaBarContainer.style.width = '100%';
    staminaBarContainer.style.height = '10px';
    staminaBarContainer.style.background = 'rgba(0, 0, 0, 0.5)';
    staminaBarContainer.style.border = '1px solid #555';
    staminaBarContainer.style.borderRadius = '4px';
    staminaBarContainer.style.overflow = 'hidden';
    staminaBarContainer.style.marginBottom = '5px';
    
    this.staminaBar = document.createElement('div');
    this.staminaBar.style.width = '100%';
    this.staminaBar.style.height = '100%';
    this.staminaBar.style.background = 'linear-gradient(to bottom, #00aaff, #0066cc)';
    this.staminaBar.style.transition = 'width 0.3s ease';
    staminaBarContainer.appendChild(this.staminaBar);
    container.appendChild(staminaBarContainer);
    
    // Decision window container (hidden by default)
    this.decisionContainer = document.createElement('div');
    this.decisionContainer.style.display = 'none';
    this.decisionContainer.style.marginTop = '5px';
    
    const decisionLabel = document.createElement('div');
    decisionLabel.textContent = 'DEFEND!';
    decisionLabel.style.color = '#ffff00';
    decisionLabel.style.fontSize = '10px';
    decisionLabel.style.fontWeight = 'bold';
    decisionLabel.style.marginBottom = '1px';
    decisionLabel.style.textAlign = 'center';
    this.decisionContainer.appendChild(decisionLabel);
    
    const decisionBarContainer = document.createElement('div');
    decisionBarContainer.style.width = '100%';
    decisionBarContainer.style.height = '12px';
    decisionBarContainer.style.background = 'rgba(0, 0, 0, 0.5)';
    decisionBarContainer.style.border = '1px solid #ff0';
    decisionBarContainer.style.borderRadius = '4px';
    decisionBarContainer.style.overflow = 'hidden';
    
    this.decisionBar = document.createElement('div');
    this.decisionBar.style.width = '100%';
    this.decisionBar.style.height = '100%';
    this.decisionBar.style.background = 'linear-gradient(to bottom, #ffff00, #ffaa00)';
    decisionBarContainer.appendChild(this.decisionBar);
    this.decisionContainer.appendChild(decisionBarContainer);
    
    container.appendChild(this.decisionContainer);
    
    document.body.appendChild(container);
    
    this.camera = camera;
    this.uiContainer = container;
    this.healthBarWidth = 100; // For percentage calculation
    this.staminaBarWidth = 100;
    
    console.log(`✓ ${this.name} UI created on left side`);
  }
  
  updateUIPosition() {
    // No need to update position for screen-based UI
  }
  
  startDecisionWindow(callback) {
    this.isInDecisionWindow = true;
    this.decisionTimeLeft = 5.0;
    this.decisionCallback = callback;
    
    if (this.decisionContainer) {
      this.decisionContainer.style.display = 'block';
    }
    
    // Raise z-index to prevent overlap during global attacks
    // Use unique z-index for each character based on their UI index
    if (this.uiContainer) {
      this.uiContainer.style.zIndex = (1100 + this.uiIndex).toString();
    }
    
    console.log(`${this.name}: Decision window started (5 seconds)`);
    
    // AI characters decide defense randomly based on game state
    if (this.controlType === 'AI') {
      setTimeout(() => {
        if (this.isInDecisionWindow) {
          const defenseAction = this.name === 'Swordman' ? 'block' : 'dodge';
          const staminaCost = this.name === 'Swordman' ? 15 : 20;
          
          // Check if we have enough stamina
          if (this.stamina < staminaCost) {
            console.log(`🤖 AI ${this.name} has no stamina to defend, taking hit`);
            this.makeDecision(false);
            return;
          }
          
          // Decision logic based on game state
          let shouldDefend = false;
          
          // Factor 1: Low health makes defense more likely (below 30%)
          const healthPercent = (this.health / this.maxHealth) * 100;
          if (healthPercent < 30) {
            shouldDefend = Math.random() < 0.9; // 90% chance to defend
          } else if (healthPercent < 60) {
            shouldDefend = Math.random() < 0.6; // 60% chance to defend
          } else {
            shouldDefend = Math.random() < 0.4; // 40% chance to defend
          }
          
          // Factor 2: High stamina makes defense more likely
          const staminaPercent = (this.stamina / this.maxStamina) * 100;
          if (staminaPercent > 80 && !shouldDefend) {
            shouldDefend = Math.random() < 0.5; // Extra 50% chance if we have lots of stamina
          }
          
          if (shouldDefend) {
            console.log(`🤖 AI ${this.name} defending with ${defenseAction}`);
            this.performAction(defenseAction, THREE.LoopOnce);
            this.makeDecision(defenseAction);
          } else {
            console.log(`🤖 AI ${this.name} taking the hit (saving stamina)`);
            this.makeDecision(false);
          }
        }
      }, 2000);
    }
  }
  
  makeDecision(action) {
    if (!this.isInDecisionWindow) return false;
    
    this.isInDecisionWindow = false;
    this.decisionTimeLeft = 0;
    
    if (this.decisionContainer) {
      this.decisionContainer.style.display = 'none';
    }
    
    // Reset z-index after decision
    if (this.uiContainer) {
      this.uiContainer.style.zIndex = (1000 + this.uiIndex).toString();
    }
    
    if (this.decisionCallback) {
      this.decisionCallback(action);
      this.decisionCallback = null;
    }
    
    return true;
  }
  
  forceEndDecisionWindow() {
    // Force close decision window without triggering callback
    this.isInDecisionWindow = false;
    this.decisionTimeLeft = 0;
    this.decisionCallback = null;
    
    if (this.decisionContainer) {
      this.decisionContainer.style.display = 'none';
    }
    
    // Reset z-index
    if (this.uiContainer) {
      this.uiContainer.style.zIndex = (1000 + this.uiIndex).toString();
    }
  }
  
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    
    if (this.healthBar) {
      const healthPercent = (this.health / this.maxHealth) * 100;
      this.healthBar.style.width = healthPercent + '%';
      
      // Change color based on health
      if (healthPercent > 50) {
        this.healthBar.style.background = 'linear-gradient(to bottom, #00ff00, #00aa00)';
      } else if (healthPercent > 25) {
        this.healthBar.style.background = 'linear-gradient(to bottom, #ffaa00, #ff6600)';
      } else {
        this.healthBar.style.background = 'linear-gradient(to bottom, #ff0000, #aa0000)';
      }
    }
    
    console.log(`${this.name} took ${amount} damage. Health: ${this.health}/${this.maxHealth}`);
    
    if (this.health <= 0) {
      this.die();
    }
  }
  
  useStamina(amount) {
    this.stamina = Math.max(0, this.stamina - amount);
    
    if (this.staminaBar) {
      const staminaPercent = (this.stamina / this.maxStamina) * 100;
      this.staminaBar.style.width = staminaPercent + '%';
    }
  }
  
  restoreStamina(amount) {
    this.stamina = Math.min(this.maxStamina, this.stamina + amount);
    
    if (this.staminaBar) {
      const staminaPercent = (this.stamina / this.maxStamina) * 100;
      this.staminaBar.style.width = staminaPercent + '%';
    }
  }
  
  die() {
    if (this.isDead) return; // Already dead
    
    this.isDead = true;
    this.health = 0;
    console.log(`💀 ${this.name} has been defeated!`);
    
    // Play death animation
    this.performAction('die');
    
    // Dim the UI panel to show death
    if (this.uiContainer) {
      this.uiContainer.style.opacity = '0.5';
      this.uiContainer.style.filter = 'grayscale(100%)';
    }
    
    // Check win/lose conditions
    if (window.turnSystem) {
      window.turnSystem.checkGameOver();
    }
  }
}

// Ollama AI decision-making function
async function askOllamaForDecision(gameState, allowedActions) {
  try {
    const prompt = `You are an AI agent controlling a character in a turn-based RPG combat game.

Current Game State:
- Dragon Boss: ${gameState.dragon.health}/${gameState.dragon.maxHealth} HP
- Characters:
${gameState.characters.map(c => `  * ${c.name}: ${c.health}/${c.maxHealth} HP, ${c.stamina}/${c.maxStamina} Stamina, Status: ${c.isDead ? 'DEAD' : 'ALIVE'}`).join('\n')}

You are: ${gameState.yourCharacter.name}
Your Stats: ${gameState.yourCharacter.health}/${gameState.yourCharacter.maxHealth} HP, ${gameState.yourCharacter.stamina}/${gameState.yourCharacter.maxStamina} Stamina

Allowed Actions: ${allowedActions.join(', ')}
${gameState.context ? '\nContext: ' + gameState.context : ''}

Respond with ONLY ONE ACTION from the allowed list. No explanation, just the action name.`;

    const response = await fetch('https://excitingly-unsolitary-jayson.ngrok-free.dev/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma:7b',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false,
        options: {
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      console.error('Ollama API error:', response.status);
      return null;
    }

    const data = await response.json();
    let decision = data.message.content.trim().toLowerCase();
    
    // Extract just the action word if there's extra text
    // Try to find one of the allowed actions in the response
    let foundAction = null;
    for (const action of allowedActions) {
      if (decision.includes(action)) {
        foundAction = action;
        break;
      }
    }
    
    if (foundAction) {
      console.log(`🤖 Ollama decided: ${foundAction}`);
      return foundAction;
    }
    
    // Validate decision is in allowed actions
    if (allowedActions.includes(decision)) {
      console.log(`🤖 Ollama decided: ${decision}`);
      return decision;
    } else {
      console.warn(`⚠️ Ollama returned invalid action "${decision}", expected one of: ${allowedActions.join(', ')}`);
      return null;
    }
  } catch (error) {
    console.error('Error calling Ollama:', error);
    return null;
  }
}

// CombatSystem class for managing combat logic
// Turn-based combat system
class TurnSystem {
  constructor(boss, characters) {
    this.boss = boss;
    this.characters = characters; // Already sorted by position (left to right)
    this.currentTurnIndex = -1; // -1 = boss turn, 0+ = character index
    this.isProcessingTurn = false;
    this.turnOrder = ['boss', ...characters]; // boss first, then characters left to right
    this.turnTimeLeft = 10;
    this.turnTimerInterval = null;
    this.gameEnded = false; // Flag to prevent multiple game over calls
    this.createTurnIndicator();
  }
  
  createTurnIndicator() {
    // Create turn indicator UI at top of character section
    const indicator = document.createElement('div');
    indicator.id = 'turnIndicator';
    indicator.style.position = 'fixed';
    indicator.style.left = '20px';
    indicator.style.bottom = '450px'; // Moved higher to avoid overlap
    indicator.style.width = '180px';
    indicator.style.background = 'rgba(255, 200, 0, 0.9)';
    indicator.style.padding = '10px';
    indicator.style.borderRadius = '8px';
    indicator.style.border = '3px solid rgba(255, 255, 0, 0.8)';
    indicator.style.zIndex = '1001';
    indicator.style.textAlign = 'center';
    indicator.style.display = 'none';
    indicator.style.boxShadow = '0 0 20px rgba(255, 200, 0, 0.6)';
    
    const turnName = document.createElement('div');
    turnName.id = 'turnName';
    turnName.style.color = '#000';
    turnName.style.fontSize = '14px';
    turnName.style.fontWeight = 'bold';
    turnName.style.marginBottom = '8px';
    indicator.appendChild(turnName);
    
    const timerBar = document.createElement('div');
    timerBar.style.width = '100%';
    timerBar.style.height = '20px';
    timerBar.style.background = 'rgba(0, 0, 0, 0.3)';
    timerBar.style.borderRadius = '4px';
    timerBar.style.overflow = 'hidden';
    timerBar.style.marginBottom = '5px';
    
    const timerFill = document.createElement('div');
    timerFill.id = 'turnTimerFill';
    timerFill.style.width = '100%';
    timerFill.style.height = '100%';
    timerFill.style.background = 'linear-gradient(to bottom, #00ff00, #00aa00)';
    timerFill.style.transition = 'width 0.1s linear';
    timerBar.appendChild(timerFill);
    indicator.appendChild(timerBar);
    
    const timerText = document.createElement('div');
    timerText.id = 'turnTimerText';
    timerText.style.color = '#000';
    timerText.style.fontSize = '12px';
    timerText.style.fontWeight = 'bold';
    indicator.appendChild(timerText);
    
    document.body.appendChild(indicator);
    this.turnIndicator = indicator;
  }
  
  updateTurnIndicator(name, controlType) {
    const turnName = document.getElementById('turnName');
    const indicator = this.turnIndicator;
    
    if (name === 'BOSS') {
      turnName.textContent = '🐉 BOSS TURN';
      indicator.style.background = 'rgba(255, 50, 50, 0.9)';
      indicator.style.border = '3px solid rgba(255, 0, 0, 0.8)';
      indicator.style.boxShadow = '0 0 20px rgba(255, 50, 50, 0.6)';
    } else {
      turnName.textContent = `⚔️ ${name.toUpperCase()}'s TURN`;
      if (controlType === 'USER') {
        indicator.style.background = 'rgba(0, 200, 255, 0.9)';
        indicator.style.border = '3px solid rgba(0, 150, 255, 0.8)';
        indicator.style.boxShadow = '0 0 20px rgba(0, 200, 255, 0.6)';
      } else {
        indicator.style.background = 'rgba(150, 150, 150, 0.9)';
        indicator.style.border = '3px solid rgba(100, 100, 100, 0.8)';
        indicator.style.boxShadow = '0 0 20px rgba(150, 150, 150, 0.6)';
      }
    }
    
    indicator.style.display = 'block';
    this.startTurnTimer();
  }
  
  hideTurnIndicator() {
    this.turnIndicator.style.display = 'none';
    this.stopTurnTimer();
  }
  
  startTurnTimer() {
    this.turnTimeLeft = 10;
    this.stopTurnTimer();
    
    const timerText = document.getElementById('turnTimerText');
    const timerFill = document.getElementById('turnTimerFill');
    
    timerText.textContent = `${this.turnTimeLeft}s`;
    timerFill.style.width = '100%';
    
    this.turnTimerInterval = setInterval(() => {
      this.turnTimeLeft--;
      timerText.textContent = `${this.turnTimeLeft}s`;
      
      const percentage = (this.turnTimeLeft / 10) * 100;
      timerFill.style.width = percentage + '%';
      
      // Change color based on time left
      if (percentage > 50) {
        timerFill.style.background = 'linear-gradient(to bottom, #00ff00, #00aa00)';
      } else if (percentage > 25) {
        timerFill.style.background = 'linear-gradient(to bottom, #ffaa00, #ff6600)';
      } else {
        timerFill.style.background = 'linear-gradient(to bottom, #ff0000, #aa0000)';
      }
      
      if (this.turnTimeLeft <= 0) {
        this.stopTurnTimer();
        // Auto-end turn if time runs out
        console.log('⏰ Time expired! Turn skipped.');
        if (window.currentPlayerCharacter) {
          window.currentPlayerCharacter = null;
        }
        this.endTurn();
      }
    }, 1000);
  }
  
  stopTurnTimer() {
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;
    }
  }
  
  startNewRound() {
    console.log('\n🔄 ========== NEW ROUND ==========');
    this.currentTurnIndex = -1;
    this.nextTurn();
  }
  
  nextTurn() {
    if (this.isProcessingTurn) return;
    
    // Stop if game is over
    if (this.checkGameOver()) {
      console.log('Game over detected, stopping turn system');
      return;
    }
    
    this.currentTurnIndex++;
    
    // Regenerate stamina for all characters at the start of each character's turn
    if (this.currentTurnIndex > 0) {
      const character = this.characters[this.currentTurnIndex - 1];
      if (character && character.health > 0) {
        character.restoreStamina(5); // Regenerate 5 stamina per turn
        console.log(`⚡ ${character.name} regenerated 5 stamina`);
      }
    }
    
    if (this.currentTurnIndex === 0) {
      // Boss turn
      console.log('\n🐉 BOSS TURN');
      this.isProcessingTurn = true;
      this.updateTurnIndicator('BOSS', 'AI');
      // Boss will auto-attack after a delay
      setTimeout(() => {
        this.bossTurn();
      }, 1000);
    } else if (this.currentTurnIndex <= this.characters.length) {
      // Character turn
      const charIndex = this.currentTurnIndex - 1;
      const character = this.characters[charIndex];
      
      if (character && !character.isDead && character.health > 0) {
        console.log(`\n⚔️ ${character.name.toUpperCase()} TURN (${character.controlType})`);
        this.isProcessingTurn = true;
        this.updateTurnIndicator(character.name, character.controlType);
        
        if (character.controlType === 'AI') {
          // AI takes action automatically
          setTimeout(() => {
            this.aiTakeTurn(character);
          }, 1000);
        } else {
          // Wait for user input
          console.log('⌨️ Waiting for player action...');
          window.currentPlayerCharacter = character;
        }
      } else {
        // Character is dead, skip turn
        console.log(`💀 ${character ? character.name : 'Unknown'} is dead, skipping turn`);
        this.nextTurn();
      }
    } else {
      // Round complete
      console.log('\n✅ Round complete!\n');
      this.startNewRound();
    }
  }
  
  async bossTurn() {
    // Boss uses AI to decide attack with more randomness
    const attacks = ['BreathFireHigh', 'BreathFireLow', 'Roar', 'StompFoot', 'SweptClaw', 'SweptTail'];
    
    // Add more randomness by sometimes choosing purely random
    const useRandomChoice = Math.random() < 0.5; // 50% chance for pure randomness
    
    if (useRandomChoice) {
      const attack = attacks[Math.floor(Math.random() * attacks.length)];
      console.log(`🐉 Boss uses ${attack}! (random choice)`);
      
      // Execute boss animation directly
      if (attack === 'BreathFireHigh') {
        this.boss.playAnimation(['Qishilong_up', 'Qishilong_skill10', 'Qishilong_down']);
      } else if (attack === 'BreathFireLow') {
        this.boss.playAnimation(['Qishilong_skill06']);
      } else if (attack === 'Roar') {
        this.boss.playAnimation(['Qishilong_skill09']);
      } else if (attack === 'StompFoot') {
        this.boss.playAnimation(['Qishilong_attack02']);
      } else if (attack === 'SweptClaw') {
        this.boss.playAnimation(['Qishilong_attack01']);
      } else if (attack === 'SweptTail') {
        this.boss.playAnimation(['Qishilong_skill11']);
      }
      return;
    }
    
    // Build game state for AI
    const gameState = {
      dragon: {
        health: this.boss.health,
        maxHealth: this.boss.maxHealth
      },
      characters: this.characters.map(c => ({
        name: c.name,
        health: c.health,
        maxHealth: c.maxHealth,
        stamina: c.stamina,
        maxStamina: c.maxStamina,
        isDead: c.isDead
      })),
      yourCharacter: {
        name: 'Dragon Boss',
        health: this.boss.health,
        maxHealth: this.boss.maxHealth
      },
      context: `Your turn to attack. Available attacks: ${attacks.join(', ')}. BreathFireHigh, BreathFireLow, Roar, StompFoot are global attacks (hit all). SweptClaw, SweptTail are single-target attacks.`
    };
    
    // Ask Ollama for decision using gemma:7b
    const response = await fetch('https://excitingly-unsolitary-jayson.ngrok-free.dev/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma:7b',
        messages: [
          {
            role: 'user',
            content: `You are a dragon boss in combat. Game state:\n- Your HP: ${gameState.dragon.health}/${gameState.dragon.maxHealth}\n- Enemies: ${gameState.characters.filter(c => !c.isDead).map(c => `${c.name} (${c.health}/${c.maxHealth} HP)`).join(', ')}\n\nAllowed Actions: ${attacks.join(', ')}\n\nRespond with ONLY ONE ATTACK from the allowed list. No explanation.`
          }
        ],
        stream: false,
        options: {
          temperature: 1.0  // Higher temperature for more randomness
        }
      })
    });
    
    let attack;
    if (response.ok) {
      const data = await response.json();
      let decision = data.message.content.trim();
      
      // Try to extract attack from response
      let foundAttack = null;
      for (const attackName of attacks) {
        if (decision.toLowerCase().includes(attackName.toLowerCase())) {
          foundAttack = attackName;
          break;
        }
      }
      
      attack = foundAttack || attacks[Math.floor(Math.random() * attacks.length)];
      console.log(`🐉 Boss AI chose: ${attack}`);
    } else {
      // Fallback to random
      attack = attacks[Math.floor(Math.random() * attacks.length)];
      console.log(`🐉 Boss uses ${attack}! (random fallback)`);
    }
    
    console.log(`🔥 Boss uses ${attack}!`);
    
    // Execute boss animation
    if (attack === 'BreathFireHigh') {
      this.boss.playAnimation(['Qishilong_up', 'Qishilong_skill10', 'Qishilong_down']);
    } else if (attack === 'BreathFireLow') {
      this.boss.playAnimation(['Qishilong_skill06']);
    } else if (attack === 'Roar') {
      this.boss.playAnimation(['Qishilong_skill09']);
    } else if (attack === 'StompFoot') {
      this.boss.playAnimation(['Qishilong_attack02']);
    } else if (attack === 'SweptClaw') {
      this.boss.playAnimation(['Qishilong_attack01']);
    } else if (attack === 'SweptTail') {
      this.boss.playAnimation(['Qishilong_skill11']);
    }
    
    // Turn will end when boss animation triggers combat system
  }
  
  async aiTakeTurn(character) {
    // AI: Use Ollama to decide action - get correct actions for each character
    let actions;
    if (character.name === 'Swordman') {
      actions = ['slash', 'heavyslash'];
    } else if (character.name === 'Archer') {
      actions = ['shootarrow', 'stab'];
    } else if (character.name === 'Magician') {
      actions = ['castspell', 'castheavyspell', 'healstamina'];
    } else {
      actions = ['slash']; // Fallback
    }
    
    // Build game state for AI
    const gameState = {
      dragon: {
        health: this.boss.health,
        maxHealth: this.boss.maxHealth
      },
      characters: this.characters.map(c => ({
        name: c.name,
        health: c.health,
        maxHealth: c.maxHealth,
        stamina: c.stamina,
        maxStamina: c.maxStamina,
        isDead: c.isDead
      })),
      yourCharacter: {
        name: character.name,
        health: character.health,
        maxHealth: character.maxHealth,
        stamina: character.stamina,
        maxStamina: character.maxStamina
      },
      context: `Your turn to attack. Choose your offensive action. Basic attacks cost 5 stamina, heavy/shoot attacks cost 10 stamina.`
    };
    
    // Ask Ollama for decision
    const action = await askOllamaForDecision(gameState, actions);
    
    if (!action) {
      // Invalid response, skip turn
      console.log(`⚠️ AI ${character.name} received invalid decision, turn skipped`);
      this.endTurn();
      return;
    }
    
    // Check stamina for attacks
    let staminaCost;
    if (action.includes('heavy') || action.includes('shoot') || action.includes('castheavy')) {
      staminaCost = 15; // Heavy attacks cost more
    } else if (action.includes('heal')) {
      staminaCost = 15; // Healing costs more
    } else {
      staminaCost = 5; // Basic attacks
    }
    
    if (character.stamina < staminaCost) {
      // Not enough stamina, skip turn
      console.log(`⚠️ AI ${character.name} has insufficient stamina (${character.stamina}/${staminaCost}), turn skipped`);
      this.endTurn();
      return;
    }
    
    console.log(`🤖 AI ${character.name} uses ${action} (costs ${staminaCost} stamina)`);
    
    // Use stamina
    character.useStamina(staminaCost);
    
    // Store damage/heal effect to apply after animation
    const isHeal = action.includes('heal');
    const damage = action.includes('heavy') || action.includes('shoot') || action.includes('castheavy') ? 15 : 10;
    
    // Play action and wait for animation to complete
    character.performAction(action, THREE.LoopOnce, () => {
      // Animation completed, now apply damage or healing
      if (!isHeal) {
        this.boss.takeDamage(damage);
        console.log(`💥 ${damage} damage applied to boss after animation`);
      } else {
        // Healstamina restores 20 stamina to all characters
        this.characters.forEach(c => {
          if (!c.isDead && c.health > 0) {
            c.restoreStamina(20);
            console.log(`💚 ${c.name} restored 20 stamina`);
          }
        });
      }
      
      // End turn
      this.endTurn();
    });
  }
  
  playerAction(character, action) {
    // Check stamina cost
    const staminaCost = action.includes('heavy') || action.includes('shoot') ? 15 : 5;
    
    if (character.stamina < staminaCost) {
      console.log(`⚠️ Not enough stamina! Need ${staminaCost}, have ${character.stamina}`);
      return; // Don't allow action
    }
    
    console.log(`👤 Player ${character.name} uses ${action} (costs ${staminaCost} stamina)`);
    
    // Use stamina
    character.useStamina(staminaCost);
    
    // Store damage to apply after animation
    const damage = action.includes('heavy') || action.includes('shoot') ? 15 : 10;
    
    // Play action and wait for animation to complete
    character.performAction(action, THREE.LoopOnce, () => {
      // Animation completed, now apply damage
      this.boss.takeDamage(damage);
      console.log(`💥 ${damage} damage applied to boss after animation`);
      
      // End turn
      this.endTurn();
    });
  }
  
  endTurn() {
    this.isProcessingTurn = false;
    this.hideTurnIndicator();
    
    // Close all active decision windows
    this.characters.forEach(character => {
      if (character.isInDecisionWindow) {
        character.forceEndDecisionWindow();
      }
    });
    
    window.currentPlayerCharacter = null;
    
    // Don't continue turns if game is over
    if (this.checkGameOver()) {
      console.log('Game over, not starting next turn');
      return;
    }
    
    setTimeout(() => {
      this.nextTurn();
    }, 500);
  }
  
  checkGameOver() {
    // Prevent multiple calls
    if (this.gameEnded) return true;
    
    // Check if all heroes are dead (player loses)
    const allHeroesDead = this.characters.every(c => c.isDead);
    
    if (allHeroesDead) {
      this.gameEnded = true;
      this.gameOver(false); // Player loses
      return true;
    }
    
    // Check if boss is dead (player wins)
    if (this.boss.isDead) {
      this.gameEnded = true;
      this.gameOver(true); // Player wins
      return true;
    }
    
    return false;
  }
  
  async gameOver(playerWon) {
    this.stopTurnTimer();
    this.isProcessingTurn = true; // Stop turn processing
    
    // Hide all UI bars
    if (this.boss.healthBarContainer) {
      this.boss.healthBarContainer.style.display = 'none';
    }
    this.characters.forEach(character => {
      if (character.uiContainer) {
        character.uiContainer.style.display = 'none';
      }
    });
    if (this.turnIndicator) {
      this.turnIndicator.style.display = 'none';
    }
    
    if (playerWon) {
      // Player victory - simple overlay
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.background = 'rgba(0, 0, 0, 0.8)';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.zIndex = '9999';
      
      const message = document.createElement('div');
      message.style.fontSize = '72px';
      message.style.fontWeight = 'bold';
      message.style.marginBottom = '30px';
      message.style.textShadow = '0 0 20px currentColor';
      message.textContent = '🏆 VICTORY! 🏆';
      message.style.color = '#00ff00';
      console.log('\n\n🏆🏆🏆 VICTORY! 🏆🏆🏆');
      console.log('The heroes have defeated the dragon!');
      
      overlay.appendChild(message);
      
      const subtext = document.createElement('div');
      subtext.style.fontSize = '24px';
      subtext.style.color = '#fff';
      subtext.textContent = 'Press TAB to continue...';
      overlay.appendChild(subtext);
      
      document.body.appendChild(overlay);
      
      // Play death animation
      if (!this.boss.isDead) {
        this.boss.playAnimation(['Qishilong_die'], false);
      }
      
      // Wait for TAB to continue to scene_03
      await new Promise(resolve => {
        const handleKey = (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            window.removeEventListener('keydown', handleKey);
            // Remove victory overlay before transitioning
            overlay.remove();
            resolve();
          }
        };
        window.addEventListener('keydown', handleKey);
      });
      
      // Transition to scene_03 with WIN result
      console.log('Transitioning to scene_03 with WIN result...');
      
      // Stop turn system and cleanup
      if (window.turnSystem) {
        window.turnSystem.gameEnded = true;
        window.turnSystem.stopTurnTimer();
        window.turnSystem = null;
      }
      
      // Force restart 2D rendering before transition
      window.sceneAPI.restart2DRendering();
      
      const { run: runScene03 } = await import('./scene_03.js');
      await runScene03({ scene: window.sceneAPI, result: 'WIN' });
    } else {
      // Dragon victory - choose scenario
      console.log('\n\n☠️☠️☠️ DEFEAT ☠️☠️☠️');
      console.log('All heroes have fallen...');
      
      const scenario = Math.random() < 0.5 ? 'narrative' : 'roar';
      
      if (scenario === 'narrative') {
        // Scenario 1: Narrative about weak humans
        await this.dragonNarrativeVictory();
      } else {
        // Scenario 2: Victory roar and end
        this.dragonRoarVictory();
      }
    }
  }
  
  async dragonNarrativeVictory() {
    // Get narrative from llama3.1:8b
    const response = await fetch('https://excitingly-unsolitary-jayson.ngrok-free.dev/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        messages: [
          {
            role: 'system',
            content: 'You are a mighty dragon who has just defeated human warriors. Speak directly to the observer in first person, with arrogance and contempt about how weak the humans were compared to your power. Use "I", "me", "my" and address the listener as "you" who witnessed my victory. Keep it dramatic and brief (2-3 sentences).'
          },
          {
            role: 'user',
            content: 'Speak to me about your victory over the human warriors.'
          }
        ],
        stream: false,
        options: {
          temperature: 0.9
        }
      })
    });
    
    let narrative = 'Did you witness my power? Those pathetic mortals dared to challenge me, and now they are nothing but dust beneath my claws. I am eternal, unstoppable!';
    
    if (response.ok) {
      const data = await response.json();
      narrative = data.message.content.trim();
      console.log('Dragon narrative:', narrative);
    }
    
    // Play walk animation (looping)
    this.boss.playAnimation(['Qishilong_walk'], true);
    
    // Create dialogue box (matching test scene style)
    const dialogueBox = document.createElement('div');
    dialogueBox.style.position = 'absolute';
    dialogueBox.style.left = '0';
    dialogueBox.style.bottom = '0';
    dialogueBox.style.width = '100%';
    dialogueBox.style.height = '230px';
    dialogueBox.style.background = 'rgba(40, 40, 40, 0.85)';
    dialogueBox.style.padding = '40px 60px';
    dialogueBox.style.boxSizing = 'border-box';
    dialogueBox.style.color = 'white';
    dialogueBox.style.fontFamily = 'serif';
    dialogueBox.style.cursor = 'pointer';
    dialogueBox.style.userSelect = 'none';
    dialogueBox.style.zIndex = '10000';
    
    const textBox = document.createElement('div');
    textBox.style.fontSize = '20px';
    textBox.style.lineHeight = '1.5';
    textBox.style.position = 'relative';
    textBox.style.zIndex = '10';
    textBox.style.marginBottom = '20px';
    dialogueBox.appendChild(textBox);
    
    const hintBox = document.createElement('div');
    hintBox.style.fontSize = '16px';
    hintBox.style.color = '#aaa';
    hintBox.style.textAlign = 'right';
    hintBox.textContent = '';
    dialogueBox.appendChild(hintBox);
    
    document.body.appendChild(dialogueBox);
    
    // Type out the narrative
    let narrativeCompleted = false;
    let currentIndex = 0;
    const typeSpeed = 30;
    
    const typeWriter = () => {
      if (currentIndex < narrative.length) {
        textBox.textContent = narrative.substring(0, currentIndex + 1);
        currentIndex++;
        setTimeout(typeWriter, typeSpeed);
      } else {
        narrativeCompleted = true;
        hintBox.textContent = 'Press TAB to continue...';
      }
    };
    typeWriter();
    
    // Wait for TAB key
    await new Promise(resolve => {
      const handleKey = (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          if (!narrativeCompleted) {
            // Fast-forward dialogue
            currentIndex = narrative.length;
            textBox.textContent = narrative;
            narrativeCompleted = true;
            hintBox.textContent = 'Press TAB to continue...';
          } else {
            // Continue to next scene
            window.removeEventListener('keydown', handleKey);
            resolve();
          }
        }
      };
      window.addEventListener('keydown', handleKey);
    });
    
    // Fade out dialogue
    dialogueBox.style.transition = 'opacity 1s';
    dialogueBox.style.opacity = '0';
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    dialogueBox.remove();
    
    // Dragon flies away
    this.boss.playAnimation(['Qishilong_fly'], false);
    
    // Wait 5-7 seconds before transitioning
    const waitTime = 5000 + Math.random() * 2000;
    console.log(`Waiting ${(waitTime/1000).toFixed(1)} seconds before transition...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Transition to scene_03 with LOSE result
    console.log('Transitioning to scene_03 with LOSE result...');
    
    // Stop turn system and cleanup
    if (window.turnSystem) {
      window.turnSystem.gameEnded = true;
      window.turnSystem.stopTurnTimer();
      window.turnSystem = null;
    }
    
    // Force restart 2D rendering before transition
    window.sceneAPI.restart2DRendering();
    
    const { run: runScene03 } = await import('./scene_03.js');
    await runScene03({ scene: window.sceneAPI, result: 'LOSE' });
  }
  
  async dragonRoarVictory() {
    // Play victory roar animation
    this.boss.playAnimation(['Qishilong_skill02'], false);
    
    // Show defeat overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.8)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '9999';
    
    const message = document.createElement('div');
    message.style.fontSize = '72px';
    message.style.fontWeight = 'bold';
    message.style.marginBottom = '30px';
    message.style.textShadow = '0 0 20px currentColor';
    message.textContent = '☠️ DEFEAT ☠️';
    message.style.color = '#ff0000';
    overlay.appendChild(message);
    
    const subtext = document.createElement('div');
    subtext.style.fontSize = '24px';
    subtext.style.color = '#fff';
    subtext.textContent = 'Press TAB to continue...';
    overlay.appendChild(subtext);
    
    document.body.appendChild(overlay);
    
    // Wait 3 seconds then transition to scene_03
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Transition to scene_03 with LOSE result
    console.log('Transitioning to scene_03 with LOSE result...');
    
    // Stop turn system and cleanup
    if (window.turnSystem) {
      window.turnSystem.gameEnded = true;
      window.turnSystem.stopTurnTimer();
      window.turnSystem = null;
    }
    
    // Force restart 2D rendering before transition
    window.sceneAPI.restart2DRendering();
    
    const { run: runScene03 } = await import('./scene_03.js');
    await runScene03({ scene: window.sceneAPI, result: 'LOSE' });
  }
}

class CombatSystem {
  constructor(boss, characters) {
    this.boss = boss;
    this.characters = characters;
    
    // Damage values for boss attacks
    this.attackDamage = {
      'BreathFireHigh': 25,      // Global attack
      'BreathFireLow': 20,       // Global attack
      'Roar': 15,                // Global attack
      'StompFoot': 18,           // Global attack
      'SweptClaw': 30,           // Single target
      'SweptTail': 28            // Single target
    };
    
    // Map animation names to action names
    this.animToAction = {
      'Qishilong_skill10': 'BreathFireHigh',
      'Qishilong_skill06': 'BreathFireLow',
      'Qishilong_skill09': 'Roar',
      'Qishilong_attack02': 'StompFoot',
      'Qishilong_attack01': 'SweptClaw',
      'Qishilong_skill11': 'SweptTail'
    };
    
    this.pendingAttack = null;
  }
  
  handleBossAttack(animationName) {
    const actionName = this.animToAction[animationName];
    if (!actionName) return;
    
    const damage = this.attackDamage[actionName];
    const isGlobal = ['BreathFireHigh', 'BreathFireLow', 'Roar', 'StompFoot'].includes(actionName);
    
    console.log(`
🔥 Boss uses ${actionName}! Damage: ${damage}`);
    
    if (isGlobal) {
      // Global attack - all characters must defend
      console.log('⚠️ GLOBAL ATTACK - All heroes must defend!');
      console.log(`Total characters: ${this.characters.length}`);
      
      this.characters.forEach((character, index) => {
        console.log(`  Character ${index}: ${character.name} (HP: ${character.health}/${character.maxHealth}, Dead: ${character.isDead})`);
        if (!character.isDead && character.health > 0) {
          console.log(`  → Starting defense window for ${character.name}`);
          this.startDefenseWindow(character, actionName, damage);
        } else {
          console.log(`  → ${character.name} is dead, skipping`);
        }
      });
    } else {
      // Single target attack - pick random alive character
      const aliveCharacters = this.characters.filter(c => c.health > 0);
      if (aliveCharacters.length > 0) {
        const target = aliveCharacters[Math.floor(Math.random() * aliveCharacters.length)];
        console.log(`🎯 Target: ${target.name}`);
        this.startDefenseWindow(target, actionName, damage);
      }
    }
  }
  
  startDefenseWindow(character, attackName, damage) {
    character.startDecisionWindow((defendAction) => {
      // Calculate damage based on defense
      let actualDamage = damage;
      let defended = false;
      
      if (defendAction === 'block' && character.name === 'Swordman') {
        // Swordman blocked
        actualDamage = Math.floor(damage * 0.3); // 70% damage reduction
        defended = true;
        character.useStamina(15);
        console.log(`🛡️ ${character.name} blocked! Reduced damage to ${actualDamage}`);
      } else if (defendAction === 'dodge' && character.name === 'Archer') {
        // Archer dodged
        actualDamage = 0; // Complete dodge
        defended = true;
        character.useStamina(20);
        console.log(`💨 ${character.name} dodged! No damage taken`);
      } else {
        console.log(`❌ ${character.name} failed to defend properly!`);
      }
      
      // Ensure decision window is hidden
      if (character.decisionContainer) {
        character.decisionContainer.style.display = 'none';
      }
      
      // Apply damage
      if (actualDamage > 0) {
        character.takeDamage(actualDamage);
        character.onHit();
      }
      
      // Check if all defense windows are resolved, then end boss turn
      setTimeout(() => {
        const anyInDecision = this.characters.some(c => c.isInDecisionWindow);
        if (!anyInDecision && window.turnSystem) {
          window.turnSystem.endTurn();
        }
      }, 100);
    });
  }
}

// Swordman class - inherits from Character
class Swordman extends Character {
  constructor(sceneObj, controlType = 'USER') {
    super(sceneObj, 'Swordman', controlType);
  }

  async load() {
    // Load all swordman animations from swordman_anim folder
    await super.load('./assets/swordman_anim/swordman_idle.fbx');
    await this.loadAdditionalAnimation('./assets/swordman_anim/swordman_slash.fbx');
    await this.loadAdditionalAnimation('./assets/swordman_anim/swordman_heavyslash.fbx');
    await this.loadAdditionalAnimation('./assets/swordman_anim/swordman_block.fbx');
    await this.loadAdditionalAnimation('./assets/swordman_anim/swordman_impact.fbx');
    await this.loadAdditionalAnimation('./assets/swordman_anim/swordman_die_01.fbx');
    await this.loadAdditionalAnimation('./assets/swordman_anim/swordman_die_02.fbx');
    
    console.log(`${this.name} available animations:`, Object.keys(this.animations));
    console.log(`${this.name} loaded successfully with direct action mapping`);
    
    // Automatically play idle animation
    this.playAnimation('anim_0', THREE.LoopRepeat);
    console.log(`${this.name} idle animation started`);
    
    return this.model;
  }

  performAction(actionName, loop = THREE.LoopOnce, onComplete = null) {
    // Don't allow any actions if character is dead (except death animation itself)
    if (this.isDead && actionName !== 'die') {
      console.log(`${this.name}: Cannot perform action - character is dead`);
      if (onComplete) onComplete();
      return;
    }
    
    // Direct mapping: action name is the animation key
    // Special cases:
    if (actionName === 'idle') {
      this.playAnimation('anim_0', THREE.LoopRepeat);
      if (onComplete) onComplete();
    } else if (actionName === 'die') {
      // Death animation - don't return to idle, stay in death pose
      const dieAnim = Math.random() < 0.5 ? 'die_01' : 'die_02';
      const clip = this.animations[dieAnim];
      if (clip) {
        if (this.currentAction) {
          this.currentAction.stop();
        }
        this.currentAction = this.mixer.clipAction(clip);
        this.currentAction.reset();
        this.currentAction.setLoop(THREE.LoopOnce);
        this.currentAction.clampWhenFinished = true; // Hold final pose
        this.currentAction.play();
        console.log(`${this.name}: Playing death animation, will hold final pose`);
      }
      // No callback, no return to idle - stay dead
    } else {
      // Direct mapping: slash->slash, heavyslash->heavyslash, block->block
      // Play action once, then return to idle
      const clip = this.animations[actionName];
      if (!clip) {
        console.warn(`${this.name}: Animation "${actionName}" not found`);
        if (onComplete) onComplete();
        return;
      }
      
      if (this.currentAction) {
        this.currentAction.stop();
      }
      
      this.currentAction = this.mixer.clipAction(clip);
      this.currentAction.reset();
      this.currentAction.setLoop(THREE.LoopOnce);
      this.currentAction.clampWhenFinished = true;
      this.currentAction.play();
      console.log(`${this.name}: Playing animation "${actionName}"`);
      
      // Trigger visual effects for Swordman attacks (yellow) - near end of animation
      if (actionName === 'slash') {
        setTimeout(() => {
          if (window.effectManager) {
            window.effectManager.createSlashEffect(45, 'medium', 'rgba(255, 220, 0, 0.8)');
          }
        }, 800);
      } else if (actionName === 'heavyslash') {
        setTimeout(() => {
          if (window.effectManager) {
            window.effectManager.createSlashEffect(-45, 'long', 'rgba(255, 200, 0, 0.9)');
          }
        }, 1000);
      }
      
      // Return to idle when action finishes
      const onFinished = (e) => {
        if (e.action === this.currentAction) {
          this.mixer.removeEventListener('finished', onFinished);
          // For block, hold the final pose longer before returning to idle
          const holdDuration = (actionName === 'block') ? 1500 : 0;
          setTimeout(() => {
            console.log(`${this.name}: Action complete, returning to idle`);
            this.playAnimation('anim_0', THREE.LoopRepeat);
            // Call completion callback after returning to idle
            if (onComplete) {
              setTimeout(() => onComplete(), 200); // Small delay after idle
            }
          }, holdDuration);
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    }
  }
}

// Archer class - inherits from Character
class Archer extends Character {
  constructor(sceneObj, controlType = 'AI') {
    super(sceneObj, 'Archer', controlType);
  }

  async load() {
    // Load all archer animations from archer_anim folder
    await super.load('./assets/archer_anim/archer_idle.fbx');
    await this.loadAdditionalAnimation('./assets/archer_anim/archer_shootarrow.fbx');
    await this.loadAdditionalAnimation('./assets/archer_anim/archer_stab.fbx');
    await this.loadAdditionalAnimation('./assets/archer_anim/archer_dodge.fbx');
    await this.loadAdditionalAnimation('./assets/archer_anim/archer_impact.fbx');
    await this.loadAdditionalAnimation('./assets/archer_anim/archer_die_01.fbx');
    await this.loadAdditionalAnimation('./assets/archer_anim/archer_die_02.fbx');
    
    console.log(`${this.name} available animations:`, Object.keys(this.animations));
    console.log(`${this.name} loaded successfully with direct action mapping`);
    
    // Automatically play idle animation
    this.playAnimation('anim_0', THREE.LoopRepeat);
    console.log(`${this.name} idle animation started`);
    
    return this.model;
  }

  performAction(actionName, loop = THREE.LoopOnce, onComplete = null) {
    // Don't allow any actions if character is dead (except death animation itself)
    if (this.isDead && actionName !== 'die') {
      console.log(`${this.name}: Cannot perform action - character is dead`);
      if (onComplete) onComplete();
      return;
    }
    
    // Direct mapping: action name is the animation key
    // Special cases:
    if (actionName === 'idle') {
      this.playAnimation('anim_0', THREE.LoopRepeat);
      if (onComplete) onComplete();
    } else if (actionName === 'die') {
      // Death animation - don't return to idle, stay in death pose
      const dieAnim = Math.random() < 0.5 ? 'die_01' : 'die_02';
      const clip = this.animations[dieAnim];
      if (clip) {
        if (this.currentAction) {
          this.currentAction.stop();
        }
        this.currentAction = this.mixer.clipAction(clip);
        this.currentAction.reset();
        this.currentAction.setLoop(THREE.LoopOnce);
        this.currentAction.clampWhenFinished = true; // Hold final pose
        this.currentAction.play();
        console.log(`${this.name}: Playing death animation, will hold final pose`);
      }
      // No callback, no return to idle - stay dead
    } else {
      // Direct mapping: shootarrow->shootarrow, stab->stab, dodge->dodge
      // Play action once, then return to idle
      const clip = this.animations[actionName];
      if (!clip) {
        console.warn(`${this.name}: Animation "${actionName}" not found`);
        if (onComplete) onComplete();
        return;
      }
      
      if (this.currentAction) {
        this.currentAction.stop();
      }
      
      this.currentAction = this.mixer.clipAction(clip);
      this.currentAction.reset();
      this.currentAction.setLoop(THREE.LoopOnce);
      this.currentAction.clampWhenFinished = true;
      this.currentAction.play();
      console.log(`${this.name}: Playing animation "${actionName}"`);
      
      // Trigger visual effects for Archer attacks (green) - near end of animation
      if (actionName === 'shootarrow') {
        setTimeout(() => {
          if (window.effectManager) {
            window.effectManager.createGreenExplosion();
          }
        }, 3500);
      } else if (actionName === 'stab') {
        setTimeout(() => {
          if (window.effectManager) {
            window.effectManager.createSlashEffect(90, 'short', 'rgba(50, 255, 50, 0.8)');
          }
        }, 800);
      }
      
      // Return to idle when action finishes
      const onFinished = (e) => {
        if (e.action === this.currentAction) {
          this.mixer.removeEventListener('finished', onFinished);
          // For dodge, hold the final pose longer before returning to idle
          const holdDuration = (actionName === 'dodge') ? 1500 : 0;
          setTimeout(() => {
            console.log(`${this.name}: Action complete, returning to idle`);
            this.playAnimation('anim_0', THREE.LoopRepeat);
            // Call completion callback after returning to idle
            if (onComplete) {
              setTimeout(() => onComplete(), 200); // Small delay after idle
            }
          }, holdDuration);
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    }
  }
}

// Magician class - inherits from Character
class Magician extends Character {
  constructor(sceneObj, controlType = 'AI') {
    super(sceneObj, 'Magician', controlType);
  }

  async load() {
    // Load all magician animations from magician_anim folder
    await super.load('./assets/magician_anim/magician_idle.fbx');
    await this.loadAdditionalAnimation('./assets/magician_anim/magician_castspell.fbx');
    await this.loadAdditionalAnimation('./assets/magician_anim/magician_castheavyspell.fbx');
    await this.loadAdditionalAnimation('./assets/magician_anim/magician_healstamina.fbx');
    await this.loadAdditionalAnimation('./assets/magician_anim/magician_impact.fbx');
    await this.loadAdditionalAnimation('./assets/magician_anim/magician_die_01.fbx');
    await this.loadAdditionalAnimation('./assets/magician_anim/magician_die_02.fbx');
    
    console.log(`${this.name} available animations:`, Object.keys(this.animations));
    console.log(`${this.name} loaded successfully with direct action mapping`);
    
    // Automatically play idle animation
    this.playAnimation('anim_0', THREE.LoopRepeat);
    console.log(`${this.name} idle animation started`);
    
    return this.model;
  }

  performAction(actionName, loop = THREE.LoopOnce, onComplete = null) {
    // Don't allow any actions if character is dead (except death animation itself)
    if (this.isDead && actionName !== 'die') {
      console.log(`${this.name}: Cannot perform action - character is dead`);
      if (onComplete) onComplete();
      return;
    }
    
    // Direct mapping: action name is the animation key
    // Special cases:
    if (actionName === 'idle') {
      this.playAnimation('anim_0', THREE.LoopRepeat);
      if (onComplete) onComplete();
    } else if (actionName === 'die') {
      // Death animation - don't return to idle, stay in death pose
      const dieAnim = Math.random() < 0.5 ? 'die_01' : 'die_02';
      const clip = this.animations[dieAnim];
      if (clip) {
        if (this.currentAction) {
          this.currentAction.stop();
        }
        this.currentAction = this.mixer.clipAction(clip);
        this.currentAction.reset();
        this.currentAction.setLoop(THREE.LoopOnce);
        this.currentAction.clampWhenFinished = true; // Hold final pose
        this.currentAction.play();
        console.log(`${this.name}: Playing death animation, will hold final pose`);
      }
      // No callback, no return to idle - stay dead
    } else {
      // Direct mapping: castspell->castspell, castheavyspell->castheavyspell, healstamina->healstamina
      // Play action once, then return to idle
      const clip = this.animations[actionName];
      if (!clip) {
        console.warn(`${this.name}: Animation "${actionName}" not found`);
        if (onComplete) onComplete();
        return;
      }
      
      if (this.currentAction) {
        this.currentAction.stop();
      }
      this.currentAction = this.mixer.clipAction(clip);
      this.currentAction.reset();
      this.currentAction.setLoop(loop);
      this.currentAction.clampWhenFinished = false;
      this.currentAction.play();
      console.log(`${this.name}: Playing animation "${actionName}"`);
      
      // Trigger visual effects for Magician attacks (purple) - near end of animation
      if (actionName === 'castspell') {
        setTimeout(() => {
          if (window.effectManager) {
            window.effectManager.createPurpleExplosions();
          }
        }, 900);
      } else if (actionName === 'castheavyspell') {
        setTimeout(() => {
          if (window.effectManager) {
            window.effectManager.createFrostbiteEffect();
          }
        }, 1000);
      } else if (actionName === 'healstamina') {
        setTimeout(() => {
          if (window.effectManager) {
            // Healing effects on all characters
            window.effectManager.createHealingEffectAllCharacters();
          }
        }, 900);
      }
      
      // Return to idle when action finishes
      const onFinished = (e) => {
        if (e.action === this.currentAction) {
          this.mixer.removeEventListener('finished', onFinished);
          // For heal, hold the final pose longer before returning to idle
          const holdDuration = (actionName === 'healstamina') ? 1500 : 0;
          setTimeout(() => {
            console.log(`${this.name}: Action complete, returning to idle`);
            this.playAnimation('anim_0', THREE.LoopRepeat);
            // Call completion callback after returning to idle
            if (onComplete) {
              setTimeout(() => onComplete(), 200); // Small delay after idle
            }
          }, holdDuration);
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    }
  }
}

export async function run({ scene }) {
  // Store scene API globally for scene transitions
  window.sceneAPI = scene;
  
  // Stop scene_01 background music if playing
  if (window.backgroundMusic) {
    window.backgroundMusic.pause();
    window.backgroundMusic.currentTime = 0;
  }
  
  // Start battle background music
  const battleMusic = new Audio('./assets/09+John+Harrison+with+the+Wichita+State+University+Chamber+Players+-+Autumn+Mvt+3+Allegro.mp3');
  battleMusic.volume = 0.2; // Battle music at 20% volume
  battleMusic.loop = true;
  battleMusic.play().catch(err => console.log('Battle music autoplay prevented:', err));
  window.battleMusic = battleMusic;
  
  // Prepare 3D battle scene
  const { sceneObj, camera, renderer, loader, loadingMessage, mainLayer } = scene.prepare3DModel();
  
  // Load campaign data (will be undefined in test mode, that's ok)
  const campaignData = window.campaignData || { boss: { identity: { name: "Avarrax" } } };
  const playerCharacter = window.playerCharacter;
  const aiCharacters = window.aiCharacters;
  
  console.log("Starting 3D battle scene...");

  
  // Switch to perspective camera for 3D viewing
  const perspectiveCamera = new THREE.PerspectiveCamera(
    90, // Wider field of view
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  perspectiveCamera.position.set(0, 5, 300); // Further and lower
  
  // Setup head tracking
  let headTrackingEnabled = false;
  let currentHeadPose = null;
  
  // Create webcam video element (hidden - no window shown to user)
  const video = document.createElement('video');
  video.width = 640;
  video.height = 480;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.style.display = 'none'; // Hidden from view
  document.body.appendChild(video);
  
  // Initialize face tracker
  const faceTracker = new FaceTracker();
  
  try {
    console.log('🎥 Starting webcam initialization...');
    // Use the new getWebcamStream utility for better Windows compatibility
    await getWebcamStream(video, { width: 640, height: 480, facingMode: 'user' });
    console.log('✓ Webcam stream active, video readyState:', video.readyState, 'playing:', !video.paused);
    
    // Wait for video to actually be playing
    if (video.readyState < 2) {
      await new Promise((resolve) => {
        video.addEventListener('loadeddata', resolve, { once: true });
      });
    }
    
    // Initialize the face landmarker
    console.log('🤖 Initializing face landmarker...');
    const initialized = await faceTracker.initialize();
    
    if (initialized) {
      // Enable tracking FIRST
      headTrackingEnabled = true;
      
      // Start tracking with callback - remove the headTrackingEnabled check inside
      await faceTracker.startTracking(video, (headPose) => {
        currentHeadPose = headPose;
        // Log occasionally to verify it's working
        if (Math.random() < 0.005) {
          console.log('📍 Head pose:', headPose);
        }
      });
      console.log('✅ Head tracking initialized and enabled');
      console.log('💡 Move your head to control the camera!');
    }
  } catch (err) {
    console.error('❌ Could not initialize head tracking:', err.message || err);
    // Continue without head tracking - the game should still work
  }
  
  // Add orbit controls for testing (disabled when head tracking is active)
  const controls = new OrbitControls(perspectiveCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 60, 0); // Look slightly higher
  controls.enabled = false; // Disable to allow head tracking control
  controls.update();
  
  // Add lighting for metallic dragon
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  sceneObj.add(ambientLight);
  
  // Main directional light (simulates sun)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  sceneObj.add(directionalLight);
  
  // Rim light from behind (reduced blue)
  const rimLight = new THREE.DirectionalLight(0x4488ff, 0.6);
  rimLight.position.set(-5, 10, -10);
  sceneObj.add(rimLight);
  
  // Warm point light for gold accents
  const pointLight = new THREE.PointLight(0xffaa00, 3, 100);
  pointLight.position.set(0, 10, 15);
  sceneObj.add(pointLight);
  
  // Fill light from below (reduced blue)
  const fillLight = new THREE.DirectionalLight(0x8899ff, 0.3);
  fillLight.position.set(0, -10, 5);
  sceneObj.add(fillLight);
  
  // Add background color
  sceneObj.background = new THREE.Color(0x1a1a2e);
  
  // Create effect manager
  const effectManager = new EffectManager(sceneObj);

  // Create game entities using the new class system
  const boss = new Boss(sceneObj, effectManager);
  const characters = [];
  
  try {
    // Load the dragon boss
    const dragon = await boss.load('scene.gltf', './assets/tarisland_dragon/', loadingMessage);
    dragon.position.set(0, 0, 0); // Ground level
    dragon.scale.set(2, 2, 2);
    
    // Log bounding box to see model size
    const box = new THREE.Box3().setFromObject(dragon);
    const size = box.getSize(new THREE.Vector3());
    console.log("Dragon size:", size);
    console.log("Dragon bounding box:", box);
    
    // Check and log materials and textures
    console.log("\n========== MATERIAL & TEXTURE INFO ==========");
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setPath('./assets/tarisland_dragon/textures/');
    
    let meshCount = 0;
    let texturedCount = 0;
    
    dragon.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        console.log(`\nMesh #${meshCount}: ${child.name}`);
        console.log(`  Material name: "${child.material.name}"`);
        console.log(`  Material properties:`, {
          color: child.material.color,
          metalness: child.material.metalness,
          roughness: child.material.roughness,
          emissive: child.material.emissive,
          emissiveIntensity: child.material.emissiveIntensity
        });
        
        // Check all possible texture maps
        const textureTypes = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'bumpMap'];
        let hasTexture = false;
        
        textureTypes.forEach(texType => {
          if (child.material[texType]) {
            console.log(`  ${texType}:`, child.material[texType]);
            hasTexture = true;
          }
        });
        
        // Manually load diffuse textures based on material name
        console.log(`  Checking material name for texture loading...`);
        if (child.material.name && child.material.name.includes('MI_M_B_44_Qishilong_body02')) {
          let diffuseTexture, normalTexture;
          
          if (child.material.name.includes('_2_Inst')) {
            console.log('  ✓ Loading diffuse texture: MI_M_B_44_Qishilong_body02_2_Inst_diffuse.png');
            diffuseTexture = textureLoader.load('MI_M_B_44_Qishilong_body02_2_Inst_diffuse.png');
            console.log('  ✓ Loading normal texture: MI_M_B_44_Qishilong_body02_2_Inst_normal.png');
            normalTexture = textureLoader.load('MI_M_B_44_Qishilong_body02_2_Inst_normal.png');
            texturedCount++;
          } else if (child.material.name.includes('_Inst')) {
            console.log('  ✓ Loading diffuse texture: MI_M_B_44_Qishilong_body02_Inst_diffuse.png');
            diffuseTexture = textureLoader.load('MI_M_B_44_Qishilong_body02_Inst_diffuse.png');
            console.log('  ✓ Loading normal texture: MI_M_B_44_Qishilong_body02_Inst_normal.png');
            normalTexture = textureLoader.load('MI_M_B_44_Qishilong_body02_Inst_normal.png');
            texturedCount++;
          }
          
          // Set proper color space for diffuse texture
          diffuseTexture.colorSpace = THREE.SRGBColorSpace;
          diffuseTexture.flipY = false;
          child.material.map = diffuseTexture;
          
          // Configure normal map
          normalTexture.colorSpace = THREE.NoColorSpace;
          normalTexture.flipY = false;
          child.material.normalMap = normalTexture;
          child.material.normalScale = new THREE.Vector2(1, 1);
          
          // Ensure proper material settings for PBR rendering
          child.material.metalness = 0.2;
          child.material.roughness = 0.7;
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        } else {
          console.log(`  ✗ Material name doesn't match known textures`);
        }
        
        if (!hasTexture && !child.material.map) {
          console.log(`  ⚠ No texture maps found in material`);
          console.log(`  Material color:`, child.material.color);
        }
        
        // Force material to be visible
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    console.log(`\n========== SUMMARY ==========`);
    console.log(`Total meshes: ${meshCount}`);
    console.log(`Meshes with diffuse textures loaded: ${texturedCount}`);
    console.log("=============================================\n");
    
    // Expose boss animation functions globally
    window.BreathFireHigh = () => boss.playAnimation(['Qishilong_up', 'Qishilong_skill10', 'Qishilong_down']);
    window.BreathFireLow = () => boss.playAnimation(['Qishilong_skill06']);
    window.Roar = () => boss.playAnimation(['Qishilong_skill09']);
    window.SweptClaw = () => boss.playAnimation(['Qishilong_attack01']);
    window.StompFoot = () => boss.playAnimation(['Qishilong_attack02']);
    window.Die = () => boss.playAnimation(['Qishilong_die'], false);
    window.Walk = () => boss.playAnimation(['Qishilong_walk'], false);
    window.Fly = () => boss.playAnimation(['Qishilong_fly2'], false);
    window.RoarVictory = () => boss.playAnimation(['Qishilong_skill02'], false);
    window.SweptTail = () => boss.playAnimation(['Qishilong_skill11']);
    
    console.log('Boss animation system ready.');
    console.log('Available boss animations: BreathFireHigh, BreathFireLow, Roar, SweptClaw, StompFoot, Die, Walk, Fly, RoarVictory, SweptTail');
    console.log('Press Z key to play BreathFireHigh attack.');
    
    // Create and load characters
    // Create characters based on player selection
    const playerCharacter = window.playerCharacter;
    const aiCharacters = window.aiCharacters || [];
    
    console.log('Selected player character:', playerCharacter?.name || 'None');
    console.log('AI characters:', aiCharacters.map(c => c.name));
    
    // Create all three characters, with selected one in middle as USER controlled
    const characterTypes = ['Swordman', 'Archer', 'Magician'];
    const selectedType = playerCharacter?.class || 'swordsman';
    
    // Map character class names
    const classMap = {
      'swordsman': 'Swordman',
      'archer': 'Archer', 
      'magician': 'Magician'
    };
    const selectedClass = classMap[selectedType.toLowerCase()] || 'Swordman';
    
    console.log(`Selected class: ${selectedClass}`);
    
    // Character positions: left (-50), middle (0), right (50)
    const positions = [
      { x: -50, z: 30 },  // Left - closer to dragon
      { x: 0, z: 40 },    // Middle - closer to dragon
      { x: 50, z: 30 }    // Right - closer to dragon
    ];
    
    // Create selected character first at middle position
    let selectedCharacter;
    if (selectedClass === 'Swordman') {
      selectedCharacter = new Swordman(sceneObj, 'USER');
    } else if (selectedClass === 'Archer') {
      selectedCharacter = new Archer(sceneObj, 'USER');
    } else if (selectedClass === 'Magician') {
      selectedCharacter = new Magician(sceneObj, 'USER');
    }
    await selectedCharacter.load();
    selectedCharacter.setPosition(positions[1].x, 0, positions[1].z); // Middle position, ground level
    selectedCharacter.setScale(15, 15, 15);
    selectedCharacter.setRotation(0, Math.PI, 0);
    selectedCharacter.model.visible = false; // Hide for first-person view
    characters.push(selectedCharacter);
    console.log(`Created ${selectedClass} at position ${positions[1].x} as USER (middle) - hidden for first-person view`);
    
    // Create other two characters at side positions
    const otherTypes = characterTypes.filter(type => type !== selectedClass);
    for (let i = 0; i < otherTypes.length; i++) {
      const charType = otherTypes[i];
      const posIndex = i === 0 ? 0 : 2; // First at left (0), second at right (2)
      
      let character;
      if (charType === 'Swordman') {
        character = new Swordman(sceneObj, 'AI');
      } else if (charType === 'Archer') {
        character = new Archer(sceneObj, 'AI');
      } else if (charType === 'Magician') {
        character = new Magician(sceneObj, 'AI');
      }
      
      await character.load();
      character.setPosition(positions[posIndex].x, 0, positions[posIndex].z); // Ground level
      character.setScale(15, 15, 15);
      character.setRotation(0, Math.PI, 0);
      characters.push(character);
      
      console.log(`Created ${charType} at position ${positions[posIndex].x} as AI`);
    }
    
    // Sort characters by position (left to right: -50, 0, 50)
    // Access the 3D model position through the character's mesh
    characters.sort((a, b) => {
      const posA = a.model ? a.model.position.x : (a.position ? a.position.x : 0);
      const posB = b.model ? b.model.position.x : (b.position ? b.position.x : 0);
      return posA - posB; 
    });
    console.log('✓ Characters sorted by position (left to right)');
    
    // Create UI for characters (order by position: left, middle, right)
    characters.forEach((character, index) => {
      character.createUI(perspectiveCamera, index);
    });
    
    // Create boss health bar
    boss.createUI(perspectiveCamera);
    console.log('✓ Health bars created for all entities');
    
    // Initialize combat system
    const combatSystem = new CombatSystem(boss, characters);
    boss.combatSystem = combatSystem;
    window.combatSystem = combatSystem;
    
    // Initialize turn-based system
    const turnSystem = new TurnSystem(boss, characters);
    window.turnSystem = turnSystem;
    
    console.log('✓ Combat system initialized');
    console.log('✓ Turn-based system initialized');
    console.log('\n🎮 Press TAB to start the battle!');
    
    // Expose character references 
    window.boss = boss;
    window.characters = characters;
    
    // Find individual characters by type for backward compatibility
    window.swordman = characters.find(c => c.constructor.name === 'Swordman');
    window.archer = characters.find(c => c.constructor.name === 'Archer');
    window.magician = characters.find(c => c.constructor.name === 'Magician');
    window.effectManager = effectManager;
    
    // Test function for boss health bar
    window.testBossHealthBar = () => {
      boss.takeDamage(50);
      console.log('Boss health bar test: -50 HP');
    };
    
    console.log('✓ All characters loaded');
    console.log('  - Try: testBossHealthBar() to damage the boss');
    console.log(`  - Swordman (${swordman.controlType} controlled)`);
    console.log(`  - Archer (${archer.controlType} controlled)`);
    console.log('\nSwordman Actions:');
    console.log('  - swordman.performAction("slash") - Normal attack');
    console.log('  - swordman.performAction("heavy_slash") - Heavy attack');
    console.log('  - swordman.performAction("block") - Block incoming attack');
    console.log('  - swordman.performAction("die") - Random death animation');
    console.log('  - swordman.onHit() - Play impact when hit (not an action)');
    console.log('\nArcher Actions:');
    console.log('  - archer.performAction("shoot") - Shoot arrow');
    console.log('  - archer.performAction("stab") - Melee stab attack');
    console.log('  - archer.performAction("dodge") - Dodge');
    console.log('  - archer.performAction("die") - Random death animation');
    console.log('  - archer.onHit() - Play impact when hit (not an action)');
    
    // Action testing system
    let selectedEntity = null;
    
    // Map entities to keyboard selection
    const entityMap = {
      'q': swordman,
      'w': archer,
      'e': magician,
      'r': boss
    };
    
    // Map actions for each entity (in order for number keys)
    const actionMaps = {
      'Swordman': ['slash', 'heavyslash', 'block'],
      'Archer': ['shootarrow', 'stab', 'dodge'],
      'Magician': ['castspell', 'castheavyspell', 'healstamina'],
      'Boss': ['BreathFireHigh', 'BreathFireLow', 'Roar', 'SweptClaw', 'StompFoot', 'Walk', 'Fly', 'SweptTail']
    };
    
    console.log('\n========== TURN-BASED COMBAT CONTROLS ==========');
    console.log('GAME START:');
    console.log('  TAB - Start battle / Next turn');
    console.log('\nDURING YOUR TURN:');
    console.log('  1, 2, 3 - Use action 1, 2, or 3');
    console.log('\nDURING BOSS ATTACK:');
    console.log('  3 - Quick defend (block/dodge)');
    console.log('\n🛡️ DEFENSE: During boss attacks, press 3 to block (Swordman) or dodge (Archer)');
    console.log('=============================================\n');
    
    // Keyboard listener for combat actions
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      
      // Start battle with TAB
      if (key === 'tab') {
        if (!window.turnSystem.isProcessingTurn) {
          window.turnSystem.startNewRound();
        }
        return;
      }
      
      // Player action during their turn
      if (window.currentPlayerCharacter && ['1', '2', '3'].includes(key)) {
        const character = window.currentPlayerCharacter;
        
        // Don't allow actions if character is dead
        if (character.isDead || character.health <= 0) {
          return;
        }
        
        // Get actions based on character class
        let actions;
        if (character.name === 'Swordman') {
          actions = ['slash', 'heavyslash', 'block'];
        } else if (character.name === 'Archer') {
          actions = ['shootarrow', 'stab', 'dodge'];
        } else if (character.name === 'Magician') {
          actions = ['castspell', 'castheavyspell', 'healstamina'];
        }
        
        const actionIndex = parseInt(key) - 1;
        
        if (actionIndex < actions.length) {
          const action = actions[actionIndex];
          // Don't allow defensive actions during attack turn
          if (action !== 'block' && action !== 'dodge') {
            window.turnSystem.playerAction(character, action);
          }
        }
        return;
      }
      
      // Check if any character is in decision window - allow quick defense
      if (key === '3') {
        let defendedCount = 0;
        characters.forEach(character => {
          if (character.isInDecisionWindow && !character.isDead && character.health > 0) {
            if (character.name === 'Swordman') {
              character.performAction('block', THREE.LoopOnce);
              character.makeDecision('block');
              defendedCount++;
            } else if (character.name === 'Archer') {
              character.performAction('dodge', THREE.LoopOnce);
              character.makeDecision('dodge');
              defendedCount++;
            }
          }
        });
        
        if (defendedCount > 0) {
          return; // Defense action handled
        }
      }
    });
    
    // Remove loading message
    if (loadingMessage && loadingMessage.parentNode) {
      loadingMessage.remove();
    }
    
    // Animation loop with perspective camera and head tracking
    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      
      const delta = clock.getDelta();
      
      // Update camera position based on head tracking
      if (headTrackingEnabled && currentHeadPose) {
        const newPos = headPoseToCamera(currentHeadPose, 4, 4, 2, 100, 20); // Pass baseY=5
        perspectiveCamera.position.set(newPos.x, newPos.y, newPos.z);
        perspectiveCamera.lookAt(0, 60, 0); // Look higher to see dragon flight
      } else {
        // Only update orbit controls when head tracking is not active
        controls.update();
      }
      
      // Update boss animations
      boss.update(delta);
      
      // Update all character animations
      characters.forEach(char => char.update(delta));
      
      // Update effects
      effectManager.update(delta);
      renderer.render(sceneObj, perspectiveCamera);
    }
    animate();
    
    // Handle window resize
    window.addEventListener('resize', () => {
      perspectiveCamera.aspect = window.innerWidth / window.innerHeight;
      perspectiveCamera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    console.log("\n========== BATTLE SCENE INITIALIZED ==========");
    console.log("Boss loaded at:", dragon.position);
    console.log("Camera position:", perspectiveCamera.position);
    console.log("Characters:", characters.length);
    characters.forEach(char => {
      console.log(`  - ${char.name} (${char.controlType} controlled) at:`, char.model.position);
    });
    console.log("==============================================\n");
    
    // Add explosion effect function
    window.showExplosion = (x, y) => {
      const explosion = document.createElement('div');
      explosion.style.position = 'absolute';
      explosion.style.left = x + 'px';
      explosion.style.top = y + 'px';
      explosion.style.width = '300px';
      explosion.style.height = '300px';
      explosion.style.transform = 'translate(-50%, -50%)';
      explosion.style.borderRadius = '50%';
      explosion.style.background = 'radial-gradient(circle, rgba(255,200,0,1) 0%, rgba(255,100,0,0.8) 30%, rgba(255,50,0,0.4) 60%, rgba(0,0,0,0) 100%)';
      explosion.style.animation = 'explode 1.2s ease-out forwards';
      explosion.style.pointerEvents = 'none';
      explosion.style.zIndex = '1000';
      explosion.style.boxShadow = '0 0 100px rgba(255,100,0,0.8)';
      
      // Add CSS animation if not exists
      if (!document.getElementById('explosion-style')) {
        const style = document.createElement('style');
        style.id = 'explosion-style';
        style.textContent = `
          @keyframes explode {
            0% {
              transform: translate(-50%, -50%) scale(0);
              opacity: 1;
            }
            50% {
              transform: translate(-50%, -50%) scale(1.5);
              opacity: 0.8;
            }
            100% {
              transform: translate(-50%, -50%) scale(3.5);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }
      
      document.body.appendChild(explosion);
      
      // Remove after animation
      setTimeout(() => {
        explosion.remove();
      }, 1200);
    };
    
    // Test explosion on click (for testing purposes)
    renderer.domElement.addEventListener('click', (e) => {
      console.log('Click detected at:', e.clientX, e.clientY);
      window.showExplosion(e.clientX, e.clientY);
    });
    
  } catch (error) {
    console.error("Error loading dragon model:", error);
    if (loadingMessage) {
      loadingMessage.textContent = `Error loading model: ${error.message}`;
    }
  }
}

// Export Boss class for reuse in other scenes
export { Boss };
