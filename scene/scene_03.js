import { voiceService } from '../voice-service.js';

// Scene 03 - Storyteller ending scene
export async function run({ scene, result = 'LOSE' }) {
  console.log("Scene 03: Epilogue - Result:", result);
  
  // Restart the 2D rendering loop (was stopped by prepare3DModel)
  scene.restart2DRendering();
  
  // Debug: Check if canvas exists
  const mainLayer = document.getElementById("layer-main");
  console.log("Main layer children count:", mainLayer.children.length);
  const canvases = mainLayer.querySelectorAll('canvas');
  console.log("Canvas elements found:", canvases.length);
  canvases.forEach((c, i) => console.log(`Canvas ${i}:`, c.width, 'x', c.height));
  
  scene.showBackground("./assets/scene_01_background_01.png");

  scene.showCharacter(
    "storyteller",
    "./assets/storyteller_front.png",
    {
      x: 0,
      y: -0.5,
      height: 6,
      z: 5
    }
  );

  // Get AI narrative about the battle result
  const outcomeText = result === 'WIN' 
    ? 'The brave warriors have triumphed! Against all odds, they defeated the mighty dragon Avarrax and claimed the treasure of the Black Keep.'
    : 'The dragon Avarrax has defeated the human warriors who sought the treasure of the Black Keep. The beast\'s might proved insurmountable.';
  
  let narrative = outcomeText;
  
  // Show thinking dots while waiting for AI response
  scene.showThinking();
  
  try {
    const response = await fetch('https://excitingly-unsolitary-jayson.ngrok-free.dev/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-r1:8b',
        messages: [
          {
            role: 'system',
            content: `You are a wise storyteller narrating the conclusion of an epic battle. The battle result is: ${result === 'WIN' ? 'The human warriors have defeated the dragon Avarrax and claimed victory' : 'The dragon Avarrax has defeated the human warriors'}. Provide a brief, poetic narration about the outcome of this battle and its meaning. Keep it to 2-3 sentences.`
          },
          {
            role: 'user',
            content: `The battle has ended with ${result === 'WIN' ? 'the warriors victorious over the dragon' : 'the dragon victorious over the warriors'}. Tell me about the result of this match.`
          }
        ],
        stream: false,
        options: {
          temperature: 0.8
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      let rawNarrative = data.message.content.trim();
      
      // Remove <think>...</think> tags from deepseek-r1 responses
      narrative = rawNarrative.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      
      console.log('Storyteller narrative:', narrative);
    }
  } catch (error) {
    console.error('Failed to get AI narrative:', error);
  }

  // Show AI-generated epilogue narrative
  await new Promise(resolve => {
    scene.say(narrative, resolve, 'storyteller');
  });
  
  await new Promise(resolve => {
    scene.say("Perhaps, in time, new heroes will emerge. But for now, the Black Keep stands as a monument to greed and the terrible price of gold.", resolve, 'storyteller');
  });
  
  await new Promise(resolve => {
    scene.say("Thank you for experiencing this journey. May you carry its lessons forward.", resolve, 'storyteller');
  });
  
  console.log("Scene 03 complete. Game ends.");
}
