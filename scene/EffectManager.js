// EffectManager class for managing visual effects
export class EffectManager {
  constructor(sceneObj) {
    this.sceneObj = sceneObj;
    this.activeEffects = [];
  }

  createFireExplosion(position, scale = 1.0, count = null) {
    console.log("Creating fire explosions on screen");
    
    // Create 3-5 random screen explosions (or custom count)
    const explosionCount = count || (Math.floor(Math.random() * 3) + 3); // 3-5 explosions by default
    
    for (let i = 0; i < explosionCount; i++) {
      // Random position on screen
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      
      // Create explosion DOM element
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
      
      document.body.appendChild(explosion);
      
      // Remove after animation
      setTimeout(() => {
        explosion.remove();
      }, 1200);
    }
    
    // Ensure CSS animation exists
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
  }

  createFireWave() {
    console.log("Creating fire wave from left to right");
    
    // Create 5-8 fire explosions moving from left to right with varying distances
    const explosionCount = Math.floor(Math.random() * 4) + 5; // 5-8 explosions
    const baseY = window.innerHeight / 2 + (Math.random() - 0.5) * 200;
    
    for (let i = 0; i < explosionCount; i++) {
      setTimeout(() => {
        const progress = i / explosionCount;
        const x = progress * window.innerWidth;
        const y = baseY + (Math.random() - 0.5) * 150; // Vary height
        
        const explosion = document.createElement('div');
        explosion.style.position = 'absolute';
        explosion.style.left = x + 'px';
        explosion.style.top = y + 'px';
        explosion.style.width = '250px';
        explosion.style.height = '250px';
        explosion.style.transform = 'translate(-50%, -50%)';
        explosion.style.borderRadius = '50%';
        explosion.style.background = 'radial-gradient(circle, rgba(255,200,0,1) 0%, rgba(255,100,0,0.8) 30%, rgba(255,50,0,0.4) 60%, rgba(0,0,0,0) 100%)';
        explosion.style.animation = 'explode 1s ease-out forwards';
        explosion.style.pointerEvents = 'none';
        explosion.style.zIndex = '1000';
        explosion.style.boxShadow = '0 0 80px rgba(255,100,0,0.8)';
        
        document.body.appendChild(explosion);
        
        setTimeout(() => {
          explosion.remove();
        }, 1000);
      }, i * 100); // Stagger explosions
    }
  }

  createCameraShake(intensity = 1.0, duration = 0.5, direction = 'all') {
    console.log("Creating camera shake effect");
    
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    const startTime = Date.now();
    const originalTransform = canvas.style.transform || '';
    
    const shake = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= duration) {
        canvas.style.transform = originalTransform;
        return;
      }
      
      const progress = elapsed / duration;
      const currentIntensity = intensity * (1 - progress);
      
      let offsetX = 0;
      let offsetY = 0;
      
      if (direction === 'all' || direction === 'horizontal') {
        offsetX = (Math.random() - 0.5) * 20 * currentIntensity;
      }
      if (direction === 'all' || direction === 'vertical') {
        offsetY = (Math.random() - 0.5) * 20 * currentIntensity;
      }
      
      canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      requestAnimationFrame(shake);
    };
    
    shake();
  }

  createBrokenScreenEffect() {
    console.log("Creating broken screen effect");
    
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    overlay.style.background = 'transparent';
    
    // Create crack pattern
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    
    // Create multiple crack lines radiating from center
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const crackCount = 8;
    
    for (let i = 0; i < crackCount; i++) {
      const angle = (i / crackCount) * Math.PI * 2;
      const length = Math.random() * 300 + 200;
      const endX = centerX + Math.cos(angle) * length;
      const endY = centerY + Math.sin(angle) * length;
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midX = (centerX + endX) / 2 + (Math.random() - 0.5) * 50;
      const midY = (centerY + endY) / 2 + (Math.random() - 0.5) * 50;
      
      path.setAttribute('d', `M ${centerX} ${centerY} Q ${midX} ${midY} ${endX} ${endY}`);
      path.setAttribute('stroke', 'rgba(255, 255, 255, 0.6)');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('filter', 'drop-shadow(0 0 5px rgba(255,255,255,0.8))');
      svg.appendChild(path);
      
      // Add secondary cracks
      const branches = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < branches; j++) {
        const branchAngle = angle + (Math.random() - 0.5) * 0.5;
        const branchLength = length * 0.6;
        const branchEndX = centerX + Math.cos(branchAngle) * branchLength;
        const branchEndY = centerY + Math.sin(branchAngle) * branchLength;
        
        const branchPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        branchPath.setAttribute('d', `M ${centerX} ${centerY} L ${branchEndX} ${branchEndY}`);
        branchPath.setAttribute('stroke', 'rgba(255, 255, 255, 0.4)');
        branchPath.setAttribute('stroke-width', '2');
        branchPath.setAttribute('fill', 'none');
        svg.appendChild(branchPath);
      }
    }
    
    overlay.appendChild(svg);
    
    // Add white flash
    overlay.style.background = 'rgba(255, 255, 255, 0.8)';
    overlay.style.animation = 'flashFade 0.8s ease-out forwards';
    
    document.body.appendChild(overlay);
    
    // Ensure flash animation exists
    if (!document.getElementById('flash-style')) {
      const style = document.createElement('style');
      style.id = 'flash-style';
      style.textContent = `
        @keyframes flashFade {
          0% { background: rgba(255, 255, 255, 0.8); }
          100% { background: rgba(255, 255, 255, 0); }
        }
      `;
      document.head.appendChild(style);
    }
    
    setTimeout(() => {
      overlay.remove();
    }, 2000);
  }

  createSlashEffect(angle = 45, length = 'medium', color = 'rgba(100, 150, 255, 0.8)') {
    console.log(`Creating slash effect at ${angle} degrees`);
    
    const slash = document.createElement('div');
    slash.style.position = 'fixed';
    slash.style.top = '50%';
    slash.style.left = '50%';
    slash.style.pointerEvents = 'none';
    slash.style.zIndex = '1000';
    
    // Set length
    const lengthMap = {
      'short': '400px',
      'medium': '600px',
      'long': '1000px'
    };
    const slashLength = lengthMap[length] || '600px';
    
    slash.style.width = slashLength;
    slash.style.height = '8px';
    slash.style.background = `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`;
    slash.style.boxShadow = `0 0 20px ${color}, 0 0 40px ${color}`;
    slash.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scaleX(0)`;
    slash.style.transformOrigin = 'center';
    slash.style.animation = 'slash 0.4s ease-out forwards';
    
    document.body.appendChild(slash);
    
    // Ensure slash animation exists
    if (!document.getElementById('slash-style')) {
      const style = document.createElement('style');
      style.id = 'slash-style';
      style.textContent = `
        @keyframes slash {
          0% {
            transform: translate(-50%, -50%) rotate(${angle}deg) scaleX(0);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) rotate(${angle}deg) scaleX(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(${angle}deg) scaleX(1.2);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    setTimeout(() => {
      slash.remove();
    }, 500);
  }

  createClawSlashEffect() {
    console.log('Creating triple claw slash effect (short-long-short)');
    
    // Create 3 diagonal slashes: short, long, short to simulate claw marks
    const slashes = [
      { angle: -30, length: 'short' },   // First claw - short
      { angle: 0, length: 'long' },      // Middle claw - long
      { angle: 30, length: 'short' }     // Third claw - short
    ];
    const color = 'rgba(255, 50, 50, 0.8)';
    
    slashes.forEach((slashData, index) => {
      setTimeout(() => {
        const slash = document.createElement('div');
        slash.style.position = 'fixed';
        slash.style.top = '50%';
        slash.style.left = '50%';
        slash.style.pointerEvents = 'none';
        slash.style.zIndex = '1000';
        
        // Different lengths: short=500px, long=900px
        const width = slashData.length === 'long' ? '900px' : '500px';
        slash.style.width = width;
        slash.style.height = '12px';
        
        slash.style.background = `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`;
        slash.style.boxShadow = `0 0 30px ${color}, 0 0 50px ${color}`;
        slash.style.transform = `translate(-50%, -50%) rotate(${slashData.angle}deg) scaleX(0)`;
        slash.style.transformOrigin = 'center';
        slash.style.animation = 'clawSlash 0.5s ease-out forwards';
        
        document.body.appendChild(slash);
        
        setTimeout(() => slash.remove(), 600);
      }, index * 80); // Stagger each slash by 80ms
    });
    
    // Ensure claw slash animation exists
    if (!document.getElementById('claw-slash-style')) {
      const style = document.createElement('style');
      style.id = 'claw-slash-style';
      style.textContent = `
        @keyframes clawSlash {
          0% {
            transform: translate(-50%, -50%) rotate(var(--angle, 0deg)) scaleX(0);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) rotate(var(--angle, 0deg)) scaleX(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--angle, 0deg)) scaleX(1.2);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  createFrostbiteEffect() {
    console.log('Creating frostbite effect');
    
    // Create ice crystals spreading across screen
    const crystalCount = 12;
    
    for (let i = 0; i < crystalCount; i++) {
      setTimeout(() => {
        const crystal = document.createElement('div');
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        const size = 40 + Math.random() * 60;
        
        crystal.style.position = 'absolute';
        crystal.style.left = x + 'px';
        crystal.style.top = y + 'px';
        crystal.style.width = size + 'px';
        crystal.style.height = size + 'px';
        crystal.style.transform = 'translate(-50%, -50%) rotate(45deg)';
        crystal.style.background = 'linear-gradient(135deg, rgba(100, 200, 255, 0.8) 0%, rgba(150, 220, 255, 0.6) 50%, rgba(200, 240, 255, 0.3) 100%)';
        crystal.style.boxShadow = '0 0 20px rgba(100, 200, 255, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.5)';
        crystal.style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
        crystal.style.animation = 'frostbite 1.5s ease-out forwards';
        crystal.style.pointerEvents = 'none';
        crystal.style.zIndex = '1000';
        
        document.body.appendChild(crystal);
        
        setTimeout(() => crystal.remove(), 1500);
      }, i * 80);
    }
    
    // Create frost overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'radial-gradient(circle, rgba(100, 200, 255, 0.3) 0%, rgba(200, 240, 255, 0.1) 100%)';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '999';
    overlay.style.animation = 'frostOverlay 1.5s ease-out forwards';
    
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1500);
    
    // Ensure frostbite animation exists
    if (!document.getElementById('frostbite-style')) {
      const style = document.createElement('style');
      style.id = 'frostbite-style';
      style.textContent = `
        @keyframes frostbite {
          0% {
            transform: translate(-50%, -50%) rotate(45deg) scale(0);
            opacity: 0;
          }
          30% {
            transform: translate(-50%, -50%) rotate(45deg) scale(1.2);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(45deg) scale(1);
            opacity: 0;
          }
        }
        @keyframes frostOverlay {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  createGreenExplosion() {
    console.log('Creating green arrow explosion');
    
    // Single green explosion in center
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    
    const explosion = document.createElement('div');
    explosion.style.position = 'absolute';
    explosion.style.left = x + 'px';
    explosion.style.top = y + 'px';
    explosion.style.width = '250px';
    explosion.style.height = '250px';
    explosion.style.transform = 'translate(-50%, -50%)';
    explosion.style.borderRadius = '50%';
    explosion.style.background = 'radial-gradient(circle, rgba(0,255,100,1) 0%, rgba(0,200,80,0.8) 30%, rgba(0,150,50,0.4) 60%, rgba(0,0,0,0) 100%)';
    explosion.style.animation = 'explode 1s ease-out forwards';
    explosion.style.pointerEvents = 'none';
    explosion.style.zIndex = '1000';
    explosion.style.boxShadow = '0 0 80px rgba(0,255,100,0.8)';
    
    document.body.appendChild(explosion);
    
    setTimeout(() => explosion.remove(), 1000);
  }

  createPurpleExplosions() {
    console.log('Creating purple spell explosions');
    
    // Create 2-3 smaller purple explosions
    const explosionCount = Math.floor(Math.random() * 2) + 2; // 2-3 explosions
    
    for (let i = 0; i < explosionCount; i++) {
      setTimeout(() => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        
        const explosion = document.createElement('div');
        explosion.style.position = 'absolute';
        explosion.style.left = x + 'px';
        explosion.style.top = y + 'px';
        explosion.style.width = '180px';
        explosion.style.height = '180px';
        explosion.style.transform = 'translate(-50%, -50%)';
        explosion.style.borderRadius = '50%';
        explosion.style.background = 'radial-gradient(circle, rgba(200,0,255,1) 0%, rgba(150,0,200,0.8) 30%, rgba(100,0,150,0.4) 60%, rgba(0,0,0,0) 100%)';
        explosion.style.animation = 'explode 1s ease-out forwards';
        explosion.style.pointerEvents = 'none';
        explosion.style.zIndex = '1000';
        explosion.style.boxShadow = '0 0 60px rgba(200,0,255,0.8)';
        
        document.body.appendChild(explosion);
        
        setTimeout(() => explosion.remove(), 1000);
      }, i * 150);
    }
  }

  createHealingEffectAllCharacters() {
    console.log("Creating healing effects on all characters");
    
    // Create healing glow at three positions (for swordman, archer, magician)
    const positions = [
      { x: window.innerWidth * 0.35, y: window.innerHeight * 0.6 }, // Swordman (left)
      { x: window.innerWidth * 0.5, y: window.innerHeight * 0.6 },  // Archer (center)
      { x: window.innerWidth * 0.65, y: window.innerHeight * 0.6 }  // Magician (right)
    ];
    
    positions.forEach((pos, index) => {
      setTimeout(() => {
        // Create healing particle ring
        const healing = document.createElement('div');
        healing.style.position = 'absolute';
        healing.style.left = pos.x + 'px';
        healing.style.top = pos.y + 'px';
        healing.style.width = '150px';
        healing.style.height = '150px';
        healing.style.transform = 'translate(-50%, -50%)';
        healing.style.borderRadius = '50%';
        healing.style.background = 'radial-gradient(circle, rgba(100, 255, 150, 0.8) 0%, rgba(150, 255, 200, 0.5) 40%, rgba(255, 150, 255, 0.3) 70%, rgba(0,0,0,0) 100%)';
        healing.style.animation = 'healPulse 1.5s ease-out forwards';
        healing.style.pointerEvents = 'none';
        healing.style.zIndex = '1000';
        healing.style.boxShadow = '0 0 60px rgba(100, 255, 150, 0.6)';
        
        document.body.appendChild(healing);
        
        // Create floating particles
        for (let i = 0; i < 8; i++) {
          const particle = document.createElement('div');
          const angle = (i / 8) * Math.PI * 2;
          const radius = 50;
          const particleX = pos.x + Math.cos(angle) * radius;
          const particleY = pos.y + Math.sin(angle) * radius;
          
          particle.style.position = 'absolute';
          particle.style.left = particleX + 'px';
          particle.style.top = particleY + 'px';
          particle.style.width = '10px';
          particle.style.height = '10px';
          particle.style.borderRadius = '50%';
          particle.style.background = 'rgba(150, 255, 200, 0.9)';
          particle.style.animation = 'healFloat 1.2s ease-out forwards';
          particle.style.pointerEvents = 'none';
          particle.style.zIndex = '1000';
          particle.style.boxShadow = '0 0 10px rgba(150, 255, 200, 0.8)';
          
          document.body.appendChild(particle);
          
          setTimeout(() => particle.remove(), 1200);
        }
        
        setTimeout(() => healing.remove(), 1500);
      }, index * 100); // Stagger each character's healing effect
    });
    
    // Add CSS animations if not already present
    if (!document.getElementById('heal-style')) {
      const style = document.createElement('style');
      style.id = 'heal-style';
      style.textContent = `
        @keyframes healPulse {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }
        @keyframes healFloat {
          0% {
            transform: translate(-50%, -50%) translateY(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translateY(-80px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  update(delta) {
    // No need to update anything for DOM-based effects
  }
}
