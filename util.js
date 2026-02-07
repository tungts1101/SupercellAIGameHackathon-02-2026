import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

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

  function render() {
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

  function say(text, onComplete) {
    clearInterval(timer);
    thinking = false;
    fullText = text;
    index = 0;
    typing = true;
    waitingForContinue = false;
    continueCallback = onComplete; // Set callback immediately
    textBox.textContent = "";
    textBox.style.display = "block";
    optionsBox.style.display = "none";
    optionsVisible = false;

    timer = setInterval(() => {
      if (index < fullText.length) {
        textBox.textContent += fullText[index++];
      } else {
        clearInterval(timer);
        typing = false;
        waitingForContinue = true;
      }
    }, 30);
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
    // PRIORITY 1: Character Selection (takes precedence over everything)
    if (selectingCharacter) {
      if (e.key === "Tab") {
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

    // PRIORITY 2: TAB key - skip typing, continue narrative, or show options
    if (e.key === "Tab") {
      e.preventDefault();
      
      if (typing) {
        // First press: Skip typing animation and show full text
        clearInterval(timer);
        textBox.textContent = fullText;
        typing = false;
        waitingForContinue = true;
      } else if (waitingForContinue && continueCallback) {
        // Second press: Continue to next step
        waitingForContinue = false;
        const callback = continueCallback;
        continueCallback = null;
        callback();
      } else if (pendingOptions && !optionsVisible) {
        // Show options after typing is complete - hide dialogue text
        textBox.style.display = "none";
        optionsBox.style.display = "block";
        optionsVisible = true;
      }
      return;
    }

    // PRIORITY 3: Number keys - select option
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
    dialogue.style.display = "none";
    conversationInputBox.style.display = "flex";
    conversationInput.value = "";
    conversationInput.focus();
  }

  conversationInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && conversationInput.value.trim()) {
      const message = conversationInput.value.trim();
      conversationInput.value = "";
      conversationInputBox.style.display = "none";
      dialogue.style.display = "block";
      
      if (conversationCallback) {
        conversationCallback(message);
      }
    }
  });

  function highlightCharacter(id) {
    const mesh = characterMeshes[id];
    if (mesh && mesh.material) {
      mesh.material.opacity = 1.0;
      const flipSign = Math.sign(mesh.scale.x) || 1;
      mesh.scale.set(1.15 * flipSign, 1.15, 1);
    }
  }

  function resetHighlight() {
    ["ai1", "ai2"].forEach(id => {
      const mesh = characterMeshes[id];
      if (mesh && mesh.material) {
        mesh.material.opacity = 0.8;
        const flipSign = Math.sign(mesh.scale.x) || 1;
        mesh.scale.set(1 * flipSign, 1, 1);
      }
    });
  }

  /* =========================
     3D MODEL PREPARATION
  ========================= */
  function prepare3DModel() {
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
      scene,
      camera,
      renderer,
      loader,
      loadingMessage
    };
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
    prepare3DModel
  };
}