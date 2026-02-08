import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { Boss } from "./Boss.js";

// Test scene for dragon victory scenarios
export async function run({ scene }) {
  const { sceneObj, camera, renderer, loader, loadingMessage, mainLayer } = scene.prepare3DModel();
  
  console.log("Test Scene: Dragon Victory Scenarios");
  
  // Switch to perspective camera
  const perspectiveCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  perspectiveCamera.position.set(0, 5, 100); // Further back and higher
  
  // Add orbit controls
  const controls = new OrbitControls(perspectiveCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 60, 0); // Look at dragon center
  controls.update();
  
  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  sceneObj.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
  directionalLight.position.set(10, 20, 10);
  sceneObj.add(directionalLight);
  
  sceneObj.background = new THREE.Color(0x1a1a2e);
  
  // Load dragon using reusable Boss class
  const boss = new Boss(sceneObj, null);
  
  await boss.load(
    'scene.gltf',
    './assets/tarisland_dragon/',
    loadingMessage
  );
  
  boss.model.position.set(0, 0, 0);
  boss.model.scale.set(2, 2, 2);
  
  const mixer = boss.mixer;
  const animations = boss.animations;
  
  // Log available animations for debugging
  console.log('Available animations:', Object.keys(animations));
  
  // Play idle animation
  const idleAction = mixer.clipAction(animations['Qishilong_stand']);
  idleAction.play();
  
  // Remove loading message
  if (loadingMessage && loadingMessage.parentNode) {
    loadingMessage.remove();
  }
  
  // Animation loop with perspective camera
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    controls.update();
    
    renderer.render(sceneObj, perspectiveCamera);
  }
  animate();
  
  // Show instructions after model is loaded and visible
  const instructionsBox = document.createElement('div');
  instructionsBox.style.position = 'fixed';
  instructionsBox.style.top = '50%';
  instructionsBox.style.left = '50%';
  instructionsBox.style.transform = 'translate(-50%, -50%)';
  instructionsBox.style.background = 'rgba(0, 0, 0, 0.9)';
  instructionsBox.style.padding = '40px 60px';
  instructionsBox.style.borderRadius = '15px';
  instructionsBox.style.border = '3px solid #ff4444';
  instructionsBox.style.zIndex = '10000';
  instructionsBox.style.textAlign = 'center';
  instructionsBox.style.boxShadow = '0 0 40px rgba(255, 68, 68, 0.6)';
  
  const title = document.createElement('div');
  title.textContent = '🐉 Dragon Victory Test Scene';
  title.style.fontSize = '32px';
  title.style.fontWeight = 'bold';
  title.style.color = '#ff4444';
  title.style.marginBottom = '30px';
  instructionsBox.appendChild(title);
  
  const option1 = document.createElement('div');
  option1.textContent = 'Press 1: Narrative Scenario (with AI dialogue)';
  option1.style.fontSize = '20px';
  option1.style.color = '#fff';
  option1.style.marginBottom = '15px';
  instructionsBox.appendChild(option1);
  
  const option2 = document.createElement('div');
  option2.textContent = 'Press 2: Victory Roar Scenario';
  option2.style.fontSize = '20px';
  option2.style.color = '#fff';
  option2.style.marginBottom = '30px';
  instructionsBox.appendChild(option2);
  
  const hint = document.createElement('div');
  hint.textContent = 'Both scenarios will transition to Scene 03 at the end';
  hint.style.fontSize = '14px';
  hint.style.color = '#aaa';
  instructionsBox.appendChild(hint);
  
  document.body.appendChild(instructionsBox);
  
  // Wait for user choice
  const scenario = await new Promise(resolve => {
    const handleKey = (e) => {
      if (e.key === '1' || e.key === '2') {
        window.removeEventListener('keydown', handleKey);
        instructionsBox.remove();
        resolve(e.key);
      }
    };
    window.addEventListener('keydown', handleKey);
  });
  
  // Helper function to play animation
  const playAnimation = (animNames, loop = false) => {
    return new Promise(resolve => {
      let currentIndex = 0;
      
      const playNext = () => {
        if (currentIndex >= animNames.length) {
          resolve();
          return;
        }
        
        const animName = animNames[currentIndex];
        const clip = animations[animName];
        
        if (!clip) {
          console.warn(`Animation "${animName}" not found`);
          currentIndex++;
          playNext();
          return;
        }
        
        mixer.stopAllAction();
        const action = mixer.clipAction(clip);
        action.reset();
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, 1);
        action.clampWhenFinished = !loop;
        action.play();
        
        if (loop) {
          resolve();
        } else {
          const onFinished = (e) => {
            if (e.action === action) {
              mixer.removeEventListener('finished', onFinished);
              currentIndex++;
              playNext();
            }
          };
          mixer.addEventListener('finished', onFinished);
        }
      };
      
      playNext();
    });
  };
  
  // Scenario 1: Narrative with AI
  async function narrativeScenario(playAnimation) {
    console.log('🐉 Running Narrative Scenario...');
    
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
    
    // Start walk animation (don't await, let it play in background)
    playAnimation(['Qishilong_walk']).then(() => {
      // After walk finishes, start idle loop
      const idleAction = mixer.clipAction(animations['Qishilong_stand']);
      idleAction.reset();
      idleAction.setLoop(THREE.LoopRepeat);
      idleAction.play();
      console.log('Started idle loop animation');
    });
    
    // Create dialogue box immediately while dragon is walking (matching scene_01/scene_03 style)
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
    
    // Type out the narrative with voice support
    let dialogueController = null;
    
    dialogueController = renderDialogueWithVoice(
      textBox,
      narrative,
      'boss', // Character speaking is the boss
      30, // typeSpeed
      () => {
        hintBox.textContent = 'Press TAB to continue...';
      },
      true // enableVoice
    );
    
    // Wait for TAB key
    await new Promise(resolve => {
      const handleKey = (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          if (dialogueController && dialogueController.isPlaying()) {
            // Fast-forward dialogue (stop voice and show full text)
            dialogueController.stop();
            hintBox.textContent = 'Press TAB to continue...';
          } else {
            // Continue
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
    
    // Dragon flies away - find fly animation or use walk as fallback
    const flyAnimName = Object.keys(animations).find(name => name.toLowerCase().includes('fly')) || 'Qishilong_walk';
    console.log('Playing fly animation:', flyAnimName);
    
    // Play fly animation once (not looping)
    const flyClip = animations[flyAnimName];
    if (flyClip) {
      mixer.stopAllAction();
      const flyAction = mixer.clipAction(flyClip);
      flyAction.reset();
      flyAction.setLoop(THREE.LoopOnce, 1);
      flyAction.clampWhenFinished = true;
      flyAction.play();
    }
    
    // Wait 5-7 seconds before transitioning
    const waitTime = 5000 + Math.random() * 2000; // Random between 5-7 seconds
    console.log(`Waiting ${(waitTime/1000).toFixed(1)} seconds before transition...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Scenario 2: Victory roar
  async function roarScenario(playAnimation) {
    console.log('🐉 Running Victory Roar Scenario...');
    
    // Play victory roar animation
    await playAnimation(['Qishilong_skill02']);
    
    console.log('Victory roar complete!');
  }
  
  // Execute chosen scenario
  let result = 'WIN'; // Testing WIN condition
  
  if (scenario === '1') {
    await narrativeScenario(playAnimation);
  } else {
    await roarScenario(playAnimation);
  }
  
  // Clean up 3D scene before transitioning
  console.log('Cleaning up 3D scene...');
  
  // Remove dragon model from scene
  if (boss.model) {
    sceneObj.remove(boss.model);
  }
  
  // Clear the 3D scene but keep the canvas for scene_03
  sceneObj.clear();
  
  // Show defeat screen
  const defeatScreen = document.createElement('div');
  defeatScreen.style.position = 'fixed';
  defeatScreen.style.top = '0';
  defeatScreen.style.left = '0';
  defeatScreen.style.width = '100%';
  defeatScreen.style.height = '100%';
  defeatScreen.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(40,0,0,0.9))';
  defeatScreen.style.display = 'flex';
  defeatScreen.style.flexDirection = 'column';
  defeatScreen.style.justifyContent = 'center';
  defeatScreen.style.alignItems = 'center';
  defeatScreen.style.zIndex = '10000';
  defeatScreen.style.opacity = '0';
  defeatScreen.style.transition = 'opacity 1.5s';
  
  const defeatTitle = document.createElement('div');
  defeatTitle.textContent = result === 'LOSE' ? '☠️ DEFEAT ☠️' : '🏆 VICTORY 🏆';
  defeatTitle.style.fontSize = '72px';
  defeatTitle.style.fontWeight = 'bold';
  defeatTitle.style.color = result === 'LOSE' ? '#ff0000' : '#ffd700';
  defeatTitle.style.textShadow = '0 0 20px currentColor';
  defeatTitle.style.marginBottom = '30px';
  defeatScreen.appendChild(defeatTitle);
  
  const defeatText = document.createElement('div');
  defeatText.textContent = result === 'LOSE' 
    ? 'The dragon\'s power proved insurmountable...' 
    : 'The heroes have triumphed over the dragon!';
  defeatText.style.fontSize = '24px';
  defeatText.style.color = '#fff';
  defeatText.style.marginBottom = '40px';
  defeatScreen.appendChild(defeatText);
  
  const defeatHint = document.createElement('div');
  defeatHint.textContent = 'Press TAB to continue...';
  defeatHint.style.fontSize = '18px';
  defeatHint.style.color = '#aaa';
  defeatHint.style.animation = 'pulse 2s infinite';
  defeatScreen.appendChild(defeatHint);
  
  // Add pulse animation CSS
  if (!document.getElementById('pulse-style')) {
    const style = document.createElement('style');
    style.id = 'pulse-style';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(defeatScreen);
  
  // Fade in defeat screen
  setTimeout(() => defeatScreen.style.opacity = '1', 100);
  
  // Wait for TAB key
  await new Promise(resolve => {
    const handleKey = (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        window.removeEventListener('keydown', handleKey);
        defeatScreen.style.opacity = '0';
        setTimeout(() => {
          defeatScreen.remove();
          resolve();
        }, 1000);
      }
    };
    window.addEventListener('keydown', handleKey);
  });
  
  // Transition to scene_03 with battle result
  console.log('Transitioning to Scene 03...');
  await import('./scene_03.js').then(module => module.run({ scene, result }));
}
