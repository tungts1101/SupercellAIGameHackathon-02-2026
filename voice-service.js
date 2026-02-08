// Text-to-Voice Service Module
// This module provides text-to-speech functionality for narrative, character dialogue, and boss speech

export class VoiceService {
  constructor() {
    this.currentAudio = null;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.abortController = null;
    this.voiceProfiles = {
      storyteller: {
        voice: 'narrator', // Deep, authoritative voice
        speed: 0.9,
        pitch: 0.8
      },
      swordman: {
        voice: 'male-warrior',
        speed: 1.0,
        pitch: 1.0
      },
      archer: {
        voice: 'male-ranger',
        speed: 1.1,
        pitch: 1.2
      },
      magician: {
        voice: 'female-mage',
        speed: 0.95,
        pitch: 1.1
      },
      boss: {
        voice: 'dragon',
        speed: 0.8,
        pitch: 0.6
      },
      avarrax: {
        voice: 'dragon',
        speed: 0.8,
        pitch: 0.6
      },
      // Story characters
      elric: {
        voice: 'male-warrior', // Strong male voice for warrior
        speed: 1.0,
        pitch: 1.0
      },
      ronan: {
        voice: 'male-ranger', // Ranger voice
        speed: 1.1,
        pitch: 1.2
      },
      seraphine: {
        voice: 'female-mage', // Female mage voice
        speed: 0.95,
        pitch: 1.1
      }
    };
    
    // Initialize state flags
    this.stopping = false;
    this.currentCharacter = null;
    
    // Stop voice when page is reloaded or closed
    window.addEventListener('beforeunload', () => {
      this.stopAllVoice();
    });
    
    // Also handle page hide (mobile/tablet compatibility)
    window.addEventListener('pagehide', () => {
      this.stopAllVoice();
    });
  }

  /**
   * Filter text to remove expressions and actions for voice synthesis
   */
  filterTextForVoice(text) {
    // Remove text within asterisks (expressions and actions)
    let filteredText = text.replace(/\*[^*]*\*/g, '');
    
    // Remove extra whitespace and clean up punctuation
    filteredText = filteredText.replace(/\s+/g, ' ').trim();
    
    // Remove character names with colons at the beginning (e.g., "Elric: ")
    filteredText = filteredText.replace(/^[A-Za-z]+:\s*/, '');
    
    return filteredText;
  }

