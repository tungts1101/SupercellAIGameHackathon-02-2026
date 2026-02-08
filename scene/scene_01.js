import { voiceService } from '../voice-service.js';
import { OLLAMA_BASE_URL } from '../config.js';

export async function run({ scene }) {
  // ACT 1: Opening Narrative
  await act1_OpeningNarrative(scene);
  
  // ACT 2: Character Selection (continues automatically after Act 1)
  const { character, aiCharacters } = await act2_CharacterSelection(scene);
  
  // ACT 3: Conversation and exploration
  await act3_Conversation(scene, character, aiCharacters, window.campaignData);
}

async function act1_OpeningNarrative(scene) {
  scene.showBackground("./assets/scene_01_background_01.png");
  
  // Start background music after first user interaction (TAB press will trigger it)
  if (!window.backgroundMusic) {
    const backgroundMusic = new Audio('./assets/Classicals.de-Vivaldi-The-Four-Seasons-05-John-Harrison-with-the-Wichita-State-University-Chamber-Players-Summer-Mvt-2-Adagio.mp3');
    backgroundMusic.volume = 0.2; // Lower volume to not overlay narrative voice
    backgroundMusic.loop = true;
    window.backgroundMusic = backgroundMusic;
    
    // Try to play immediately, but it might be blocked
    backgroundMusic.play().catch(err => {
      console.log('Background music autoplay prevented, will start on first interaction');
      // Set up one-time event listener to start music on any user interaction
      const startMusic = () => {
        backgroundMusic.play();
        document.removeEventListener('keydown', startMusic);
        document.removeEventListener('click', startMusic);
      };
      document.addEventListener('keydown', startMusic, { once: true });
      document.addEventListener('click', startMusic, { once: true });
    });
  }

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

  // Load campaign data
  const campaignData = await fetch("./campaigns/the_weight_of_gold.json").then(r => r.json());
  
  // Store for later acts
  window.campaignData = campaignData;
  
  // Use fake narrative for fast testing instead of AI call
  scene.showThinking();
  
  let narrative = null;
  
  // FAKE NARRATIVE MODE - skip AI call for fast testing
  const useFakeNarrative = false;
  
  if (!useFakeNarrative) {
    try {
      const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    // Add random variation to the prompt
    const perspectives = [
      "From the perspective of a weary traveler who has witnessed the region's slow decline",
      "As told by the last merchant to escape the Black Keep's economic pull",
      "Through the eyes of a scout who has been tracking the dragon's influence",
      "As experienced by adventurers who have seen too many kingdoms fall"
    ];
    const randomPerspective = perspectives[Math.floor(Math.random() * perspectives.length)];
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-r1:8b",
        messages: [
          {
            role: "system",
            content: "You are a masterful storyteller for a dark fantasy adventure. Create rich, atmospheric narratives that immerse players in the world. Use vivid descriptions and build tension. Each telling should feel unique and fresh."
          },
          {
            role: "user",
            content: `Create an extended opening narrative for this campaign (aim for 5-7 paragraphs):

Title: ${campaignData.campaign.arc.title}
Premise: ${campaignData.campaign.story_overview.premise}
Arc Start: ${campaignData.campaign.story_overview.arc_start}
Tone: ${campaignData.campaign.arc.tone}
Themes: ${campaignData.campaign.arc.themes.join(', ')}

Setting: ${campaignData.setting.primary_location.description}

${randomPerspective}

Paint a vivid picture of the journey to the Black Keep, the oppressive atmosphere, the signs of economic collapse in the region, and the ominous presence of the fortress. Build atmosphere and dread. Be creative with imagery and metaphors.

End the narrative by introducing three companions who have joined you on this quest:
1. ${campaignData.party.swordsman.name} (${campaignData.party.swordsman.class}) - ${campaignData.party.swordsman.role}
2. ${campaignData.party.archer.name} (${campaignData.party.archer.class}) - ${campaignData.party.archer.role}  
3. ${campaignData.party.magician.name} (${campaignData.party.magician.class}) - ${campaignData.party.magician.role}

IMPORTANT: End by telling the player they must choose which companion's perspective they will experience this journey through. Make it dramatic and immersive.`
          }
        ],
        options: {
          temperature: 1.0
        },
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();
    
    console.log("AI Response:", data);
    
    narrative = data.message.content;
    
    // Strip <think> tags if present (deepseek-r1 specific)
    narrative = narrative.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
    console.log("Narrative after processing:", narrative);
    
    } catch (error) {
      console.error("Error generating narrative:", error);
      console.log("Using fallback narrative from campaign data");
    }
  }
  
  // Use fake narrative or fallback narrative if AI fails
  if (useFakeNarrative || !narrative || narrative.length < 100) {
    console.log("Using fake narrative for testing");
    
    // Short fake narrative for fast testing
    narrative = `The Black Keep looms before you, a fortress of greed where the dragon Avarrax hoards endless wealth. Three companions stand ready to face this threat with you.

Choose your perspective: ${campaignData.party.swordsman.name} the warrior, ${campaignData.party.archer.name} the archer, or ${campaignData.party.magician.name} the mage. Who will you be?`;

    console.log("Short fake narrative ready");
  }
  
  // Split narrative into chunks (max 400 characters per dialogue)
  const chunks = splitIntoChunks(narrative, 400);
  
  // Show chunks sequentially like a visual novel
  await showNarrativeChunks(scene, chunks);
}

