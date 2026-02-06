export async function run({ scene }) {
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

  scene.say(
    "The Black Keep does not announce itself. It simply becomes unavoidable.\n\nYou've been on the road for three days now, following rumors and half-forgotten maps. The forest grows darker with each passing mile, the trees twisted and ancient. Even the birds have fallen silent here.\n\nAhead, through the mist, you can make out the silhouette of a massive stone fortress. Its walls are black as obsidian, and no light shines from within. This is it—the place you've been searching for.\n\nBut something feels wrong. The air is too still, too heavy. Your hand instinctively moves to the hilt of your sword."
  );

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
        const response = await fetch("https://excitingly-unsolitary-jayson.ngrok-free.dev/api/chat", {
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
        scene.say(aiResponse);
        
      } catch (error) {
        console.error("Error calling ollama API:", error);
        scene.say("Something went wrong. Please try again.");
      }
    }
  );
}