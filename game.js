class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.setupAudio();
        
        // Game state
        this.gameState = 'start'; // start, playing, gameOver
        this.score = 0;
        this.bestScore = localStorage.getItem('fillTheAirBest') || 0;
        this.scrollSpeed = 1.2;
        this.scrollOffset = 0;
        
        // Bubble properties
        this.bubble = {
            x: 100,
            y: 300,
            radius: 20,
            minRadius: 8,
            maxRadius: 80,
            isGrowing: false,
            growthRate: 0.8,
            shrinkRate: 0.4,
            velocity: { x: 0, y: 0 },
            color: 'rgba(255, 255, 255, 0.9)',
            buoyancy: 0.15, // Upward force when growing
            gravity: 0.12,  // Downward force when shrinking
            disappeared: false
        };
        
        // World generation
        this.obstacles = [];
        this.gaps = [];
        this.lastObstacleX = this.canvas.width;
        this.obstacleSpacing = 200;
        
        this.setupEventListeners();
        this.generateInitialWorld();
        this.updateUI();
        this.gameLoop();
    }
    
    setupCanvas() {
        const updateCanvasSize = () => {
            const container = document.getElementById('gameContainer');
            const containerRect = container.getBoundingClientRect();
            
            // Set canvas to fill container while maintaining aspect ratio
            this.canvas.width = Math.min(400, containerRect.width);
            this.canvas.height = containerRect.height;
            
            // Adjust bubble position if canvas size changed
            if (this.bubble) {
                this.bubble.y = Math.min(this.bubble.y, this.canvas.height - this.bubble.radius);
            }
        };
        
        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);
        window.addEventListener('orientationchange', () => {
            setTimeout(updateCanvasSize, 100);
        });
    }
    
    setupAudio() {
        this.audioContext = null;
        this.sounds = {
            inflate: null,
            tap: null,
            pop: null
        };
        this.isInflating = false;
        
        // Initialize audio context on first user interaction
        this.initAudioContext = () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.createSounds();
            }
        };
    }
    
    createSounds() {
        // Create inflation sound (gentle woooooosh)
        this.createInflateSound = () => {
            if (!this.audioContext) return null;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.1);
            
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.05);
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime + 0.1);
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            return { oscillator, gainNode };
        };
        
        // Create tap sound (tiny plip)
        this.createTapSound = () => {
            if (!this.audioContext) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.1);
        };
        
        // Create pop sound (soft pop)
        this.createPopSound = () => {
            if (!this.audioContext) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.2);
            
            filter.type = 'lowpass';
            filter.frequency.value = 500;
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.2);
        };
    }
    
    startInflateSound() {
        if (!this.isInflating && this.audioContext) {
            this.isInflating = true;
            const sound = this.createInflateSound();
            if (sound) {
                this.currentInflateSound = sound;
                sound.oscillator.start();
                
                // Keep the sound going while inflating
                const sustainInflateSound = () => {
                    if (this.isInflating && this.bubble.isGrowing) {
                        // Continue the sound by creating a new one
                        setTimeout(() => {
                            if (this.isInflating && this.bubble.isGrowing) {
                                sound.oscillator.stop();
                                this.currentInflateSound = this.createInflateSound();
                                if (this.currentInflateSound) {
                                    this.currentInflateSound.oscillator.start();
                                    sustainInflateSound();
                                }
                            }
                        }, 200);
                    }
                };
                sustainInflateSound();
            }
        }
    }
    
    stopInflateSound() {
        if (this.isInflating && this.currentInflateSound) {
            this.isInflating = false;
            this.currentInflateSound.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);
            this.currentInflateSound.oscillator.stop(this.audioContext.currentTime + 0.1);
            this.currentInflateSound = null;
        }
    }
    
    setupEventListeners() {
        const startBtn = document.getElementById('startBtn');
        const restartBtn = document.getElementById('restartBtn');
        
        startBtn.addEventListener('click', () => {
            this.initAudioContext();
            this.startGame();
        });
        restartBtn.addEventListener('click', () => {
            this.initAudioContext();
            this.startGame();
        });
        
        // Touch controls for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.initAudioContext();
            if (this.gameState === 'playing') {
                this.bubble.isGrowing = true;
                this.createTapSound();
                this.startInflateSound();
            }
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.gameState === 'playing') {
                this.bubble.isGrowing = false;
                this.stopInflateSound();
            }
        });
        
        // Mouse controls for desktop
        this.canvas.addEventListener('mousedown', (e) => {
            this.initAudioContext();
            if (this.gameState === 'playing') {
                this.bubble.isGrowing = true;
                this.createTapSound();
                this.startInflateSound();
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (this.gameState === 'playing') {
                this.bubble.isGrowing = false;
                this.stopInflateSound();
            }
        });
        
        // Prevent context menu on long press
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.scrollOffset = 0;
        this.scrollSpeed = 2;
        
        // Reset bubble
        this.bubble.x = 100;
        this.bubble.y = this.canvas.height / 2;
        this.bubble.radius = 25;
        this.bubble.isGrowing = false;
        this.bubble.velocity = { x: 0, y: 0 };
        this.bubble.disappeared = false;
        
        // Reset world
        this.obstacles = [];
        this.gaps = [];
        this.lastObstacleX = this.canvas.width;
        this.generateInitialWorld();
        
        // Hide screens
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        
        this.updateUI();
    }
    
    generateInitialWorld() {
        // Generate initial obstacles and gaps
        for (let x = this.canvas.width; x < this.canvas.width + 1000; x += this.obstacleSpacing) {
            this.generateObstacleGroup(x);
        }
    }
    
    generateObstacleGroup(x) {
        const gapSize = Math.random() * 120 + 140; // Gap between 140-260 pixels
        const gapY = Math.random() * (this.canvas.height - gapSize - 100) + 50;
        
        // Top obstacle
        if (gapY > 0) {
            this.obstacles.push({
                x: x,
                y: 0,
                width: 30,
                height: gapY,
                type: 'obstacle'
            });
        }
        
        // Bottom obstacle
        if (gapY + gapSize < this.canvas.height) {
            this.obstacles.push({
                x: x,
                y: gapY + gapSize,
                width: 30,
                height: this.canvas.height - (gapY + gapSize),
                type: 'obstacle'
            });
        }
        
        // Store gap information for scoring and collision detection
        this.gaps.push({
            x: x,
            y: gapY,
            width: 30,
            height: gapSize,
            passed: false
        });
        
        // Add some floating obstacles occasionally
        if (Math.random() < 0.3) {
            this.obstacles.push({
                x: x + 100,
                y: Math.random() * (this.canvas.height - 40) + 20,
                width: 40,
                height: 20,
                type: 'floating'
            });
        }
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        // Update bubble size and physics
        if (this.bubble.isGrowing) {
            // Growing: increase size and float up
            this.bubble.radius = Math.min(
                this.bubble.radius + this.bubble.growthRate,
                this.bubble.maxRadius
            );
            // Add upward buoyancy force when growing
            this.bubble.velocity.y -= this.bubble.buoyancy;
        } else {
            // Not growing: shrink and fall down
            this.bubble.radius = Math.max(
                this.bubble.radius - this.bubble.shrinkRate,
                this.bubble.minRadius
            );
            // Add downward gravity force when shrinking
            this.bubble.velocity.y += this.bubble.gravity;
        }
        
        // Check if bubble has disappeared (too small)
        if (this.bubble.radius <= this.bubble.minRadius) {
            this.bubble.disappeared = true;
            this.gameOver('Bubble disappeared - too small!');
            return;
        }
        
        // Apply velocity to position
        this.bubble.y += this.bubble.velocity.y;
        
        // Air resistance/friction
        this.bubble.velocity.y *= 0.95;
        
        // Bubble boundaries - but allow falling off screen when shrinking
        if (this.bubble.y - this.bubble.radius < 0) {
            this.bubble.y = this.bubble.radius;
            this.bubble.velocity.y = Math.max(0, this.bubble.velocity.y); // Only stop upward movement
        }
        
        // Check if bubble fell off the bottom of screen
        if (this.bubble.y - this.bubble.radius > this.canvas.height) {
            this.gameOver('Bubble fell off the screen!');
            return;
        }
        
        // World scrolling
        this.scrollOffset += this.scrollSpeed;
        
        // Generate new obstacles
        if (this.lastObstacleX - this.scrollOffset < this.canvas.width + 200) {
            this.lastObstacleX += this.obstacleSpacing;
            this.generateObstacleGroup(this.lastObstacleX);
        }
        
        // Remove off-screen obstacles
        this.obstacles = this.obstacles.filter(obs => obs.x - this.scrollOffset > -100);
        this.gaps = this.gaps.filter(gap => gap.x - this.scrollOffset > -100);
        
        // Check collisions
        this.checkCollisions();
        
        // Update score
        this.updateScore();
        
        // Gradually increase difficulty
        this.scrollSpeed = Math.min(this.scrollSpeed + 0.0005, 2.5);
    }
    
    checkCollisions() {
        const bubbleScreenX = this.bubble.x;
        const bubbleY = this.bubble.y;
        const bubbleRadius = this.bubble.radius;
        
        // Check obstacle collisions
        for (let obstacle of this.obstacles) {
            const obstacleScreenX = obstacle.x - this.scrollOffset;
            
            if (bubbleScreenX + bubbleRadius > obstacleScreenX &&
                bubbleScreenX - bubbleRadius < obstacleScreenX + obstacle.width &&
                bubbleY + bubbleRadius > obstacle.y &&
                bubbleY - bubbleRadius < obstacle.y + obstacle.height) {
                this.gameOver('Bubble popped on obstacle!');
                return;
            }
        }
        
        // Check if bubble is too small for gaps (falling through)
        for (let gap of this.gaps) {
            const gapScreenX = gap.x - this.scrollOffset;
            
            if (bubbleScreenX > gapScreenX && bubbleScreenX < gapScreenX + gap.width) {
                const gapTop = gap.y;
                const gapBottom = gap.y + gap.height;
                
                // Check if bubble is in the gap area
                if (bubbleY > gapTop && bubbleY < gapBottom) {
                    // Check if bubble is too small (would fall through)
                    if (bubbleRadius < 20) {
                        this.gameOver('Bubble too small - fell through gap!');
                        return;
                    }
                    
                    // Check if bubble is too big for the gap
                    if (bubbleRadius * 2 > gap.height - 5) {
                        this.gameOver('Bubble too big for gap!');
                        return;
                    }
                }
            }
        }
    }
    
    updateScore() {
        for (let gap of this.gaps) {
            const gapScreenX = gap.x - this.scrollOffset;
            
            if (!gap.passed && gapScreenX + gap.width < this.bubble.x) {
                gap.passed = true;
                this.score += 10;
                this.updateUI();
            }
        }
    }
    
    gameOver(reason) {
        this.gameState = 'gameOver';
        this.bubble.isGrowing = false;
        this.stopInflateSound();
        
        // Play pop sound
        this.createPopSound();
        
        // Update best score
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('fillTheAirBest', this.bestScore);
        }
        
        // Show game over screen
        document.getElementById('finalScore').textContent = `Score: ${this.score}`;
        document.getElementById('gameOverReason').textContent = reason;
        document.getElementById('gameOverScreen').classList.remove('hidden');
        
        this.updateUI();
    }
    
    updateUI() {
        document.getElementById('score').textContent = `Score: ${this.score}`;
        document.getElementById('bestScore').textContent = `Best: ${this.bestScore}`;
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background elements (clouds, etc.)
        this.drawBackground();
        
        // Draw obstacles
        for (let obstacle of this.obstacles) {
            const x = obstacle.x - this.scrollOffset;
            if (x > -obstacle.width && x < this.canvas.width + obstacle.width) {
                this.drawObstacle(obstacle, x);
            }
        }
        
        // Draw gaps (visual indicators)
        for (let gap of this.gaps) {
            const x = gap.x - this.scrollOffset;
            if (x > -gap.width && x < this.canvas.width + gap.width) {
                this.drawGap(gap, x);
            }
        }
        
        // Draw bubble
        this.drawBubble();
        
        // Draw bubble growth indicator
        if (this.bubble.isGrowing && this.gameState === 'playing') {
            this.drawGrowthIndicator();
        }
    }
    
    drawBackground() {
        // Draw some floating particles/bubbles in background
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        
        for (let i = 0; i < 8; i++) {
            const x = (this.scrollOffset * 0.5 + i * 50) % (this.canvas.width + 100) - 50;
            const y = 50 + Math.sin(this.scrollOffset * 0.01 + i) * 20;
            const radius = 3 + Math.sin(this.scrollOffset * 0.02 + i) * 2;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    drawObstacle(obstacle, screenX) {
        this.ctx.save();
        
        // Gradient for obstacles
        const gradient = this.ctx.createLinearGradient(screenX, 0, screenX + obstacle.width, 0);
        if (obstacle.type === 'floating') {
            gradient.addColorStop(0, '#FF6B6B');
            gradient.addColorStop(1, '#FF8E8E');
        } else {
            gradient.addColorStop(0, '#4A4A4A');
            gradient.addColorStop(1, '#6A6A6A');
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(screenX, obstacle.y, obstacle.width, obstacle.height);
        
        // Add some texture
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(screenX, obstacle.y, obstacle.width, obstacle.height);
        
        this.ctx.restore();
    }
    
    drawGap(gap, screenX) {
        // Draw subtle gap indicators
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        // Top and bottom gap boundaries
        this.ctx.beginPath();
        this.ctx.moveTo(screenX, gap.y);
        this.ctx.lineTo(screenX + gap.width, gap.y);
        this.ctx.moveTo(screenX, gap.y + gap.height);
        this.ctx.lineTo(screenX + gap.width, gap.y + gap.height);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawBubble() {
        this.ctx.save();
        
        // Bubble shadow
        this.ctx.beginPath();
        this.ctx.arc(this.bubble.x + 2, this.bubble.y + 2, this.bubble.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fill();
        
        // Main bubble
        const gradient = this.ctx.createRadialGradient(
            this.bubble.x - this.bubble.radius * 0.3,
            this.bubble.y - this.bubble.radius * 0.3,
            0,
            this.bubble.x,
            this.bubble.y,
            this.bubble.radius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.7)');
        gradient.addColorStop(1, 'rgba(200, 200, 255, 0.8)');
        
        this.ctx.beginPath();
        this.ctx.arc(this.bubble.x, this.bubble.y, this.bubble.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Bubble highlight
        this.ctx.beginPath();
        this.ctx.arc(
            this.bubble.x - this.bubble.radius * 0.4,
            this.bubble.y - this.bubble.radius * 0.4,
            this.bubble.radius * 0.3,
            0,
            Math.PI * 2
        );
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.fill();
        
        // Bubble outline
        this.ctx.beginPath();
        this.ctx.arc(this.bubble.x, this.bubble.y, this.bubble.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawGrowthIndicator() {
        // Pulsing ring around bubble when growing
        this.ctx.save();
        this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
        this.ctx.beginPath();
        this.ctx.arc(this.bubble.x, this.bubble.y, this.bubble.radius + 5, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        this.ctx.restore();
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Game();
});