  /**
   * Convert text to speech and play it
   * @param {string} text - Text to convert to speech
   * @param {string} character - Character speaking (storyteller, swordman, archer, magician, boss, avarrax)
   * @param {Function} onComplete - Callback when speech completes naturally
   * @param {Function} onInterrupt - Callback when speech is interrupted
   * @returns {Promise<boolean>} - Returns true if completed naturally, false if interrupted
   */
  async playVoice(text, character = 'storyteller', onComplete = null, onInterrupt = null) {
    // Always stop previous voice to ensure new one starts
    if (this.isPlaying || this.currentUtterance || speechSynthesis.speaking) {
      this.stop();
    }
    
    // Filter text to remove expressions and actions
    const filteredText = this.filterTextForVoice(text);
    
    // Skip if no actual dialogue remains after filtering
    if (!filteredText.trim()) {
      console.log('🔇 No dialogue to speak after filtering expressions');
      this.isPlaying = false;
      if (onComplete) onComplete();
      return true;
    }
    
    try {
      this.isPlaying = true;
      this.currentCharacter = character;
      this.abortController = new AbortController();
      
      const voiceProfile = this.voiceProfiles[character.toLowerCase()] || this.voiceProfiles.storyteller;
      
      // Generate voice using filtered text
      const audioResult = await this.generateVoice(filteredText, voiceProfile);
      
      if (!audioResult || this.abortController.signal.aborted) {
        this.isPlaying = false;
        if (onComplete) onComplete(); // Call complete since no audio means silent completion
        return true;
      }
      
      // Handle different types of audio results
      if (audioResult === 'direct') {
        // Web Speech API - direct synthesis, no audio element needed
        console.log(`🔊 Playing voice for ${character}: "${filteredText.substring(0, 50)}${filteredText.length > 50 ? '...' : ''}"`);
        console.log(`📝 Original: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}" -> Filtered: "${filteredText.substring(0, 30)}${filteredText.length > 30 ? '...' : ''}"`);
        
        // Create a promise that resolves when speech ends
        const speechPromise = new Promise((resolve) => {
          if (this.currentUtterance) {
            this.currentUtterance.onend = () => {
              this.isPlaying = false;
              this.currentUtterance = null;
              if (onComplete) onComplete();
              resolve(true);
            };
            
            this.currentUtterance.onerror = (event) => {
              console.error('Speech synthesis error:', event.error);
              this.isPlaying = false;
              this.currentUtterance = null;
              if (onInterrupt) onInterrupt();
              resolve(false);
            };
            
            // Check for abort during speech
            this.abortController.signal.addEventListener('abort', () => {
              if (this.currentUtterance) {
                speechSynthesis.cancel();
                this.currentUtterance = null;
              }
              this.isPlaying = false;
              if (onInterrupt) onInterrupt();
              resolve(false);
            });
          } else {
            // No utterance available, complete immediately
            this.isPlaying = false;
            if (onComplete) onComplete();
            resolve(true);
          }
        });
        
        return await speechPromise;
      } else {
        // Audio URL from other TTS services
        // Create and play audio
        this.currentAudio = new Audio(audioResult);
        this.currentAudio.volume = 0.8;
        
        // Set up event listeners
        const playPromise = new Promise((resolve, reject) => {
          this.currentAudio.onended = () => {
            this.isPlaying = false;
            this.currentAudio = null;
            if (onComplete) onComplete();
            resolve(true); // Completed naturally
          };
          
          this.currentAudio.onerror = (error) => {
            console.error('Voice playback error:', error);
            this.isPlaying = false;
            this.currentAudio = null;
            if (onInterrupt) onInterrupt();
            reject(error);
          };
          
          // Check for abort during playback
          this.abortController.signal.addEventListener('abort', () => {
            if (this.currentAudio) {
              this.currentAudio.pause();
              this.currentAudio.currentTime = 0;
              this.currentAudio = null;
            }
            this.isPlaying = false;
            if (onInterrupt) onInterrupt();
            resolve(false); // Interrupted
          });
        });
        
        // Start playback
        await this.currentAudio.play();
        console.log(`🔊 Playing voice for ${character}: "${filteredText.substring(0, 50)}${filteredText.length > 50 ? '...' : ''}"`);
        console.log(`📝 Original: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}" -> Filtered: "${filteredText.substring(0, 30)}${filteredText.length > 30 ? '...' : ''}"`);
        
        return await playPromise;
      }
      
    } catch (error) {
      console.error('Voice generation/playback failed:', error);
      this.isPlaying = false;
      this.currentAudio = null;
      if (onComplete) onComplete(); // Call complete to continue flow
      return true;
    }
  }

  /**
   * Generate voice using Web Speech API (built into browsers)
   */
  async generateVoice(text, voiceProfile) {
    // Check if Web Speech API is supported
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API not supported');
      return null;
    }