async function act2_CharacterSelection(scene) {
  const campaignData = window.campaignData;
  
  // Wait for character selection to complete
  const { index, character } = await new Promise(resolve => {
    scene.showCharacterSelection(
      [
        { 
          name: campaignData.party.swordsman.name,
          class: campaignData.party.swordsman.class,
          role: campaignData.party.swordsman.role,
          image: "./assets/swordman_front.png",
          imageRight: "./assets/swordman_right.png",
          imageLeft: "./assets/swordman_right.png", // Will be flipped
          data: campaignData.party.swordsman
        },
        { 
          name: campaignData.party.archer.name,
          class: campaignData.party.archer.class,
          role: campaignData.party.archer.role,
          image: "./assets/archer_front.png",
          imageRight: "./assets/archer_right.png",
          imageLeft: "./assets/archer_right.png", // Will be flipped
          data: campaignData.party.archer
        },
        { 
          name: campaignData.party.magician.name,
          class: campaignData.party.magician.class,
          role: campaignData.party.magician.role,
          image: "./assets/magician_front.png",
          imageRight: "./assets/magician_left.png", // Will be flipped
          imageLeft: "./assets/magician_left.png",
          data: campaignData.party.magician
        }
      ],
      (index, character) => {
        console.log(`Player selected: ${character.name}`);
        resolve({ index, character });
      }
    );
  });
  
  // Wait for UI transition to complete before proceeding to act 3
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get the other two characters for AI control
  const allChars = [
    { 
      ...campaignData.party.swordsman, 
      image: "./assets/swordman_front.png", 
      imageRight: "./assets/swordman_right.png",
      imageLeft: "./assets/swordman_right.png" 
    },
    { 
      ...campaignData.party.archer, 
      image: "./assets/archer_front.png", 
      imageRight: "./assets/archer_right.png",
      imageLeft: "./assets/archer_right.png"
    },
    { 
      ...campaignData.party.magician, 
      image: "./assets/magician_front.png", 
      imageRight: "./assets/magician_left.png",
      imageLeft: "./assets/magician_left.png"
    }
  ];
  const aiCharacters = allChars.filter((_, i) => i !== index);
  
  // Return character data for act3
  return { character, aiCharacters };
}

function splitIntoChunks(text, maxLength) {
  const chunks = [];
  const paragraphs = text.split('\n\n');
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + '\n\n' + paragraph).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function showNarrativeChunks(scene, chunks) {
  for (let i = 0; i < chunks.length; i++) {
    await new Promise(resolve => {
      scene.say(chunks[i], resolve, 'storyteller', true); // Enable voice from the start
    });
  }
}

