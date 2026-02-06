import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

export function createScene() {
  /* =========================
     LAYERS
  ========================= */
  const mainLayer = document.getElementById("layer-main");
  const uiLayer   = document.getElementById("layer-ui");

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
      const height = opt.height ?? 6;
      const width = height * aspectRatio;

      const geo = new THREE.PlaneGeometry(width, height);
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

      // Handle flip if specified
      if (opt.flip) {
        mesh.scale.x = -1;
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

  dialogue.style.position = "absolute";
  dialogue.style.left = "0";
  dialogue.style.bottom = "0";
  dialogue.style.width = "100%";
  dialogue.style.height = "180px";
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

  dialogue.appendChild(textBox);
  dialogue.appendChild(optionsBox);
  uiLayer.appendChild(dialogue);

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

  function say(text) {
    clearInterval(timer);
    thinking = false;
    fullText = text;
    index = 0;
    typing = true;
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

  // Keyboard listener for space (skip/show options) and number keys (option selection)
  window.addEventListener("keydown", (e) => {
    // Space key - skip typing or show options
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (typing) {
        // Skip typing animation
        clearInterval(timer);
        textBox.textContent = fullText;
        typing = false;
      } else if (pendingOptions && !optionsVisible) {
        // Show options after typing is complete - hide dialogue text
        textBox.style.display = "none";
        optionsBox.style.display = "block";
        optionsVisible = true;
      }
      return;
    }

    // Number keys - select option
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

  /* ========================= */

  return {
    showBackground,
    showCharacter,
    hideCharacter,
    hideAllCharacters,
    say,
    showThinking,
    showOptions
  };
}