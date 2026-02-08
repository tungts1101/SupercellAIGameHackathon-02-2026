# Supercell AI Game Hackathon - Interactive D&D Adventure

An AI-powered interactive visual novel and turn-based combat game featuring head-tracking camera controls, voice interaction, and multiple AI agents.

---

## 📋 Table of Contents
- [Key Features](#-key-features)
- [Quick Start](#-quick-start)
- [Game Controls](#-game-controls)
- [AI Integration](#-ai-integration)
- [Credits & Attribution](#-credits--attribution)
- [Known Issues](#️-known-issues)
- [Future Improvements](#-future-improvements)

---

## ✨ Key Features

- 🎭 **Interactive Visual Novel** - Dynamic storytelling with AI-generated narratives
- ⚔️ **Turn-Based Combat** - Strategic 3D battles with real-time AI decisions
- 🎥 **Head Tracking Camera** - Immersive perspective control using face tracking
- 🎤 **Voice Interaction** - Natural language conversations with AI characters
- 🤖 **Multiple AI Agents** - Each character powered by specialized AI models
- 🎮 **Mixed Control** - Player controls one hero, AI manages companions and enemies

---

## 🚀 Quick Start

### Step 1: Download Assets
Download the game assets from [Google Drive](https://drive.google.com/drive/folders/1KgMVSnv4ViHmujQ7BX-Awq2urHb0xmYw?usp=sharing) and extract to the project root directory.

### Step 2: Start the Server
```bash
python -m http.server 8080
```

### Step 3: Open in Browser
Navigate to `localhost:8080` in your web browser.

### Step 4: Initialize Audio
> **⚡ Important**: Press **TAB** on first load to enable music and voice narration!

### Step 5: Grant Permissions
> **📷 🎤 Required**: Allow camera and microphone access when prompted for the full experience (head tracking and voice interaction).

---

## 🎮 Game Controls

### General Navigation

| Key | Action |
|-----|--------|
| **TAB** | Fast forward narrative / Start battle |
| **LEFT SHIFT** | Record voice input |
| **RIGHT SHIFT** | Type text in conversation |

### Battle Mode

**You control one character** - AI manages your party members and the boss.

| Character | Key | Action |
|-----------|-----|--------|
| **Ronan (Swordsman)** | `1` | Slash attack |
| | `2` | Heavy slash |
| | `3` | Block |
| **Elric (Archer)** | `1` | Stab attack |
| | `2` | Shoot arrow |
| | `3` | Dodge |
| **Seraphine (Magician)** | `1` | Cast spell |
| | `2` | Cast heavy spell |
| | `3` | Heal stamina |

---

## 🤖 AI Integration

### Ollama Server Configuration

**Current Server:**  
```
https://excitingly-unsolitary-jayson.ngrok-free.dev
```
⏰ *Valid until: February 9, 2026 (JST)*

**To Change Server URL:**  
Edit [config.js](config.js) and update:
```javascript
export const OLLAMA_BASE_URL = "your-server-url-here";
```

### AI Models by Scene

| Scene | Model | Purpose |
|-------|-------|---------|
| **Scene 01 (Visual Novel)** | `deepseek-r1:8b` | Storytelling and narrative generation |
| | `llama3.1:8b` | Character conversations and dialogue |
| **Scene 02 (Combat)** | `gemma:7b` | AI character tactical decisions |
| | `llama3.1:8b` | Combat narration and descriptions |
| **Scene 03 (Ending)** | `deepseek-r1:8b` | Ending narrative generation |

---

## 🎨 Credits & Attribution

### 🎵 Audio
- **Soundtrack**: Vivaldi - Four Seasons from [Classicals.de](https://www.classicals.de/vivaldi-seasons)

### 🎨 3D Assets
- **Character Models**: [Hyper3D Rodin](https://hyper3d.ai/rodin)
- **Rigging & Animation**: [Mixamo](https://www.mixamo.com)
- **Dragon Model**: [Tarisland Dragon](https://sketchfab.com/3d-models/tarisland-dragon-5cc18c454a83405984900ae1c654d7de) (Sketchfab)

### ✍️ Design & Story
- **Textures**: ChatGPT
- **Plot**: ChatGPT
- **Visual Novel Design**: Dungeons & Dragons
- **Interactive Camera**: [off-axis-sneaker](https://github.com/icurtis1/off-axis-sneaker)

### 💻 Development
- **Code**: Claude Sonnet 4.5

---

## ⚠️ Known Issues

- **Must press TAB first** to initialize music and voice narration
- Voice narration may skip if TAB is not pressed before narrative continues
- Camera angle in battle scene needs refinement
- Combat effects are not fully real-time synchronized
- Open an issue for any bugs you encounter

---

## 🔮 Future Improvements

- Voice command support for battle actions
- Hand gesture controls during combat
- Additional story branches and endings