async function act3_Conversation(scene, playerCharacter, aiCharacters, campaignData) {
  // Store character data globally for highlighting system
  window.playerCharacter = playerCharacter;
  window.playerCharacterName = playerCharacter.name.toLowerCase();
  window.aiCharacters = aiCharacters;
  
  console.log(`🎯 Character assignment: Player="${playerCharacter.name}", AI1="${aiCharacters[0].name}", AI2="${aiCharacters[1].name}"`);
  
  // Hide storyteller, show player character on left
  scene.hideCharacter("storyteller");
  
  // Player on left side: use imageLeft
  // _left images on left: ALWAYS flip
  // _right images on left: NO flip
  const playerNeedsFlip = playerCharacter.imageLeft.includes('_left');
  
  scene.showCharacter(
    "player",
    playerCharacter.imageLeft,
    {
      x: -5,
      y: 0.0,
      height: 5,
      z: 5,
      flip: playerNeedsFlip
    }
  );

  // AI characters on right side: use imageRight
  // _right images on right: ALWAYS flip
  // _left images on right: NO flip
  const ai1NeedsFlip = aiCharacters[0].imageRight.includes('_right');
  
  scene.showCharacter(
    "ai1",
    aiCharacters[0].imageRight,
    {
      x: 4,
      y: 0.0,
      height: 5,
      z: 5,
      flip: ai1NeedsFlip
    }
  );
  
  const ai2NeedsFlip = aiCharacters[1].imageRight.includes('_right');
  
  scene.showCharacter(
    "ai2",
    aiCharacters[1].imageRight,
    {
      x: 6.5,
      y: 0.0,
      height: 5,
      z: 5,
      flip: ai2NeedsFlip
    }
  );

  // Show initial dialogue and wait for user to continue before enabling input
  await new Promise(resolve => {
    scene.say(`You are ${playerCharacter.name}. ${aiCharacters[0].name} and ${aiCharacters[1].name} stand with you. What do you say?`, resolve, 'storyteller', false); // Disable voice
  });

  // Set up conversation continuation backup
  window.continueConversation = async (userInput) => {
    console.log('🔄 Backup conversation continuation with:', userInput);
    
    try {
      // Generate simple AI responses
      const aiCharacters = ['elric', 'seraphine'];
      const character = aiCharacters[Math.floor(Math.random() * aiCharacters.length)];
      
      const responses = [
        "I see your point. What do you suggest we do?",
        "That's concerning. We should remain vigilant.",
        "Agreed. Let's proceed with caution.",
        "I sense the same thing. We must stay alert."
      ];
      
      const response = responses[Math.floor(Math.random() * responses.length)];
      
      await new Promise(resolve => {
        scene.say(response, resolve, character);
      });
      
      // Continue conversation loop
      setTimeout(() => {
        scene.showConversationInput(window.continueConversation);
      }, 500);
      
    } catch (error) {
      console.error('Error in backup conversation:', error);
    }
  };

  // Enable conversation input after user has read the initial message
  handleConversationLoop(scene, playerCharacter, aiCharacters, campaignData);
}

