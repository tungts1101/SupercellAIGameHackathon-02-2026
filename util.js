import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { voiceService, renderDialogueWithVoice, stopAllVoice } from "./voice-service.js";

export async function getCampaignData() {
  if (!window.campaignData) {
    window.campaignData = await fetch("./campaigns/the_weight_of_gold.json").then(r => r.json());
  }
  return window.campaignData;
}

export function createScene() {
  /* =========================
     LAYERS
  ========================= */
  const mainLayer   = document.getElementById("layer-main");
  const effectLayer = document.getElementById("layer-effect");
  const uiLayer     = document.getElementById("layer-ui");

  /* =========================
     THREE.JS (MAIN LAYER)
  ========================= */
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  mainLayer.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const viewSize = 5;
  let aspect = window.innerWidth / window.innerHeight;

  const camera = new THREE.OrthographicCamera(
    -viewSize * aspect,
     viewSize * aspect,
     viewSize,
    -viewSize,
    -10,
     10
  );
  camera.position.z = 10;

  const loader = new THREE.TextureLoader();

  let bgMesh = null;
  const characterMeshes = {};

  function showBackground(url) {
    const tex = loader.load(url);
    const geo = new THREE.PlaneGeometry(
      viewSize * 2 * aspect,
      viewSize * 2
    );
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      depthTest: false,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = 0;

    if (bgMesh) scene.remove(bgMesh);
    bgMesh = mesh;
    scene.add(mesh);
  }

  function showCharacter(id, url, opt = {}) {
    const tex = loader.load(url, (texture) => {
      // Calculate aspect ratio from actual image
      const aspectRatio = texture.image.width / texture.image.height;
      const targetHeight = opt.height ?? 6;
      
      // Calculate width based on aspect ratio to maintain proportions
      const width = targetHeight * aspectRatio;
      
      // Create geometry with calculated dimensions
      const geo = new THREE.PlaneGeometry(width, targetHeight);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        opt.x ?? 0,
        opt.y ?? -0.5,
        opt.z ?? 5
      );

      // Scale to ensure uniform visual size across all characters
      // This normalizes the actual rendered size
      const uniformScale = opt.scale ?? 1.0;
      mesh.scale.set(uniformScale, uniformScale, 1);

      // Handle flip if specified (applies after uniform scaling)
      if (opt.flip) {
        mesh.scale.x *= -1;
      }

      if (characterMeshes[id]) {
        scene.remove(characterMeshes[id]);
      }

      characterMeshes[id] = mesh;
      scene.add(mesh);
    });
  }

  function hideCharacter(id) {
    if (characterMeshes[id]) {
      scene.remove(characterMeshes[id]);
      delete characterMeshes[id];
    }
  }

  function showAllCharacters() {
    Object.values(characterMeshes).forEach(mesh => {
      scene.add(mesh);
    });
  }

  function hideAllCharacters() {
    Object.values(characterMeshes).forEach(mesh => {
      scene.remove(mesh);
    });
  }

  let renderLoopActive = true;
  
  function render() {
    if (!renderLoopActive) return;
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  render();

  window.addEventListener("resize", () => {
    aspect = window.innerWidth / window.innerHeight;
    camera.left = -viewSize * aspect;
    camera.right = viewSize * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  // Handle key release events for speech recognition
  window.addEventListener("keyup", (e) => {
    // Left Shift release - stop speech recognition
    if (e.key === "Shift" && e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT && isRecording) {
      stopSpeechRecognition();
    }
  });
  /* =========================
     UI LAYER — DIALOGUE
  ========================= */
  const dialogue = document.createElement("div");
  const textBox  = document.createElement("div");
  const optionsBox = document.createElement("div");
  const characterSelectBox = document.createElement("div");

  dialogue.style.position = "absolute";
  dialogue.style.left = "0";
  dialogue.style.bottom = "0";
  dialogue.style.width = "100%";
  dialogue.style.height = "230px";
  dialogue.style.background = "rgba(40, 40, 40, 0.85)";
  dialogue.style.padding = "40px 60px";
  dialogue.style.boxSizing = "border-box";
  dialogue.style.color = "white";
  dialogue.style.fontFamily = "serif";
  dialogue.style.cursor = "pointer";
  dialogue.style.userSelect = "none";

  textBox.style.fontSize = "20px";
  textBox.style.lineHeight = "1.5";
  textBox.style.position = "relative";
  textBox.style.zIndex = "10";
  textBox.style.marginBottom = "20px";

  optionsBox.style.display = "none";
  optionsBox.style.fontSize = "18px";
  optionsBox.style.lineHeight = "1.8";
  optionsBox.style.position = "relative";
  optionsBox.style.zIndex = "10";
  optionsBox.style.color = "white";

  characterSelectBox.style.display = "none";
  characterSelectBox.style.position = "absolute";
  characterSelectBox.style.left = "0";
  characterSelectBox.style.bottom = "0";
  characterSelectBox.style.width = "100%";
  characterSelectBox.style.height = "180px";
  characterSelectBox.style.background = "rgba(40, 40, 40, 0.85)";
  characterSelectBox.style.padding = "20px";
  characterSelectBox.style.boxSizing = "border-box";
  characterSelectBox.style.color = "white";
  characterSelectBox.style.fontFamily = "serif";
  characterSelectBox.style.fontSize = "18px";
  characterSelectBox.style.textAlign = "center";
  characterSelectBox.style.zIndex = "10";

  // Conversation input box
  const conversationInputBox = document.createElement("div");
  conversationInputBox.style.position = "absolute";
  conversationInputBox.style.left = "0";
  conversationInputBox.style.bottom = "0";
  conversationInputBox.style.width = "100%";
  conversationInputBox.style.height = "230px";
  conversationInputBox.style.background = "rgba(40, 40, 40, 0.85)";
  conversationInputBox.style.padding = "40px 60px";
  conversationInputBox.style.boxSizing = "border-box";
  conversationInputBox.style.zIndex = "10";
  conversationInputBox.style.display = "none";
  conversationInputBox.style.flexDirection = "column";
  conversationInputBox.style.justifyContent = "center";

  const conversationInput = document.createElement("input");
  conversationInput.type = "text";
  conversationInput.placeholder = "Type your message and press Enter...";
  conversationInput.style.width = "100%";
  conversationInput.style.padding = "15px";
  conversationInput.style.fontSize = "18px";
  conversationInput.style.background = "rgba(0, 0, 0, 0.6)";
  conversationInput.style.border = "2px solid rgba(255, 255, 255, 0.3)";
  conversationInput.style.borderRadius = "5px";
  conversationInput.style.color = "white";
  conversationInput.style.fontFamily = "serif";
  conversationInput.style.outline = "none";

  conversationInputBox.appendChild(conversationInput);

  dialogue.appendChild(textBox);
  dialogue.appendChild(optionsBox);
  uiLayer.appendChild(dialogue);
  uiLayer.appendChild(characterSelectBox);
  uiLayer.appendChild(conversationInputBox);

  /* =========================
     TYPEWRITER LOGIC
  ========================= */
  let typing = false;
  let fullText = "";
  let index = 0;
  let timer = null;
  let pendingOptions = null;
  let optionCallback = null;
  let optionsVisible = false;
  let thinking = false;
  let thinkingDots = 0;
  let waitingForContinue = false;
  let continueCallback = null;
  let currentDialogueController = null;
  let currentCharacterSpeaking = null;
  let instructionsShownOnce = false; // Track if conversation instructions have been shown

  // Speech recognition variables
  let speechRecognition = null;
  let isRecording = false;
  let recordingStartTime = 0;
  let isTypingMode = false; // Track if typing input is active
  const recordingIndicator = document.createElement('div');
  
  // Initialize speech recognition
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';
    console.log('✅ Speech recognition available');
    
    // Test microphone permissions
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        console.log('✅ Microphone permission granted');
      })
      .catch((error) => {
        console.warn('❌ Microphone permission denied:', error);
        console.log('💡 Please allow microphone access for speech recognition to work');
      });
  } else {
    console.warn('❌ Speech recognition not supported in this browser');
    console.log('💡 Try Chrome, Edge, or Safari for speech recognition support');
  }
  
  // Setup recording indicator
  recordingIndicator.style.position = 'absolute';
  recordingIndicator.style.top = '20px';
  recordingIndicator.style.right = '20px';
  recordingIndicator.style.padding = '10px 20px';
  recordingIndicator.style.background = 'rgba(255, 0, 0, 0.8)';
  recordingIndicator.style.color = 'white';
  recordingIndicator.style.borderRadius = '25px';
  recordingIndicator.style.fontFamily = 'serif';
  recordingIndicator.style.fontSize = '16px';
  recordingIndicator.style.fontWeight = 'bold';
  recordingIndicator.style.display = 'none';
  recordingIndicator.style.zIndex = '1000';
  recordingIndicator.innerHTML = '🎤 Recording...';
  uiLayer.appendChild(recordingIndicator);

  /* =========================
     DIALOGUE QUEUE SYSTEM
  ========================= */
  let dialogueQueue = [];
  let isCurrentlySpeaking = false;

  function processDialogueQueue() {
    console.log(`🔍 Checking dialogue queue: ${dialogueQueue.length} items, currently speaking: ${isCurrentlySpeaking}`);
    
    // Double-check to prevent race conditions
    if (isCurrentlySpeaking) {
      console.log('⏳ Someone is currently speaking, queue processing paused');
      return;
    }
    
    if (dialogueQueue.length === 0) {
      console.log('📭 Queue is empty, nothing to process');
      return;
    }

    console.log(`🎭 Processing dialogue queue (${dialogueQueue.length} items)`);
    
    // Set speaking state IMMEDIATELY before doing anything else
    isCurrentlySpeaking = true;
    
    const nextDialogue = dialogueQueue.shift();
    console.log(`🔒 Locked speaking state for "${nextDialogue.character}"`);
    console.log(`▶️ Starting dialogue for "${nextDialogue.character}"`);

    // Execute the dialogue with correct parameter order
    executeSay(
      nextDialogue.text,        // First parameter: text
      () => {                   // Second parameter: onComplete callback
        console.log(`✅ Character "${nextDialogue.character}" finished speaking`);
        
        // Call the original callback first
        if (nextDialogue.onComplete) {
          nextDialogue.onComplete();
        }
        
        // Mark as finished and process next
        isCurrentlySpeaking = false;
        console.log(`🔓 Unlocked speaking state after "${nextDialogue.character}"`);
        
        // Small delay to ensure proper sequencing
        setTimeout(() => {
          console.log(`🔄 Ready for next dialogue in queue`);
          processDialogueQueue();
        }, 300); // Increased delay to prevent race conditions
      }, 
      nextDialogue.character,   // Third parameter: character
      nextDialogue.enableVoice, // Fourth parameter: enableVoice
      nextDialogue.clearPrevious // Fifth parameter: clearPrevious
    );
  }

  function say(text, onComplete, character = 'storyteller', enableVoice = true, clearPrevious = true) {
    console.log(`🎬 DIALOGUE QUEUED: Character "${character}" wants to speak`);
    console.log(`📝 Text preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    
    // Storyteller narratives bypass the queue system (immediate execution)
    if (character === 'storyteller') {
      console.log(`📖 Storyteller narrative - bypassing queue, executing immediately`);
      // Reset speaking state for scene transitions
      isCurrentlySpeaking = false;
      executeSay(text, onComplete, character, enableVoice, clearPrevious);
      return;
    }
    
    // Add conversation dialogues to queue
    dialogueQueue.push({
      text,
      onComplete,
      character,
      enableVoice,
      clearPrevious
    });

    console.log(`📋 Queue length: ${dialogueQueue.length}, Currently speaking: ${isCurrentlySpeaking}`);
    
    // Start processing if not already speaking
    if (!isCurrentlySpeaking) {
      // Use a small delay to batch multiple rapid calls
      setTimeout(() => processDialogueQueue(), 50);
    } else {
      console.log('⏳ Speech in progress, dialogue queued for later processing');
    }
    
    // Force process if queue seems stuck (backup mechanism)
    if (dialogueQueue.length > 0 && !isCurrentlySpeaking) {
      console.log('🔄 Force-processing queue to prevent stalling');
      setTimeout(() => processDialogueQueue(), 200);
    }
  }

  function clearDialogueQueue() {
    console.log(`🧹 Clearing dialogue queue (had ${dialogueQueue.length} items)`);
    dialogueQueue = [];
    isCurrentlySpeaking = false;
  }

  function resetSceneState() {
    console.log('🎬 Resetting scene state for transition');
    clearDialogueQueue();
    conversationCallback = null;
    currentCharacterSpeaking = null;
    typing = false;
    waitingForContinue = false;
    continueCallback = null;
    isCurrentlySpeaking = false; // Reset speaking state
    instructionsShownOnce = false; // Reset instructions flag for new scene
    console.log('✅ Scene state reset complete');
  }

  function executeSay(text, onComplete, character = 'storyteller', enableVoice = true, clearPrevious = true) {
    console.log(`🎬 NARRATIVE START: Character "${character}" is now speaking`);
    console.log(`🔊 Voice enabled: ${enableVoice}`);
    
    clearInterval(timer);
    thinking = false;
    
    // Stop any existing voice immediately
    if (window.voiceService) {
      window.voiceService.stopVoice();
    }
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    fullText = text;
    index = 0;
    typing = true;
    waitingForContinue = false;
    continueCallback = onComplete; // Set callback immediately
    const previousCharacter = currentCharacterSpeaking;
    currentCharacterSpeaking = character;
    
    console.log(`🎭 Character speaking: ${character} (previous: ${previousCharacter})`);
    console.log(`🎪 Conversation state - conversationCallback:`, !!conversationCallback);
    console.log(`🎪 Conversation input visible:`, conversationInputBox && conversationInputBox.style.display !== 'none');
    
    // Handle character highlighting during conversations
    // We're in a conversation if:
    // 1. conversationCallback exists OR
    // 2. Player character name is set (indicating character interaction) OR
    // 3. Current character is not storyteller (character dialogue/interaction)
    const isInConversation = conversationCallback || window.playerCharacterName || 
                           (character && character !== 'storyteller');
    
    console.log(`🎪 Is in conversation:`, isInConversation, 
               `(callback: ${!!conversationCallback}, player: ${!!window.playerCharacterName}, char: ${character})`);
    
    if (isInConversation) {
      console.log(`🎭 Conversation highlighting: ${character} speaking (previous: ${previousCharacter})`);
      console.log(`📋 Dialogue queue length: ${dialogueQueue.length}`);
      console.log(`🎮 Player character: ${window.playerCharacterName}`);
      console.log(`🤖 AI characters:`, window.aiCharacters?.map(c => c.name) || 'Not set');
      
      // Always keep player character highlighted (never dim)
      // Player-selected character ALWAYS uses 'player' mesh regardless of character name
      const playerMeshId = 'player';
      if (characterMeshes[playerMeshId]) {
        const mesh = characterMeshes[playerMeshId];
        if (mesh && mesh.material) {
          mesh.material.transparent = true;
          mesh.material.opacity = 1.0;
          mesh.material.needsUpdate = true;
          const flipSign = Math.sign(mesh.scale.x) || 1;
          mesh.scale.set(1.15 * flipSign, 1.15, 1);
          console.log(`👤 Player (${playerMeshId}) always highlighted`);
        }
      }
      
      // Handle AI character highlighting
      ["ai1", "ai2"].forEach((meshId, index) => {
        if (meshId === playerMeshId) return; // Skip player mesh
        
        const mesh = characterMeshes[meshId];
        if (mesh && mesh.material) {
          // Get AI character name from stored selection order (no hardcoded fallback)
          const aiCharacter = window.aiCharacters && window.aiCharacters[index] ? 
                             window.aiCharacters[index].name.toLowerCase() : 
                             null; // No fallback - should always use dynamic assignment
          
          if (!aiCharacter) {
            console.warn(`⚠️ No AI character found for ${meshId} at index ${index}. Available AI characters:`, window.aiCharacters);
            return;
          }
          
          const speakingCharacter = character.toLowerCase();
          console.log(`🔍 Checking ${meshId}: aiCharacter="${aiCharacter}", speakingCharacter="${speakingCharacter}"`);
          
          if (aiCharacter === speakingCharacter) {
            // This AI is speaking - highlight them
            mesh.material.transparent = true;
            mesh.material.opacity = 1.0;
            mesh.material.needsUpdate = true;
            const flipSign = Math.sign(mesh.scale.x) || 1;
            mesh.scale.set(1.15 * flipSign, 1.15, 1);
            console.log(`✨ AI ${aiCharacter} (${meshId}) highlighted - speaking`);
          }
          // Don't automatically dim other AI characters - they keep their current state
        }
      });
    }
    
    // Only clear text box if explicitly requested or if it's a major scene change
    if (clearPrevious || !previousCharacter || previousCharacter === 'storyteller' || character === 'storyteller') {
      textBox.textContent = "";
    } else {
      // During conversations, append a new line and separator for clarity
      if (textBox.textContent.trim()) {
        textBox.textContent += "\n\n";
      }
    }
    
    textBox.style.display = "block";
    optionsBox.style.display = "none";
    optionsVisible = false;

    // Stop any existing dialogue controller when character changes
    if (currentDialogueController) {
      if (previousCharacter !== character) {
        console.log(`🔄 Character changed: ${previousCharacter} -> ${character}, stopping previous voice`);
        currentDialogueController.stop();
        // Force stop voice to ensure new character voice starts
        voiceService.stop();
      } else {
        console.log(`🔄 Same character continuing: ${character}`);
        // Same character - just clear the controller without stopping voice
        currentDialogueController = null;
      }
    } else {
      console.log(`🎬 Starting dialogue for character: ${character}`);
    }

    // Use voice-enabled dialogue rendering
    currentDialogueController = renderDialogueWithVoice(
      textBox,
      text,
      character,
      30, // typeSpeed
      () => {
        typing = false;
        currentDialogueController = null;
        
        // IMPORTANT: Call the onComplete callback to reset dialogue queue state
        if (onComplete) {
          console.log('🔔 Calling onComplete callback to reset speaking state');
          onComplete();
        }
        
        // During conversations, automatically show input options when text finishes
        if (conversationCallback || (currentCharacterSpeaking && currentCharacterSpeaking !== 'storyteller')) {
          console.log('💬 Conversation text finished, showing input options automatically');
          waitingForContinue = false; // Don't wait for TAB during conversations
          
          // Only show input if we have a callback (waiting for user input)
          // Otherwise just finish rendering (for character-to-character dialogue)
          if (conversationCallback) {
            console.log('👤 Ready for user input - showing conversation interface');
            showConversationInput(conversationCallback);
          } else {
            console.log('🗣️ Character finished speaking - waiting for next character or user input');
          }
        } else {
          waitingForContinue = true; // Normal narrative mode - wait for TAB
        }
      },
      enableVoice,
      clearPrevious // Pass the clear previous flag
    );
  }

  function showThinking() {
    clearInterval(timer);
    thinking = true;
    typing = false;
    thinkingDots = 1;
    textBox.textContent = ".";
    textBox.style.display = "block";
    optionsBox.style.display = "none";
    optionsVisible = false;

    timer = setInterval(() => {
      thinkingDots++;
      if (thinkingDots > 6) {
        thinkingDots = 1;
      }
      textBox.textContent = ".".repeat(thinkingDots);
    }, 300);
  }

  function showOptions(options, callback) {
    pendingOptions = options;
    optionCallback = callback;
    optionsBox.innerHTML = "";
    
    options.forEach((option, i) => {
      const optionDiv = document.createElement("div");
      optionDiv.textContent = `${i + 1}. ${option}`;
      optionDiv.style.marginBottom = "5px";
      optionsBox.appendChild(optionDiv);
    });
    
    // Reset state - wait for user space press
    optionsBox.style.display = "none";
    optionsVisible = false;
  }

  // Keyboard listener for all interactions
  window.addEventListener("keydown", (e) => {
    // PRIORITY 0: Speech Recognition (LEFT SHIFT key) and Typing (RIGHT SHIFT key)
    if (e.key === "Shift" && e.location === 1) { // Left Shift only (location 1)
      e.preventDefault();
      console.log(`🔑 LEFT SHIFT pressed. typingMode: ${isTypingMode}, conversationCallback: ${!!conversationCallback}, isRecording: ${isRecording}`);
      
      // Don't do speech recognition if in typing mode
      if (isTypingMode) {
        console.log('❌ Speech recognition blocked - currently in typing mode');
        return;
      }
      
      // Don't allow interruption while AI character is speaking
      if (isCurrentlySpeaking) {
        console.log('❌ Speech recognition blocked - AI character is currently speaking. Wait for them to finish.');
        return;
      }
      
      // Check if we're in a conversation context (either formal callback or character dialogue)
      const isInConversationContext = conversationCallback || 
                                     (currentCharacterSpeaking && currentCharacterSpeaking !== 'storyteller') ||
                                     (window.playerCharacterName); // After character selection
      
      if (isInConversationContext && !isRecording && speechRecognition) {
        console.log('🎤 Starting speech recognition...');
        
        // If no formal callback, create a temporary one for speech processing
        if (!conversationCallback) {
          console.log('🔧 Creating temporary conversation callback for speech input');
          conversationCallback = (response) => {
            console.log('🗣️ Temporary callback received response:', response);
            
            // Ensure we're not marked as currently speaking before triggering scene handlers
            console.log('🔄 Resetting speech state before triggering scene handler');
            isCurrentlySpeaking = false;
            
            // Find and trigger the active scene's conversation handler
            if (window.activeSceneConversationHandler) {
              console.log('🎭 Triggering scene conversation handler with:', response);
              window.activeSceneConversationHandler(response);
            } else {
              console.log('⚠️ No active scene conversation handler found - showing player response and continuing');
              // Fallback: show the response as player dialogue, then trigger AI responses
              say(response, () => {
                console.log('👤 Player response completed - triggering AI conversation continuation');
                // Try to continue the conversation by calling the scene's conversation system
                if (window.continueConversation) {
                  window.continueConversation(response);
                } else {
                  console.log('🤖 Manually triggering AI responses...');
                  // Generate a simple AI response to continue conversation
                  generateAIResponse(response);
                }
              }, window.playerCharacterName || 'player', true, false);
            }
          };
        }
        
        startSpeechRecognition();
      } else {
        console.log('❌ Speech recognition not started:', {
          inConversation: isInConversationContext,
          notRecording: !isRecording,
          hasSpeechRecognition: !!speechRecognition,
          currentSpeaker: currentCharacterSpeaking
        });
      }
      return;
    }
    
    if (e.key === "Shift" && e.location === 2) { // Right Shift only (location 2)
      e.preventDefault();
      console.log(`🔑 RIGHT SHIFT pressed. conversationCallback: ${!!conversationCallback}`);
      
      // Stop any active speech recognition first
      if (isRecording) {
        console.log('🛑 Stopping speech recognition to switch to typing');
        stopSpeechRecognition();
      }
      
      // Don't allow interruption while AI character is speaking
      if (isCurrentlySpeaking) {
        console.log('❌ Typing input blocked - AI character is currently speaking. Wait for them to finish.');
        return;
      }
      
      // Check if we're in a conversation context
      const isInConversationContext = conversationCallback || 
                                     (currentCharacterSpeaking && currentCharacterSpeaking !== 'storyteller') ||
                                     (window.playerCharacterName);
      
      if (isInConversationContext) {
        console.log('⌨️ Starting typing input...');
        
        // If no formal callback, create a temporary one
        if (!conversationCallback) {
          console.log('🔧 Creating temporary conversation callback for typing input');
          conversationCallback = (response) => {
            console.log('⌨️ Temporary callback received typed response:', response);
          };
        }
        
        showActualConversationInput();
      } else {
        console.log('❌ Typing not available: not in conversation context');
      }
      return;
    }
    
    // PRIORITY 1: Character Selection (takes precedence over everything)
    if (selectingCharacter) {
      if (e.key === "Tab") {
        console.log('🎯 TAB pressed during character selection');
        e.preventDefault();
        // Confirm selection
        selectingCharacter = false;
        characterSelectBox.style.display = "none";
        
        // Clear selection meshes and name labels
        selectionMeshes.forEach(mesh => scene.remove(mesh));
        selectionMeshes.length = 0;
        characterNameLabels.forEach(label => label.remove());
        characterNameLabels.length = 0;

        // Wait for cleanup and rendering to complete before showing dialogue
        setTimeout(() => {
          if (characterSelectCallback) {
            characterSelectCallback(selectedCharIndex, characterChoices[selectedCharIndex]);
          }
          // Show dialogue after callback has started next scene
          setTimeout(() => {
            dialogue.style.display = "block";
          }, 100);
        }, 50);
        return;
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= characterChoices.length) {
        selectedCharIndex = num - 1;
        updateCharacterSelection();
      }
      return; // Don't process other keys during character selection
    }

    // PRIORITY 2: TAB key - skip typing, continue narrative only
    if (e.key === "Tab") {
      console.log('🎯 TAB pressed in main handler', {
        typing, 
        waitingForContinue, 
        continueCallback: !!continueCallback,
        selectingCharacter
      });
      e.preventDefault();
      
      if (typing) {
        // Skip typing animation and show full text
        if (currentDialogueController) {
          currentDialogueController.stop();
        } else {
          clearInterval(timer);
          textBox.textContent = fullText;
        }
        typing = false;
        
        // During conversations, automatically continue and show input options
        if ((conversationCallback || currentCharacterSpeaking && currentCharacterSpeaking !== 'storyteller')) {
          console.log('🚀 Fast-forwarded conversation text, showing input options');
          waitingForContinue = false;
          
          // Stop voice and reset speaking state when fast-forwarding
          if (window.voiceService) {
            window.voiceService.stopVoice();
          }
          isCurrentlySpeaking = false;
          console.log('🔓 Reset speaking state after TAB fast-forward');
          
          // Only show input if we have a callback (waiting for user input)
          if (conversationCallback) {
            showConversationInput(conversationCallback);
          }
          return;
        }
        
        waitingForContinue = true;
        console.log('📝 Skipped typing, ready for continue');
      } else if (waitingForContinue && continueCallback) {
        // Continue to next step (only for non-conversation narrative)
        if (conversationCallback || (currentCharacterSpeaking && currentCharacterSpeaking !== 'storyteller')) {
          console.log('⚠️ TAB pressed during conversation - use LEFT/RIGHT SHIFT instead');
          return; // Don't continue with TAB during conversations
        }
        
        waitingForContinue = false;
        textBox.textContent = "";
        const callback = continueCallback;
        continueCallback = null;
        console.log('➡️ Continuing to next dialogue');
        callback();
      } else if (pendingOptions && !optionsVisible) {
        // Show options after typing is complete - hide dialogue text
        textBox.style.display = "none";
        optionsBox.style.display = "block";
        optionsVisible = true;
      }
      return;
    }

    // PRIORITY 3: Left Shift key - speech recognition during conversation
    if (e.key === "Shift" && e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT && conversationCallback) {
      if (!isRecording && speechRecognition) {
        startSpeechRecognition();
      }
      return;
    }

    // PRIORITY 4: Number keys - select option
    if (!optionsVisible || !pendingOptions) return;
    
    const num = parseInt(e.key);
    if (num >= 1 && num <= pendingOptions.length) {
      const selectedOption = pendingOptions[num - 1];
      
      // Clear options and show textBox again
      textBox.style.display = "block";
      optionsBox.style.display = "none";
      optionsVisible = false;
      pendingOptions = null;
      
      say(`You chose: ${selectedOption}`);
      
      if (optionCallback) {
        optionCallback(num - 1, selectedOption);
      }
    }
  });
  
  // Separate keyup listener for LEFT SHIFT release
  window.addEventListener("keyup", (e) => {
    if (e.key === "Shift" && e.location === 1) { // Left Shift only
      e.preventDefault();
      console.log(`🔑 LEFT SHIFT released. isRecording: ${isRecording}`);
      if (isRecording) {
        console.log('🛑 Stopping speech recognition...');
        stopSpeechRecognition();
      }
    }
  });

  /* =========================
     CHARACTER SELECTION
  ========================= */
  let selectingCharacter = false;
  let selectedCharIndex = 0;
  let characterSelectCallback = null;
  let characterChoices = [];
  const selectionMeshes = [];
  const characterNameLabels = []; // Store name label elements

  function showCharacterSelection(characters, callback) {
    hideAllCharacters();
    dialogue.style.display = "none";
    characterSelectBox.style.display = "block";
    selectingCharacter = true;
    selectedCharIndex = 0;
    characterSelectCallback = callback;
    characterChoices = characters;

    characterSelectBox.innerHTML = `
      <div style="margin-bottom: 20px; font-size: 22px;">Choose your character</div>
      <div style="margin-bottom: 10px;">Press 1, 2, or 3 to select • Press TAB to confirm</div>
    `;

    // Clear previous meshes and labels
    selectionMeshes.forEach(mesh => scene.remove(mesh));
    selectionMeshes.length = 0;
    characterNameLabels.forEach(label => label.remove());
    characterNameLabels.length = 0;

    // Pre-allocate array to maintain order
    selectionMeshes.length = characters.length;
    characterNameLabels.length = characters.length;

    // Show 3 characters with names below each
    characters.forEach((char, i) => {
      const xPos = (i - 1) * 5; // -5, 0, 5 (increased spacing)
      
      loader.load(char.image, (texture) => {
        const aspectRatio = texture.image.width / texture.image.height;
        const height = 5;
        const width = height * aspectRatio;

        const geo = new THREE.PlaneGeometry(width, height);
        const mat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          opacity: i === 0 ? 1.0 : 0.6
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(xPos, -0.5, 5);
        mesh.userData = { index: i, baseScale: 1 };
        
        if (i === 0) {
          mesh.scale.set(1.2, 1.2, 1);
        }

        selectionMeshes[i] = mesh; // Use index assignment instead of push
        scene.add(mesh);
      });
      
      // Create name label below each character
      const nameLabel = document.createElement("div");
      nameLabel.style.position = "absolute";
      nameLabel.style.color = "white";
      nameLabel.style.fontFamily = "serif";
      nameLabel.style.fontSize = "20px";
      nameLabel.style.textAlign = "center";
      nameLabel.style.pointerEvents = "none";
      nameLabel.style.textShadow = "2px 2px 4px rgba(0,0,0,0.8)";
      nameLabel.style.fontWeight = i === 0 ? "bold" : "normal";
      
      // Position based on character index: left (33%), center (50%), right (66%)
      const positions = ["33%", "50%", "66%"];
      nameLabel.style.left = positions[i];
      nameLabel.style.transform = "translateX(-50%)";
      nameLabel.style.bottom = "230px"; // Above dialogue box (230px height)
      nameLabel.textContent = `${i + 1}. ${char.name}`;
      
      uiLayer.appendChild(nameLabel);
      characterNameLabels[i] = nameLabel; // Use index assignment instead of push
    });

    updateCharacterSelection();
  }

  function updateCharacterSelection() {
    // Update visual highlighting
    selectionMeshes.forEach((mesh, i) => {
      const isSelected = i === selectedCharIndex;
      mesh.material.opacity = isSelected ? 1.0 : 0.6;
      const scale = isSelected ? 1.2 : 1.0;
      mesh.scale.set(scale, scale, 1);
    });
    
    // Update name label styling
    characterNameLabels.forEach((label, i) => {
      const isSelected = i === selectedCharIndex;
      label.style.fontWeight = isSelected ? "bold" : "normal";
      label.style.fontSize = isSelected ? "24px" : "20px";
    });
  }

  /* =========================
     CONVERSATION INPUT
  ========================= */
  let conversationCallback = null;

  function showConversationInput(callback) {
    conversationCallback = callback;
    
    // Set conversation highlighting: player highlighted, AI characters dimmed, storyteller normal
    ["ai1", "ai2"].forEach(meshId => {
      const mesh = characterMeshes[meshId];
      if (mesh && mesh.material) {
        mesh.material.opacity = 0.4; // Dimmed for conversation
        const flipSign = Math.sign(mesh.scale.x) || 1;
        mesh.scale.set(1 * flipSign, 1, 1);
      }
    });
    
    // Reset storyteller to normal (not part of conversation)
    const storytellerMesh = characterMeshes["storyteller"];
    if (storytellerMesh && storytellerMesh.material) {
      storytellerMesh.material.opacity = 0.8;
      const flipSign = Math.sign(storytellerMesh.scale.x) || 1;
      storytellerMesh.scale.set(1 * flipSign, 1, 1);
    }
    
    // Ensure player character stays highlighted during conversation
    if (window.playerCharacterName) {
      highlightCharacter(window.playerCharacterName);
      console.log(`💬 Starting conversation - player highlighted, others dimmed`);
    }
  }
  
  function showActualConversationInput() {
    // Show the typing input box
    conversationInputBox.style.display = "flex";
    dialogue.style.display = "none";
    conversationInput.focus();
    console.log('⌨️ Typing input box shown');
  }
  
  function showActualConversationInput() {
    // Ensure speech recognition is completely stopped
    if (isRecording) {
      stopSpeechRecognition();
    }
    
    // Hide recording indicator if it's showing
    recordingIndicator.style.display = 'none';
    
    // Show the typing input box and set typing mode
    conversationInputBox.style.display = "flex";
    dialogue.style.display = "none";
    isTypingMode = true; // Enable typing mode
    conversationInput.focus();
    console.log('⌨️ Typing mode enabled - speech recognition blocked');
  }

  conversationInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && conversationInput.value.trim()) {
      const message = conversationInput.value.trim();
      conversationInput.value = "";
      conversationInputBox.style.display = "none";
      dialogue.style.display = "block";
      isTypingMode = false; // Disable typing mode
      console.log('⌨️ Typing mode disabled');
      
      if (conversationCallback) {
        const callback = conversationCallback;
        conversationCallback = null; // Clear conversation state
        
        // Dim AI characters now that user has completed their input
        ["ai1", "ai2"].forEach(meshId => {
          const mesh = characterMeshes[meshId];
          if (mesh && mesh.material) {
            mesh.material.transparent = true;
            mesh.material.opacity = 0.4;
            mesh.material.needsUpdate = true;
            const flipSign = Math.sign(mesh.scale.x) || 1;
            mesh.scale.set(1 * flipSign, 1, 1);
            console.log(`🔅 Dimmed AI ${meshId} - user completed input`);
          }
        });
        
        // Reset highlights when conversation ends
        resetAllHighlights();
        
        callback(message);
      }
    }
  });

  function highlightCharacter(characterId) {
    console.log(`✨ Highlighting character: ${characterId}`);
    console.log(`📊 Available meshes:`, Object.keys(characterMeshes));
    console.log(`👤 Player character name:`, window.playerCharacterName);
    
    // Handle different character IDs - map character names to mesh IDs
    let meshId = characterId;
    if (characterId === 'storyteller') {
      meshId = 'storyteller';
    } else if (characterId === window.playerCharacterName || characterId === 'ronan') {
      meshId = 'player';
    } else if (window.aiCharacters) {
      // Dynamic mapping based on character selection order
      const ai1Character = window.aiCharacters[0] ? window.aiCharacters[0].name.toLowerCase() : 'elric';
      const ai2Character = window.aiCharacters[1] ? window.aiCharacters[1].name.toLowerCase() : 'seraphine';
      
      if (characterId === ai1Character) {
        meshId = 'ai1';
      } else if (characterId === ai2Character) {
        meshId = 'ai2';
      } else {
        meshId = 'ai1'; // Default fallback
      }
      console.log(`🗺️ Dynamic mapping: ${characterId} -> ${meshId} (ai1=${ai1Character}, ai2=${ai2Character})`);
    } else if (characterId.includes('ai')) {
      meshId = characterId;
    } else {
      console.warn(`⚠️ Unknown character ID: ${characterId}, checking available meshes...`);
      // Try to find a matching mesh
      const availableMeshIds = Object.keys(characterMeshes);
      if (availableMeshIds.includes('ai1')) {
        meshId = 'ai1';
      } else if (availableMeshIds.includes('ai2')) {
        meshId = 'ai2';
      } else {
        meshId = availableMeshIds[0] || 'ai1';
      }
    }
    
    console.log(`🗺️ Mapping ${characterId} -> ${meshId}`);
    
    const mesh = characterMeshes[meshId];
    if (mesh && mesh.material) {
      const oldOpacity = mesh.material.opacity;
      const oldScale = mesh.scale.x;
      const wasTransparent = mesh.material.transparent;
      
      // Enable transparency and set opacity
      mesh.material.transparent = true;
      mesh.material.opacity = 1.0;
      mesh.material.needsUpdate = true; // Force material update
      
      // Set scale
      const flipSign = Math.sign(mesh.scale.x) || 1;
      mesh.scale.set(1.15 * flipSign, 1.15, 1);
    } else {
      console.error(`❌ Character mesh not found: ${meshId}`, {
        meshExists: !!mesh,
        materialExists: mesh && !!mesh.material,
        availableMeshes: Object.keys(characterMeshes)
      });
    }
  }
  
  function resetCharacterHighlight(characterId) {
    console.log(`🛡️ Removing highlight from character: ${characterId}`);
    
    // Never reset player character highlight during conversations
    if (conversationCallback && characterId === window.playerCharacterName) {
      console.log(`👤 Keeping player character ${characterId} highlighted during conversation`);
      return;
    }
    
    // Handle different character IDs
    let meshId = characterId;
    if (characterId === 'storyteller') {
      meshId = 'storyteller';
    } else if (characterId === window.playerCharacterName) {
      meshId = 'player';
    } else {
      // AI characters are usually ai1, ai2
      meshId = characterId === 'elric' || characterId === 'seraphine' ? 'ai1' : 
               characterId === 'ronan' ? 'player' :
               characterId.includes('ai') ? characterId : 'ai1';
    }
    
    const mesh = characterMeshes[meshId];
    if (mesh && mesh.material) {
      mesh.material.transparent = true;
      mesh.material.opacity = 0.8;
      mesh.material.needsUpdate = true;
      const flipSign = Math.sign(mesh.scale.x) || 1;
      mesh.scale.set(1 * flipSign, 1, 1);
      console.log(`✅ Reset highlight for mesh: ${meshId}`);
    }
  }
  
  function dimCharacter(characterId) {
    console.log(`🔅 Dimming character: ${characterId}`);
    
    // Never dim player character during conversations
    if (conversationCallback && characterId === window.playerCharacterName) {
      console.log(`👤 Keeping player character ${characterId} highlighted during conversation`);
      return;
    }
    
    // Handle different character IDs - map character names to mesh IDs
    let meshId = characterId;
    if (characterId === 'storyteller') {
      meshId = 'storyteller';
    } else if (characterId === window.playerCharacterName || characterId === 'ronan') {
      meshId = 'player';
    } else if (window.aiCharacters) {
      // Dynamic mapping based on character selection order (same as highlightCharacter)
      const ai1Character = window.aiCharacters[0] ? window.aiCharacters[0].name.toLowerCase() : 'elric';
      const ai2Character = window.aiCharacters[1] ? window.aiCharacters[1].name.toLowerCase() : 'seraphine';
      
      if (characterId === ai1Character) {
        meshId = 'ai1';
      } else if (characterId === ai2Character) {
        meshId = 'ai2';
      } else {
        meshId = 'ai1'; // Default fallback
      }
    } else if (characterId === 'elric' || characterId === 'seraphine') {
      // Fallback for backwards compatibility
      meshId = characterId === 'elric' ? 'ai1' : 'ai2';
    } else if (characterId.includes('ai')) {
      meshId = characterId;
    } else {
      console.warn(`⚠️ Unknown character ID: ${characterId}, defaulting to ai1`);
      meshId = 'ai1';
    }
    
    console.log(`🗺️ Mapping ${characterId} -> ${meshId}`);
    
    const mesh = characterMeshes[meshId];
    if (mesh && mesh.material) {
      // Enable transparency and set opacity
      mesh.material.transparent = true;
      mesh.material.opacity = 0.4; // Dimmed for conversations
      mesh.material.needsUpdate = true; // Force material update
      
      const flipSign = Math.sign(mesh.scale.x) || 1;
      mesh.scale.set(1 * flipSign, 1, 1);
      mesh.highlighted = false; // Track highlighting state
      console.log(`✅ Dimmed mesh: ${meshId} with opacity ${mesh.material.opacity}`);
    } else {
      console.error(`❌ Cannot dim mesh: ${meshId}`, {
        meshExists: !!mesh,
        materialExists: mesh && !!mesh.material
      });
    }
  }

  function resetHighlight() {
    ["ai1", "ai2", "player", "storyteller"].forEach(id => {
      const mesh = characterMeshes[id];
      if (mesh && mesh.material) {
        // Don't reset player highlight during conversations
        if (conversationCallback && id === 'player') {
          console.log(`👤 Keeping player highlighted during conversation`);
          return;
        }
        
        mesh.material.opacity = 0.8;
        const flipSign = Math.sign(mesh.scale.x) || 1;
        mesh.scale.set(1 * flipSign, 1, 1);
      }
    });
  }
  
  function resetAllHighlights() {
    console.log("🛡️ Resetting all character highlights");
    ["ai1", "ai2", "player", "storyteller"].forEach(id => {
      const mesh = characterMeshes[id];
      if (mesh && mesh.material) {
        mesh.material.transparent = true;
        mesh.material.opacity = 0.8;
        mesh.material.needsUpdate = true;
        const flipSign = Math.sign(mesh.scale.x) || 1;
        mesh.scale.set(1 * flipSign, 1, 1);
      }
    });
  }

  /* =========================
     AI RESPONSE GENERATION
  ========================= */
  function generateAIResponse(userInput) {
    console.log('🤖 Generating AI response for:', userInput);
    
    // Simple AI characters that respond to user input
    const aiCharacters = ['elric', 'seraphine'];
    const responses = [
      "I understand your concern. We should proceed carefully.",
      "That's a valid point. What do you think we should do next?",
      "Agreed. Let's stay vigilant.",
      "I sense something as well. We should be prepared."
    ];
    
    // Pick a random AI character and response
    const character = aiCharacters[Math.floor(Math.random() * aiCharacters.length)];
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    console.log(`🎭 ${character} will respond:`, response);
    
    // Show AI response after a brief delay
    setTimeout(() => {
      say(response, () => {
        console.log('🤖 AI response completed - conversation ready for next input');
        
        // Show conversation input again for continued interaction
        if (window.playerCharacterName) {
          showConversationInstructions();
        }
      }, character, true, false);
    }, 1000);
  }
  
  function showConversationInstructions() {
    // Show instructions only if they haven't been shown before
    if (!instructionsShownOnce) {
      const instructionText = "\n\n💬 Press RIGHT SHIFT to type or hold LEFT SHIFT to speak";
      if (!textBox.textContent.includes(instructionText)) {
        textBox.textContent += instructionText;
      }
      instructionsShownOnce = true;
      console.log('💬 First-time instructions shown');
    } else {
      console.log('💬 Instructions already shown once, skipping');
    }
    console.log('💬 Conversation ready for user input');
  }

  /* =========================
     RESTART 2D RENDERING
  ========================= */
  function restart2DRendering() {
    // Resume the 2D render loop if it was stopped
    if (!renderLoopActive) {
      renderLoopActive = true;
      render();
    }
    
    // Re-show dialogue box (it was hidden by prepare3DModel)
    dialogue.style.display = "block";
  }

  /* =========================
     3D MODEL PREPARATION
  ========================= */
  function prepare3DModel() {
    // Stop the original 2D render loop
    renderLoopActive = false;
    
    // Hide dialogue and UI elements
    dialogue.style.display = "none";
    conversationInputBox.style.display = "none";
    characterSelectBox.style.display = "none";
    
    // Clear all 2D characters
    Object.keys(characterMeshes).forEach(id => {
      hideCharacter(id);
    });
    
    // Remove background
    if (bgMesh) {
      scene.remove(bgMesh);
      bgMesh = null;
    }
    
    // Show loading message
    const loadingMessage = document.createElement("div");
    loadingMessage.style.position = "absolute";
    loadingMessage.style.top = "50%";
    loadingMessage.style.left = "50%";
    loadingMessage.style.transform = "translate(-50%, -50%)";
    loadingMessage.style.color = "white";
    loadingMessage.style.fontSize = "32px";
    loadingMessage.style.fontFamily = "serif";
    loadingMessage.style.textAlign = "center";
    loadingMessage.style.zIndex = "100";
    loadingMessage.style.textShadow = "2px 2px 4px rgba(0,0,0,0.8)";
    loadingMessage.innerHTML = "Loading 3D Battle Scene...<br><span style='font-size: 20px; opacity: 0.7;'>Preparing for confrontation with Avarrax</span>";
    
    uiLayer.appendChild(loadingMessage);
    
    // Provide access to the scene for 3D model loading
    return {
      sceneObj: scene,
      camera,
      renderer,
      loader,
      loadingMessage,
      mainLayer,
      effectLayer,
      uiLayer
    };
  }
  
  function stopAllVoice() {
    console.log("🛑 Stopping all voice synthesis...");
    
    // Stop any ongoing voice synthesis through voice service
    if (window.voiceService) {
      try {
        window.voiceService.stopVoice();
      } catch (e) {
        console.warn("Error stopping voice service:", e);
      }
    }
    
    // Stop speech synthesis directly
    if ('speechSynthesis' in window) {
      try {
        speechSynthesis.cancel();
      } catch (e) {
        console.warn("Error canceling speech synthesis:", e);
      }
    }
    
    // Stop current dialogue controller
    if (currentDialogueController) {
      try {
        currentDialogueController.stop();
      } catch (e) {
        console.warn("Error stopping dialogue controller:", e);
      }
      currentDialogueController = null;
    }
    
    console.log("✅ All voice synthesis stopped");
    
    // Reset speaking state when all voice is stopped
    isCurrentlySpeaking = false;
    console.log('🔓 Reset speaking state after stopping all voice');
  }

  // Function to stop all voice when narrative ends completely
  function endNarrative() {
    // Stop any ongoing voice synthesis
    if (window.voiceService) {
      window.voiceService.stopVoice();
    }
    
    // Stop speech synthesis directly
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    // Reset dialogue state
    typing = false;
    waitingForContinue = false;
    currentDialogueController = null;
    currentCharacterSpeaking = null;
    continueCallback = null;
    conversationCallback = null;
    isCurrentlySpeaking = false; // Reset speaking state
    
    // Reset all character highlights when narrative ends
    resetAllHighlights();
  }
  
  function startFakeNarrative() {
    console.log("🎭 Starting fake narrative for testing...");
    
    showBackground("assets/backgrounds/forest.jpg");
    showCharacter("storyteller", "assets/characters/narrator.png", 0, 0);
    
    say(
      "Welcome, brave adventurer! The mystical forest awaits. What will you do?",
      () => {
        showConversationInput((response) => {
          say(`You said: "${response}". Your adventure continues!`, null, "storyteller", false); // Disable voice
        });
      },
      "storyteller",
      false // Disable voice synthesis for faster testing
    );
  }

  /* =========================
     SPEECH RECOGNITION
  ========================= */
  
  function startSpeechRecognition() {
    if (!speechRecognition || isRecording) return;
    
    try {
      isRecording = true;
      recordingStartTime = Date.now();
      recordingIndicator.style.display = 'block';
      
      let finalTranscript = '';
      let recognitionEnded = false;
      
      speechRecognition.onresult = (event) => {
        if (recognitionEnded) return;
        
        try {
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          // Update recording indicator with current transcript
          const currentTranscript = (finalTranscript + interimTranscript).trim();
          if (currentTranscript) {
            recordingIndicator.innerHTML = `🎤 "${currentTranscript}"`;
          }
        } catch (resultError) {
          console.warn('Speech recognition result error:', resultError);
        }
      };
      
      speechRecognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        recognitionEnded = true;
        setTimeout(() => stopSpeechRecognition(), 100);
      };
      
      speechRecognition.onend = () => {
        recognitionEnded = true;
      };
      
      speechRecognition.start();
      console.log('🎤 Started speech recognition');
      
    } catch (error) {
      console.warn('Failed to start speech recognition:', error);
      isRecording = false;
      recordingIndicator.style.display = 'none';
    }
  }
  
  function stopSpeechRecognition() {
    if (!speechRecognition || !isRecording) return;
    
    try {
      isRecording = false;
      
      // Clear event handlers to prevent further callbacks
      speechRecognition.onresult = null;
      speechRecognition.onerror = null;
      
      speechRecognition.stop();
      
      // Handle the final result with timeout protection
      const handleFinalResult = () => {
        recordingIndicator.style.display = 'none';
        
        try {
          const recognizedText = recordingIndicator.innerHTML.replace('🎤 "', '').replace('"', '').trim();
          if (recognizedText && recognizedText !== 'Recording...' && conversationCallback) {
            console.log('🗣️ Speech recognized:', recognizedText);
            
            // Use the recognized text as player input
            conversationInputBox.style.display = 'none';
            dialogue.style.display = 'block';
            
            const callback = conversationCallback;
            conversationCallback = null;
            
            // Dim AI characters now that user has completed their speech input
            ["ai1", "ai2"].forEach(meshId => {
              const mesh = characterMeshes[meshId];
              if (mesh && mesh.material) {
                mesh.material.transparent = true;
                mesh.material.opacity = 0.4;
                mesh.material.needsUpdate = true;
                const flipSign = Math.sign(mesh.scale.x) || 1;
                mesh.scale.set(1 * flipSign, 1, 1);
                console.log(`🔅 Dimmed AI ${meshId} - user completed speech input`);
              }
            });
            
            callback(recognizedText);
          }
        } catch (finalError) {
          console.warn('Error processing final speech result:', finalError);
        }
      };
      
      speechRecognition.onend = handleFinalResult;
      
      // Fallback timeout in case onend doesn't fire
      setTimeout(handleFinalResult, 500);
      
      console.log('🎤 Stopped speech recognition');
      
    } catch (error) {
      console.warn('Failed to stop speech recognition:', error);
      isRecording = false;
      recordingIndicator.style.display = 'none';
    }
  }

  /* ========================= */

  return {
    showBackground,
    showCharacter,
    hideCharacter,
    hideAllCharacters,
    say,
    showThinking,
    showOptions,
    showCharacterSelection,
    showConversationInput,
    highlightCharacter,
    resetHighlight,
    clearDialogueQueue,
    resetSceneState,
    prepare3DModel,
    restart2DRendering,
    endNarrative,
    startFakeNarrative,
    onCharacterFinishedTalking
  };
  
  // Function called when a character finishes talking
  function onCharacterFinishedTalking(characterName) {
    if (conversationCallback && characterName && characterName !== window.playerCharacterName) {
      console.log(`🎭 ${characterName} finished talking - dimming character`);
      dimCharacter(characterName);
      
      // Ensure player stays highlighted
      if (window.playerCharacterName) {
        highlightCharacter(window.playerCharacterName);
      }
    }
  }
  
  // Quick test function for speech recognition - call this in console
  window.testSpeech = function() {
    console.log("🎤 Quick speech recognition test");
    showConversationInput((response) => {
      console.log(`✅ Speech test result: "${response}"`);
      say(`Speech test successful! You said: "${response}"`, null, "storyteller", false);
    });
  };
  
  // Immediate conversation test - bypasses all narrative
  window.quickConversation = function() {
    console.log("💬 Setting up immediate conversation for speech testing...");
    
    // Clear any existing content
    textBox.textContent = "You are Ronan. Elric and Seraphine stand with you. What do you say?";
    textBox.style.display = "block";
    
    // Immediately show conversation input
    showConversationInput((response) => {
      console.log(`✅ Conversation result: "${response}"`);
      textBox.textContent = `You said: "${response}". The adventure continues...`;
    });
  };
  
  // Test microphone permissions - call this in console
  window.testMicrophone = function() {
    console.log("🎤 Testing microphone access...");
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("❌ getUserMedia not supported");
      return;
    }
    
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        console.log("✅ Microphone access granted!");
        console.log("🎤 You can now use speech recognition");
        
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
        
        // Test speech recognition availability
        if (speechRecognition) {
          console.log("✅ Speech recognition ready");
          console.log("💡 Try calling testSpeech() to test it");
        } else {
          console.warn("❌ Speech recognition not available");
        }
      })
      .catch((error) => {
        console.error("❌ Microphone access denied:", error);
        console.log("💡 Please check browser permissions:");
        console.log("   Chrome/Edge: Click 🔒 icon → Microphone → Allow");
        console.log("   Firefox: Click 🔒 icon → Microphone → Allow");  
        console.log("   Safari: Safari → Settings → Websites → Microphone → Allow");
      });
  };
}