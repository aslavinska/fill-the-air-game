class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.setupAudio();
        
        // Load background image
        this.backgroundImage = new Image();
        this.backgroundImage.src = '644f43a4-fff8-4b83-9fb9-5d7ef451bfa4.png';
        this.backgroundLoaded = false;
        this.backgroundImage.onload = () => {
            this.backgroundLoaded = true;
            console.log('Background image loaded successfully');
        };
        this.backgroundImage.onerror = () => {
            console.log('Failed to load background image, using fallback');
        };
        
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
            growthRate: 0.9,
            shrinkRate: 0.5,
            velocity: { x: 0, y: 0 },
            color: 'rgba(255, 255, 255, 0.9)',
            buoyancy: 0.4, // Upward force when growing
            gravity: 0.3,  // Downward force when shrinking
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
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                    this.createSounds();
                } catch (e) {
                    console.log('Audio not supported:', e);
                }
            } else if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
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
            oscillator.frequency.setValueAtTime(120, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.2);
            
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            filter.Q.value = 0.5;
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.03, this.audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.03, this.audioContext.currentTime + 0.2);
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            return { oscillator, gainNode };
        };
        
        // Create tap sound (soft chime)
        this.createTapSound = () => {
            if (!this.audioContext || this.audioContext.state !== 'running') return;
            
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(330, this.audioContext.currentTime + 0.12);
                
                filter.type = 'lowpass';
                filter.frequency.value = 800;
                filter.Q.value = 0.7;
                
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.05, this.audioContext.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.12);
                
                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.12);
            } catch (e) {
                console.log('Tap sound error:', e);
            }
        };
        
        // Create pop sound (gentle bubble burst)
        this.createPopSound = () => {
            if (!this.audioContext || this.audioContext.state !== 'running') return;
            
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 0.2);
                
                filter.type = 'lowpass';
                filter.frequency.value = 250;
                filter.Q.value = 1.5;
                
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.08, this.audioContext.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
                
                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.2);
            } catch (e) {
                console.log('Pop sound error:', e);
            }
        };
    }
    
    startInflateSound() {
        if (!this.isInflating && this.audioContext && this.audioContext.state === 'running') {
            this.isInflating = true;
            
            // Create a single, continuous oscillator
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(120, this.audioContext.currentTime);
                
                filter.type = 'lowpass';
                filter.frequency.value = 400;
                filter.Q.value = 0.5;
                
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.02, this.audioContext.currentTime + 0.1);
                
                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                this.currentInflateSound = { oscillator, gainNode };
                oscillator.start();
            } catch (e) {
                console.log('Audio error:', e);
                this.isInflating = false;
            }
        }
    }
    
    stopInflateSound() {
        if (this.isInflating && this.currentInflateSound && this.audioContext) {
            this.isInflating = false;
            try {
                const fadeTime = this.audioContext.currentTime + 0.15;
                this.currentInflateSound.gainNode.gain.linearRampToValueAtTime(0, fadeTime);
                this.currentInflateSound.oscillator.stop(fadeTime);
            } catch (e) {
                // Oscillator may have already stopped
            }
            this.currentInflateSound = null;
        }
    }
    
    setupEventListeners() {
        // Wait a bit for DOM to be fully ready
        setTimeout(() => {
            const startBtn = document.getElementById('startBtn');
            const restartBtn = document.getElementById('restartBtn');
            
            console.log('Setting up event listeners...');
            console.log('Start button found:', !!startBtn);
            console.log('Restart button found:', !!restartBtn);
            
            if (startBtn) {
                startBtn.onclick = () => {
                    console.log('Start button clicked');
                    try {
                        this.initAudioContext();
                        this.startGame();
                    } catch (error) {
                        console.error('Error starting game:', error);
                    }
                };
            }
            
            if (restartBtn) {
                restartBtn.onclick = () => {
                    console.log('Restart button clicked');
                    try {
                        this.initAudioContext();
                        this.startGame();
                    } catch (error) {
                        console.error('Error restarting game:', error);
                    }
                };
            }
        }, 100);
        
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
        console.log('Starting game...');
        this.gameState = 'playing';
        this.score = 0;
        this.scrollOffset = 0;
        this.scrollSpeed = 0.8;
        
        // Clean up any existing sounds
        this.stopInflateSound();
        
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
        // SUPER SIMPLE AND BULLETPROOF - no complex patterns that can fail
        
        // Fixed safe gap size - bigger than max bubble (80px) with safety margin
        const gapSize = 200 + Math.random() * 100; // 200-300px gap (always safe)
        
        // Simple obstacle properties
        const obstacleWidth = 30; // Fixed width to avoid complications
        const minObstacleHeight = 50; // Minimum height for obstacles
        
        // Calculate available space for gap positioning
        const totalObstacleSpace = this.canvas.height - gapSize;
        const maxTopHeight = totalObstacleSpace - minObstacleHeight;
        
        // Position gap randomly but ensure minimum obstacle sizes
        const topHeight = minObstacleHeight + Math.random() * (maxTopHeight - minObstacleHeight);
        const gapStart = topHeight;
        const gapEnd = gapStart + gapSize;
        const bottomHeight = this.canvas.height - gapEnd;
        
        // Choose pattern for visual variety only (doesn't affect gap safety)
        const patterns = ['high', 'middle', 'low', 'wide', 'narrow'];
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        
        // ALWAYS CREATE TOP OBSTACLE
        this.obstacles.push({
            x: x,
            y: 0,
            width: obstacleWidth,
            height: topHeight,
            type: 'obstacle',
            pattern: pattern
        });
        
        // ALWAYS CREATE BOTTOM OBSTACLE  
        this.obstacles.push({
            x: x,
            y: gapEnd,
            width: obstacleWidth,
            height: bottomHeight,
            type: 'obstacle',
            pattern: pattern
        });
        
        // ALWAYS CREATE GAP INFO
        this.gaps.push({
            x: x,
            y: gapStart,
            width: obstacleWidth,
            height: gapSize,
            passed: false,
            pattern: pattern
        });
        
        // Simple debug logging
        console.log(`✅ Safe obstacle at x=${x}: gap=${Math.round(gapSize)}px from y=${Math.round(gapStart)} to y=${Math.round(gapEnd)}, top=${Math.round(topHeight)}, bottom=${Math.round(bottomHeight)}`);
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
            // Strong upward buoyancy force when growing
            this.bubble.velocity.y -= this.bubble.buoyancy;
            // Extra lift for bigger bubbles
            const sizeFactor = this.bubble.radius / 30;
            this.bubble.velocity.y -= sizeFactor * 0.3;
        } else {
            // Not growing: shrink and fall down
            this.bubble.radius = Math.max(
                this.bubble.radius - this.bubble.shrinkRate,
                this.bubble.minRadius
            );
            // Strong downward gravity force when shrinking
            this.bubble.velocity.y += this.bubble.gravity;
            // Extra weight for smaller bubbles
            const smallnessFactor = (30 - this.bubble.radius) / 30;
            this.bubble.velocity.y += smallnessFactor * 0.4;
        }
        
        // Don't let bubble get smaller than minimum, but don't end game
        if (this.bubble.radius < this.bubble.minRadius) {
            this.bubble.radius = this.bubble.minRadius;
        }
        
        // Cap velocity to prevent too crazy speeds
        this.bubble.velocity.y = Math.max(-5, Math.min(5, this.bubble.velocity.y));
        
        // Apply velocity to position
        this.bubble.y += this.bubble.velocity.y;
        
        // Less air resistance for more responsive movement
        this.bubble.velocity.y *= 0.92;
        
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
        this.scrollSpeed = Math.min(this.scrollSpeed + 0.0003, 1.5);
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
                    if (bubbleRadius < 12) {
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
        this.ctx.save();
        
        // Draw background image if loaded
        if (this.backgroundLoaded) {
            // Calculate scaling to maintain aspect ratio while covering the canvas
            const canvasAspect = this.canvas.width / this.canvas.height;
            const imageAspect = this.backgroundImage.width / this.backgroundImage.height;
            
            let drawWidth, drawHeight, offsetX, offsetY;
            
            if (canvasAspect > imageAspect) {
                // Canvas is wider - scale to fit width, crop height
                drawWidth = this.canvas.width;
                drawHeight = this.canvas.width / imageAspect;
                offsetX = 0;
                offsetY = (this.canvas.height - drawHeight) / 2;
            } else {
                // Canvas is taller - scale to fit height, crop width
                drawWidth = this.canvas.height * imageAspect;
                drawHeight = this.canvas.height;
                offsetX = (this.canvas.width - drawWidth) / 2;
                offsetY = 0;
            }
            
            // Draw the background image with proper scaling and cropping
            this.ctx.drawImage(this.backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
        } else {
            // Fallback gradient background
            const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
            gradient.addColorStop(0, '#87CEEB');
            gradient.addColorStop(1, '#E0F6FF');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw ground grass at bottom (over the background)
        this.ctx.globalAlpha = 0.6;
        const groundY = this.canvas.height - 40;
        
        // Grass base
        const grassGradient = this.ctx.createLinearGradient(0, groundY, 0, this.canvas.height);
        grassGradient.addColorStop(0, 'rgba(144, 238, 144, 0.8)');
        grassGradient.addColorStop(1, 'rgba(107, 142, 35, 0.9)');
        
        this.ctx.fillStyle = grassGradient;
        this.ctx.fillRect(0, groundY, this.canvas.width, 40);
        
        // Individual grass blades
        this.ctx.strokeStyle = 'rgba(107, 142, 35, 0.7)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x < this.canvas.width; x += 4) {
            const bladeHeight = 8 + Math.sin((x + this.scrollOffset * 0.1) * 0.1) * 4;
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.canvas.height);
            this.ctx.lineTo(x + Math.sin(x * 0.2) * 2, this.canvas.height - bladeHeight);
            this.ctx.stroke();
        }
        
        // Add mushrooms scattered around
        this.ctx.globalAlpha = 0.8;
        for (let i = 0; i < 8; i++) {
            const mushroomX = (this.scrollOffset * 0.1 + i * 60) % (this.canvas.width + 100) - 50;
            const mushroomY = this.canvas.height - 25;
            
            if (mushroomX > -20 && mushroomX < this.canvas.width + 20) {
                // Mushroom stem
                this.ctx.fillStyle = 'rgba(245, 245, 220, 0.9)';
                this.ctx.fillRect(mushroomX - 2, mushroomY, 4, 12);
                
                // Mushroom cap (alternating red and white)
                if (i % 2 === 0) {
                    // Red mushroom with white spots
                    this.ctx.fillStyle = 'rgba(220, 20, 60, 0.9)';
                    this.ctx.beginPath();
                    this.ctx.arc(mushroomX, mushroomY, 6, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // White spots
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    this.ctx.beginPath();
                    this.ctx.arc(mushroomX - 2, mushroomY - 1, 1.5, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.beginPath();
                    this.ctx.arc(mushroomX + 3, mushroomY + 1, 1, 0, Math.PI * 2);
                    this.ctx.fill();
                } else {
                    // White mushroom
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    this.ctx.beginPath();
                    this.ctx.arc(mushroomX, mushroomY, 5, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Light gray spots
                    this.ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
                    this.ctx.beginPath();
                    this.ctx.arc(mushroomX - 1, mushroomY, 1, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
        
        // Add floating dandelion seeds (keep these, they're nice)
        this.ctx.globalAlpha = 0.3;
        for (let i = 0; i < 12; i++) {
            const x = (this.scrollOffset * 0.15 + i * 40) % (this.canvas.width + 100) - 50;
            const y = 60 + Math.sin(this.scrollOffset * 0.008 + i) * 50;
            
            // Dandelion seed
            if (i % 3 === 0) {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x - 1, y - 3);
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + 1, y - 3);
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x, y - 4);
                this.ctx.stroke();
                
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                this.ctx.beginPath();
                this.ctx.arc(x, y - 2, 1, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        this.ctx.restore();
    }
    
    drawObstacle(obstacle, screenX) {
        this.ctx.save();
        
        if (obstacle.type === 'floating') {
            // Floating obstacles with pattern-based colors
            let color1, color2;
            switch(obstacle.pattern) {
                case 'high':
                    color1 = '#87CEEB'; color2 = '#4169E1'; // Sky blue theme
                    break;
                case 'low':
                    color1 = '#DDA0DD'; color2 = '#9370DB'; // Purple theme
                    break;
                case 'narrow':
                    color1 = '#FF6347'; color2 = '#DC143C'; // Red theme
                    break;
                case 'wide':
                    color1 = '#98FB98'; color2 = '#32CD32'; // Green theme
                    break;
                default:
                    color1 = '#FFB6C1'; color2 = '#FF69B4'; // Pink theme
            }
            
            const gradient = this.ctx.createRadialGradient(
                screenX + obstacle.width/2, obstacle.y + obstacle.height/2, 0,
                screenX + obstacle.width/2, obstacle.y + obstacle.height/2, obstacle.width/2
            );
            gradient.addColorStop(0, color1);
            gradient.addColorStop(1, color2);
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.roundRect(screenX, obstacle.y, obstacle.width, obstacle.height, 15);
            this.ctx.fill();
        } else {
            // Draw stone platforms with pattern-based variations
            this.drawBrickPlatform(screenX, obstacle.y, obstacle.width, obstacle.height, obstacle.pattern);
        }
        
        this.ctx.restore();
    }
    
    drawBrickPlatform(x, y, width, height, pattern = 'middle') {
        // Different stone colors based on pattern
        let colors;
        switch(pattern) {
            case 'high':
                colors = ['#E6E6FA', '#D8BFD8', '#DDA0DD', '#9370DB']; // Light purple stones
                break;
            case 'low':
                colors = ['#F5DEB3', '#DEB887', '#CD853F', '#A0522D']; // Wheat/brown stones
                break;
            case 'narrow':
                colors = ['#FFE4E1', '#FFC0CB', '#FFB6C1', '#FF69B4']; // Pink stones
                break;
            case 'wide':
                colors = ['#F0FFF0', '#E0FFE0', '#98FB98', '#90EE90']; // Light green stones
                break;
            default: // middle
                colors = ['#D2B48C', '#C19A6B', '#A0866B', '#8B7355']; // Classic tan stones
        }
        
        // Base stone gradient with pattern colors
        const stoneGradient = this.ctx.createLinearGradient(x, y, x, y + height);
        stoneGradient.addColorStop(0, colors[0]);    // Lightest
        stoneGradient.addColorStop(0.3, colors[1]);  // Medium light
        stoneGradient.addColorStop(0.7, colors[2]);  // Medium dark
        stoneGradient.addColorStop(1, colors[3]);    // Darkest
        
        // Draw rounded stone base
        this.ctx.fillStyle = stoneGradient;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.fill();
        
        // Add stone texture with individual bricks
        this.drawBrickTexture(x, y, width, height);
        
        // Add moss/grass on top surfaces
        if (y > 0) { // Only add grass if it's a top surface
            this.drawGrass(x, y, width);
        }
        
        // Add depth shading with pattern-based color
        const darkColor = colors[3]; // Use the darkest color from the pattern
        // Convert hex to rgba properly
        let strokeColor;
        if (darkColor.startsWith('#')) {
            // Convert hex to rgba
            const r = parseInt(darkColor.slice(1, 3), 16);
            const g = parseInt(darkColor.slice(3, 5), 16);
            const b = parseInt(darkColor.slice(5, 7), 16);
            strokeColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
        } else {
            // Already in rgb/rgba format, just use it
            strokeColor = darkColor;
        }
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 8);
        this.ctx.stroke();
        
        // Light highlight on top edge
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 8, y + 1);
        this.ctx.lineTo(x + width - 8, y + 1);
        this.ctx.stroke();
    }
    
    drawBrickTexture(x, y, width, height) {
        this.ctx.strokeStyle = 'rgba(139, 115, 85, 0.4)';
        this.ctx.lineWidth = 0.5;
        
        // Draw horizontal brick lines
        const brickHeight = 12;
        for (let bY = y + brickHeight; bY < y + height - 4; bY += brickHeight) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + 2, bY);
            this.ctx.lineTo(x + width - 2, bY);
            this.ctx.stroke();
        }
        
        // Draw vertical brick separations (staggered)
        const brickWidth = 20;
        let row = 0;
        for (let bY = y; bY < y + height - 4; bY += brickHeight) {
            const offset = (row % 2) * (brickWidth / 2);
            for (let bX = x + offset; bX < x + width; bX += brickWidth) {
                if (bX > x + 2 && bX < x + width - 2) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(bX, bY);
                    this.ctx.lineTo(bX, Math.min(bY + brickHeight, y + height - 4));
                    this.ctx.stroke();
                }
            }
            row++;
        }
        
        // Add some random stone texture spots
        for (let i = 0; i < width / 15; i++) {
            const spotX = x + 5 + Math.random() * (width - 10);
            const spotY = y + 5 + Math.random() * (height - 10);
            const spotSize = 2 + Math.random() * 3;
            
            this.ctx.fillStyle = 'rgba(160, 134, 107, 0.6)';
            this.ctx.beginPath();
            this.ctx.arc(spotX, spotY, spotSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawGrass(x, y, width) {
        // Much more lush grass base layer
        const grassGradient = this.ctx.createLinearGradient(x, y - 12, x, y + 4);
        grassGradient.addColorStop(0, 'rgba(144, 238, 144, 0.95)');
        grassGradient.addColorStop(0.3, 'rgba(124, 252, 0, 0.9)');
        grassGradient.addColorStop(0.7, 'rgba(107, 142, 35, 0.85)');
        grassGradient.addColorStop(1, 'rgba(85, 107, 47, 0.7)');
        
        this.ctx.fillStyle = grassGradient;
        
        // Draw thicker, more organic grass shape
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        
        // Create more varied wavy grass top
        for (let gX = x; gX <= x + width; gX += 2) {
            const grassHeight = 6 + Math.sin((gX - x) * 0.2 + this.scrollOffset * 0.01) * 3
                              + Math.cos((gX - x) * 0.4 + this.scrollOffset * 0.015) * 2;
            this.ctx.lineTo(gX, y - grassHeight);
        }
        
        this.ctx.lineTo(x + width, y);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Add many more individual grass blades
        this.ctx.strokeStyle = 'rgba(107, 142, 35, 0.8)';
        this.ctx.lineWidth = 1.5;
        
        for (let i = 0; i < width / 3; i++) {
            const bladeX = x + 2 + i * 3 + Math.random() * 3;
            const bladeHeight = 4 + Math.random() * 6;
            
            this.ctx.beginPath();
            this.ctx.moveTo(bladeX, y);
            this.ctx.lineTo(bladeX + (Math.random() - 0.5) * 3, y - bladeHeight);
            this.ctx.stroke();
        }
        
        // Add small mushrooms on grass occasionally
        if (Math.random() < 0.4 && width > 20) {
            const mushroomX = x + 8 + Math.random() * (width - 16);
            const mushroomY = y - 2;
            
            // Tiny mushroom stem
            this.ctx.fillStyle = 'rgba(245, 245, 220, 0.9)';
            this.ctx.fillRect(mushroomX - 1, mushroomY, 2, 4);
            
            // Tiny mushroom cap
            this.ctx.fillStyle = Math.random() < 0.5 ? 'rgba(220, 20, 60, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            this.ctx.beginPath();
            this.ctx.arc(mushroomX, mushroomY, 2.5, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Tiny spot
            if (Math.random() < 0.7) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.beginPath();
                this.ctx.arc(mushroomX - 0.5, mushroomY - 0.5, 0.8, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // Add more flowers
        if (Math.random() < 0.5) {
            const flowerX = x + 5 + Math.random() * (width - 10);
            const flowerY = y - 4;
            
            // Flower colors - white, yellow, or pink
            const colors = ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 0, 0.9)', 'rgba(255, 192, 203, 0.9)'];
            this.ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            
            this.ctx.beginPath();
            this.ctx.arc(flowerX, flowerY, 1.5, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Flower center
            this.ctx.fillStyle = 'rgba(255, 223, 0, 0.9)';
            this.ctx.beginPath();
            this.ctx.arc(flowerX, flowerY, 0.6, 0, Math.PI * 2);
            this.ctx.fill();
        }
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
    console.log('DOM loaded, initializing game...');
    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    console.log('Start button found:', !!startBtn);
    console.log('Restart button found:', !!restartBtn);
    
    new Game();
});