function handleConversationLoop(scene, playerCharacter, aiCharacters, campaignData) {
  console.log('🎯 Registering scene conversation handler');
  
  // Register this conversation handler globally so speech recognition can use it
  window.activeSceneConversationHandler = async (userInput) => {
    console.log('🎭 Scene conversation handler triggered with:', userInput);
    // Show thinking while processing
    scene.showThinking();
    
    try {
      // Check if conversation should end and proceed to next act
      const shouldEndPrompt = `Analyze this player input: "${userInput}"

Does this indicate the party wants to proceed deeper into the keep, move forward, or end the conversation? 
Look for phrases like: "let's go", "we should go", "proceed", "move forward", "enter", "continue", etc.

Respond with only: "yes" or "no"`;

      const endCheckResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.1:8b",
          messages: [
            { role: "system", content: "You determine if the conversation should end based on player intent." },
            { role: "user", content: shouldEndPrompt }
          ],
          options: { temperature: 0 },
          stream: false
        })
      });

      const endData = await endCheckResponse.json();
      const shouldEnd = endData.message.content.trim().toLowerCase().includes("yes");

      if (shouldEnd) {
        // End conversation and proceed to Act 4
        console.log('🔚 Conversation ending - cleaning up conversation handler');
        window.activeSceneConversationHandler = null; // Clear handler to disable SHIFT key input
        
        scene.say("The party steels themselves and steps forward into the Black Keep...", null, 'storyteller');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await act4_GoldenHall(scene, playerCharacter, aiCharacters, campaignData);
        return;
      }

      // Determine who should respond
      const whoRespondsPrompt = `Given this conversation context:
Player (${playerCharacter.name}): "${userInput}"

Who should respond? ${aiCharacters[0].name} (${aiCharacters[0].role}) or ${aiCharacters[1].name} (${aiCharacters[1].role})? Or both?

Respond with just: "1", "2", or "both"`;

      const whoResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.1:8b",
          messages: [
            { role: "system", content: "You are a conversation director. Decide who should respond." },
            { role: "user", content: whoRespondsPrompt }
          ],
          options: { temperature: 0 },
          stream: false
        })
      });

      const whoData = await whoResponse.json();
      const responder = whoData.message.content.trim().toLowerCase();

      // Generate responses
      const responses = [];
      
      if (responder.includes("1") || responder.includes("both")) {
        const response = await generateCharacterResponse(aiCharacters[0], playerCharacter, userInput, campaignData);
        responses.push({ character: aiCharacters[0], text: response, index: 0 });
      }
      
      if (responder.includes("2") || responder.includes("both")) {
        const response = await generateCharacterResponse(aiCharacters[1], playerCharacter, userInput, campaignData);
        responses.push({ character: aiCharacters[1], text: response, index: 1 });
      }

      // Display responses
      for (const resp of responses) {
        const characterName = resp.character.name.toLowerCase();
        await new Promise(resolve => {
          scene.say(`${resp.character.name}: ${resp.text}`, () => {
            // Character finished talking - handle highlight
            scene.onCharacterFinishedTalking(characterName);
            resolve();
          }, characterName);
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Show input again for next message
      setTimeout(() => {
        handleConversationLoop(scene, playerCharacter, aiCharacters, campaignData);
      }, 500);
      
    } catch (error) {
      console.error("Error in conversation:", error);
      scene.say("The conversation pauses for a moment...", null, 'storyteller');
      setTimeout(() => {
        handleConversationLoop(scene, playerCharacter, aiCharacters, campaignData);
      }, 2000);
    }
  };
  
  // Call showConversationInput with the registered handler
  scene.showConversationInput(window.activeSceneConversationHandler);
}

async function generateCharacterResponse(character, playerCharacter, userInput, campaignData) {
  // Build concise character context
  const characterPersonality = {
    "Ronan": "A seasoned swordsman who protects allies. Speaks from experience, not bravado. Favors defensive positioning and reduces risk. Calm, steady, grounded.",
    "Elric": "A disciplined archer who values efficiency over spectacle. Reads the battlefield spatially. Speaks concisely, pragmatically. Favors distance and precision.",
    "Seraphine": "A magician who knows power reshapes reality. Acts with restraint, warns of magical consequences. Speaks carefully with grave control."
  };

  // Build status info with safety checks
  let statusInfo = "";
  if (character.resource) {
    statusInfo += `- ${character.resource.type}: ${character.resource.current}/${character.resource.max}\n`;
  }
  if (character.health_percent !== undefined) {
    statusInfo += `- Health: ${character.health_percent}%\n`;
  }
  if (character.conditions && character.conditions.length > 0) {
    statusInfo += `- Conditions: ${character.conditions.join(', ')}`;
  }

  const systemContent = `You are ${character.name}, a ${character.class || character.role}.

PERSONALITY: ${characterPersonality[character.name] || "A brave adventurer"}

PERSPECTIVE: ${character.arc_perspective || "Ready to face the challenge ahead"}

STATUS:
${statusInfo || "- Ready for action"}

CONTEXT: At the Black Keep to confront dragon Avarrax. ${campaignData.campaign.story_overview.premise}

RULES:
- Stay in character
- Speak naturally (2-3 sentences max)
- Never break the fourth wall
- Favor survival and caution`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.1:8b",
      messages: [
        {
          role: "system",
          content: systemContent
        },
        {
          role: "user",
          content: `${playerCharacter.name} says: "${userInput}"\n\nHow do you respond?`
        }
      ],
      options: { temperature: 0.7 },
      stream: false
    })
  });

  const data = await response.json();
  return data.message.content.trim();
}