    try {
      // Get available voices with timeout protection
      let voices = speechSynthesis.getVoices();
      
      // If voices aren't loaded yet, wait for them with timeout
      if (voices.length === 0) {
        try {
          await Promise.race([
            new Promise(resolve => {
              speechSynthesis.addEventListener('voiceschanged', resolve, { once: true });
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Voices loading timeout')), 5000))
          ]);
          voices = speechSynthesis.getVoices();
        } catch (error) {
          console.warn('Voices loading failed:', error);
          // Continue with empty voices array
        }
      }

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Character-specific voice selection and settings
      let selectedVoice = null;
      
      switch (voiceProfile.voice) {
        case 'narrator':
          // Deep male voice for narrator
          selectedVoice = voices.find(v => 
            v.name.includes('David') || v.name.includes('Alex') || 
            (v.name.includes('Male') && v.lang.startsWith('en'))
          );
          utterance.pitch = 0.5; // Much deeper
          utterance.rate = 0.8;   // Slower
          break;
          
        case 'male-warrior':
          // Strong male voice for warrior
          selectedVoice = voices.find(v => 
            v.name.includes('Mark') || v.name.includes('George') ||
            (v.name.includes('Male') && v.lang.startsWith('en'))
          );
          utterance.pitch = 0.9;  // Lower pitch
          utterance.rate = 1.0;   // Normal speed
          break;
          
        case 'male-ranger':
          // Slightly higher, faster voice for ranger
          selectedVoice = voices.find(v => 
            v.name.includes('Daniel') || v.name.includes('Tom') ||
            (v.name.includes('Male') && v.lang.startsWith('en'))
          );
          utterance.pitch = 1.4;  // Higher pitch
          utterance.rate = 1.2;   // Faster
          break;
          
        case 'female-mage':
          // Mystical female voice for mage
          selectedVoice = voices.find(v => 
            v.name.includes('Zira') || v.name.includes('Victoria') || v.name.includes('Samantha') ||
            (v.name.includes('Female') && v.lang.startsWith('en'))
          );
          utterance.pitch = 1.6;  // Much higher pitch
          utterance.rate = 0.9;   // Slightly slower
          break;
          
        case 'dragon':
          // Deep, slow voice for dragon
          selectedVoice = voices.find(v => 
            v.name.includes('Mark') || v.name.includes('Alex') ||
            (v.name.includes('Male') && v.lang.startsWith('en'))
          );
          utterance.pitch = 0.3;  // Very deep
          utterance.rate = 0.7;   // Very slow
          break;
          
        default:
          utterance.pitch = voiceProfile.pitch || 1.0;
          utterance.rate = voiceProfile.speed || 1.0;
      }
      
      // Fallback to any English voice if specific voice not found
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en'));
      }
      
      // Final fallback to first available voice
      if (!selectedVoice && voices.length > 0) {
        selectedVoice = voices[0];
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log(`🎵 Using voice: ${selectedVoice.name} for ${voiceProfile.voice}`);
        console.log(`🔧 Voice settings - pitch: ${utterance.pitch}, rate: ${utterance.rate}`);
      } else {
        console.log(`🎵 Using default voice for ${voiceProfile.voice}`);
      }
      
      utterance.volume = 0.8;
      
      // Store utterance for potential cancellation
      this.currentUtterance = utterance;
      
      // Speak the text directly with error protection
      try {
        speechSynthesis.speak(utterance);
        console.log(`🔊 Speaking: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);        
      } catch (speechError) {
        console.warn('Speech synthesis failed:', speechError);
        this.currentUtterance = null;
        return null;
      }
      
    } catch (error) {
      console.warn('Web Speech API error:', error);
      return null;
    }
  }

  /**
   * Example custom REST server integration (commented out)
   */
  /*
  async callCustomTTSAPI(text, voiceProfile) {
    try {
      const response = await fetch('YOUR_TTS_SERVER_URL/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          character: voiceProfile.voice,
          speed: voiceProfile.speed,
          pitch: voiceProfile.pitch
        })
      });
      
      if (!response.ok) {
        throw new Error('TTS API failed');
      }
      
      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.warn('TTS service unavailable:', error);
      return null;
    }
  }
  */

  /**
   * Stop any currently playing voice immediately
   */
  stop() {
    // Prevent multiple simultaneous stop calls
    if (this.stopping) {
      return;
    }
    
    console.log('🔇 Stopping voice playback immediately');
    this.stopping = true;
    
    // Set flag first to prevent any new audio from starting
    this.isPlaying = false;
    
    // Abort any ongoing operations
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    // Stop audio playback immediately
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.src = ''; // Clear source to fully stop
      this.currentAudio = null;
    }
    
    // Stop speech synthesis immediately and clear queue
    if (this.currentUtterance) {
      // Cancel all pending utterances
      speechSynthesis.cancel();
      
      // Also try to pause and reset (backup method)
      try {
        speechSynthesis.pause();
        speechSynthesis.resume();
        speechSynthesis.cancel();
      } catch (e) {
        // Some browsers might throw errors, ignore them
      }
      
      this.currentUtterance = null;
    }
    
    // Force cancel any remaining speech synthesis
    try {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
    } catch (e) {
      // Browser compatibility fallback
    }
    
    // Reset stopping flag after a short delay
    setTimeout(() => {
      this.stopping = false;
    }, 100);
  }

  /**
   * Stop all voice playback when narrative completely ends
   */
  stopAllVoice() {
    console.log('🔇 Stopping all voice - narrative ended');
    
    // Force stop everything
    this.stop();
    
    // Additional cleanup for narrative end
    this.currentCharacter = null;
    this.isPlaying = false;
    
    // Cancel any remaining speech synthesis globally
    try {
      speechSynthesis.cancel();
      
      // Double-check and force cancel if needed
      setTimeout(() => {
        if (speechSynthesis.speaking) {
          speechSynthesis.cancel();
        }
      }, 100);
    } catch (e) {
      // Ignore errors
    }
  }

  /**
   * Check if voice is currently playing
   */
  isVoicePlaying() {
    return this.isPlaying;
  }

  /**
   * Set global volume for voice playback
   */
  setVolume(volume) {
    if (this.currentAudio) {
      this.currentAudio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get available voice profiles
   */
  getVoiceProfiles() {
    return Object.keys(this.voiceProfiles);
  }

  /**
   * Update voice profile settings
   */
  updateVoiceProfile(character, settings) {
    if (this.voiceProfiles[character]) {
      this.voiceProfiles[character] = { ...this.voiceProfiles[character], ...settings };
    }
  }
}

// Global voice service instance
export const voiceService = new VoiceService();

/**
 * Enhanced dialogue rendering with voice support for full narrative chunks
 * @param {HTMLElement} textBox - Text container element
 * @param {string} text - Text to render
 * @param {string} character - Character speaking
 * @param {number} typeSpeed - Typing speed (ms per character)
 * @param {Function} onComplete - Callback when complete
 * @param {boolean} enableVoice - Whether to enable voice playback
 * @returns {Object} - Control object with stop() method
 */
export function renderDialogueWithVoice(textBox, text, character = 'storyteller', typeSpeed = 30, onComplete = null, enableVoice = true, clearPrevious = true) {
  let currentChar = 0;
  let typing = true;
  let typeInterval = null;
  let voiceCompleted = false;
  let textCompleted = false;
  let interrupted = false;
  let allowFastForward = false; // Prevent immediate fast-forward
  let startingTextLength = 0;

  // Store the starting length if we're appending
  if (!clearPrevious) {
    startingTextLength = textBox.textContent.length;
  }

  // Allow fast-forward after a short delay to prevent auto-triggering
  setTimeout(() => {
    allowFastForward = true;
  }, 500); // 500ms delay

  // Start voice playback for the entire narrative chunk if enabled
  if (enableVoice) {
    voiceService.playVoice(
      text, 
      character,
      () => {
        // Voice completed naturally
        voiceCompleted = true;
        checkCompletion();
      },
      () => {
        // Voice interrupted
        voiceCompleted = true;
        checkCompletion();
      }
    );
  } else {
    voiceCompleted = true;
  }

  // Start text typing simultaneously
  typeInterval = setInterval(() => {
    if (currentChar < text.length && typing) {
      // If appending, add to existing content; if not, replace completely
      if (clearPrevious || startingTextLength === 0) {
        textBox.textContent = text.substring(0, currentChar + 1);
      } else {
        // Get existing text up to the starting point and append new character
        const existingText = textBox.textContent.substring(0, startingTextLength);
        textBox.textContent = existingText + text.substring(0, currentChar + 1);
      }
      currentChar++;
    } else {
      clearInterval(typeInterval);
      typing = false;
      textCompleted = true;
      checkCompletion();
    }
  }, typeSpeed);

  function checkCompletion() {
    if ((textCompleted || interrupted) && (voiceCompleted || interrupted) && !interrupted) {
      if (onComplete) onComplete();
    }
  }

  // Return control object
  return {
    stop: () => {
      interrupted = true;
      typing = false;
      
      // Stop typing
      if (typeInterval) {
        clearInterval(typeInterval);
      }
      
      // Show full text immediately (append or replace based on clearPrevious)
      if (clearPrevious || startingTextLength === 0) {
        textBox.textContent = text;
      } else {
        // Preserve existing text and show full new text
        const existingText = textBox.textContent.substring(0, startingTextLength);
        textBox.textContent = existingText + text;
      }
      
      // When dialogue is stopped, also stop voice to prevent overlap
      voiceService.stop();
      
      // Mark voice as completed to avoid waiting
      voiceCompleted = true;
      
      checkCompletion();
    },
    isPlaying: () => allowFastForward && (typing || voiceService.isVoicePlaying()),
    getText: () => text,
    getCharacter: () => character
  };
}

/**
 * Quick TAB handler for fast-forwarding dialogue
 * Call this in your keydown event handlers
 */
export function handleDialogueFastForward(dialogueController, event) {
  // Let voice continue playing, don't interfere with navigation
  return false; // Never handle - let normal TAB logic work
}

/**
 * Stop all voice when narrative ends completely
 */
export function stopAllVoice() {
  voiceService.stopAllVoice();
}