async function act4_GoldenHall(scene, playerCharacter, aiCharacters, campaignData) {
  // Hide all characters
  scene.hideAllCharacters();
  
  // Change to golden hall background
  scene.showBackground("./assets/scene_01_background_02.png");
  
  // Show storyteller
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
  
  // Generate narrative for golden hall
  scene.showThinking();
  
  let narrative = null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-r1:8b",
        messages: [
          {
            role: "system",
            content: "You are a masterful storyteller for a dark fantasy adventure. Create atmospheric narratives that build tension and dread."
          },
          {
            role: "user",
            content: `The party (${playerCharacter.name}, ${aiCharacters[0].name}, and ${aiCharacters[1].name}) has entered the Black Keep.

Create a vivid narrative (3-5 paragraphs) describing their entry into a massive hall filled with mountains of gold on both sides. Describe:
- The overwhelming sight of the dragon's hoard
- The oppressive weight of so much wealth
- The eerie silence and stillness
- How the gold reflects torchlight
- The sense that they're being watched
- The corrupting influence of so much greed in one place

Campaign context:
Theme: ${campaignData.campaign.arc.themes.join(', ')}
Tone: ${campaignData.campaign.arc.tone}
Dragon: Avarrax, the Gilded Tyrant

End with them realizing they must press deeper into the keep, toward the throne room.`
          }
        ],
        options: { temperature: 1.0 },
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();
    narrative = data.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
  } catch (error) {
    console.error("Error generating Act 4 narrative:", error);
  }
  
  // Fallback narrative
  if (!narrative || narrative.length < 100) {
    narrative = `The great doors groan open, revealing a sight that steals the breath from your lungs. Gold. Mountains of it. Coins cascade down slopes like metallic dunes, treasure chests overflow with jewels and artifacts, ancient relics lie scattered like forgotten toys. The hall stretches impossibly far, and every inch is buried in wealth.

The air is heavy here, thick with the scent of old metal and something else—something that makes your skin crawl. This isn't treasure. This is a monument to greed itself, a temple where avarice is worshipped in silence.

Your footsteps echo too loudly as you move forward, each step disturbing centuries of undisturbed stillness. The gold doesn't gleam—it watches. You can feel eyes upon you, though you see nothing but reflected torchlight dancing across endless riches.

${aiCharacters[0].name} and ${aiCharacters[1].name} move close beside you. No one speaks. There's nothing to say. The throne room lies ahead, somewhere in this golden labyrinth, and you all know what—or who—waits there.`;
  }
  
  // Show narrative in chunks
  const chunks = splitIntoChunks(narrative, 400);
  await showNarrativeChunks(scene, chunks);
  
  // Transition to Act 5
  await act5_ThroneRoom(scene, playerCharacter, aiCharacters, campaignData);
}

async function act5_ThroneRoom(scene, playerCharacter, aiCharacters, campaignData) {
  // Change to throne room background with Avarrax silhouette
  scene.showBackground("./assets/scene_01_background_03.png");
  
  // Hide storyteller to show full screen
  scene.hideCharacter("storyteller");
  
  // Generate final narrative with maximum tension
  scene.showThinking();
  
  let narrative = null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-r1:8b",
        messages: [
          {
            role: "system",
            content: "You are a masterful storyteller for a dark fantasy adventure. Create climactic, tension-filled narratives for epic confrontations."
          },
          {
            role: "user",
            content: `The party reaches the throne room and sees the silhouette of Avarrax, the Gilded Tyrant, behind his throne.

Create a dramatic, tension-filled narrative (4-6 paragraphs) describing:
- The massive throne room
- The first glimpse of Avarrax's silhouette—huge, draconic, terrifying
- The overwhelming presence of the dragon
- The party's reaction (fear, determination, awe)
- The weight of this moment
- The silence before the confrontation

Dragon: ${campaignData.boss.identity.name}, ${campaignData.boss.identity.title} - ${campaignData.boss.identity.type}
Personality: ${campaignData.boss.personality.join(', ')}
Motivation: ${campaignData.boss.core_motivation.belief}

This is the moment before the battle begins. Build maximum tension. End with the dragon becoming aware of them.`
          }
        ],
        options: { temperature: 1.0 },
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();
    narrative = data.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
  } catch (error) {
    console.error("Error generating Act 5 narrative:", error);
  }
  
  // Fallback narrative
  if (!narrative || narrative.length < 100) {
    narrative = `The throne room rises before you like a cathedral built to worship power itself. Vaulted ceilings disappear into shadow. Pillars of gold support arches that dwarf kingdoms. And there, at the far end of the hall, beyond the mountains of treasure, sits a throne.

But it is not the throne that freezes your blood.

It is the shape behind it.

A silhouette, massive beyond comprehension. Wings furled like collapsed mountains. A neck that curves like a serpent carved from darkness. Eyes—two points of golden light—that seem to burn through the shadows themselves.

Avarrax.

The Gilded Tyrant does not move. Does not speak. The dragon simply exists, and that existence fills the chamber with a weight that presses down on your chest, makes every breath a labor, every heartbeat a drum of war.

${aiCharacters[0].name}'s hand moves to their weapon. ${aiCharacters[1].name} whispers something that might be a prayer. You stand together, three figures dwarfed by the enormity of what you face.

And then—slowly, inevitably—the dragon's eyes focus on you.`;
  }
  
  // Show narrative in chunks
  const chunks = splitIntoChunks(narrative, 400);
  await showNarrativeChunks(scene, chunks);
  
  // Store party data for next scene
  window.playerCharacter = playerCharacter;
  window.playerCharacterName = playerCharacter.name.toLowerCase(); // Store name for highlighting
  window.aiCharacters = aiCharacters;
  
  // Prepare for 3D battle scene
  await new Promise(resolve => {
    scene.say("...", resolve, 'storyteller');
  });
  
  // Stop background music before transitioning to battle
  if (window.backgroundMusic) {
    window.backgroundMusic.pause();
    window.backgroundMusic.currentTime = 0;
  }
  
  // Transition to battle scene (scene_02)
  const scene02 = await import("./scene_02.js");
  await scene02.run({ scene });
}

async function continueWithCharacter(scene, character) {
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

  scene.say(`You have chosen to play as ${character.name}. Your journey begins...`, null, 'storyteller');

  setTimeout(() => {
    scene.showOptions(
      [
        "Approach the keep cautiously",
        "Search the perimeter for another entrance",
        "Make camp and wait until dawn"
      ],
      async (index, option) => {
      // Hide storyteller and show swordmen when options appear
      scene.hideCharacter("storyteller");
      scene.showCharacter(
        "swordman_left",
        "./assets/swordman_right.png",
        {
          x: -5.5,
          y: -0.5,
          height: 6,
          z: 5
        }
      );
      scene.showCharacter(
        "swordman_right",
        "./assets/swordman_right.png",
        {
          x: 5.5,
          y: -0.5,
          height: 6,
          z: 5,
          flip: true
        }
      );
      
      // Show loading/thinking state
      scene.showThinking();
      
      try {
        // Call the ollama API
        const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama3.1:8b",
            messages: [
              {
                role: "system",
                content: await fetch("./prompts/SWORDMAN.md").then(r => r.text())
              },
              {
                role: "user",
                content: `The player chose: "${option}"\n\nDescribe what happens next in the scene at the Black Keep.`
              }
            ],
            options: {
              temperature: 0
            },
            stream: false
          })
        });

        const data = await response.json();
        const aiResponse = data.message.content;
        
        // Display the AI response with typewriter effect
        scene.say(aiResponse, null, 'storyteller');
        
      } catch (error) {
        console.error("Error calling ollama API:", error);
        scene.say("Something went wrong. Please try again.", null, 'storyteller');
      }
    }
  );
  }, 100);
}