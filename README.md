# Fill The Air - Mobile Game

A cross-platform bubble floating game built with HTML5/JavaScript for iOS and Android devices.

## Game Concept

**Fill The Air** is a unique mobile game that combines elements of Flappy Bird, Hole.io, and zen balloon simulators. Players control a floating bubble that can grow and shrink while navigating through a scrolling world filled with obstacles and gaps.

### Gameplay Mechanics

- **Hold anywhere on screen** → Bubble inflates smoothly
- **Release** → Bubble stops growing and drifts with physics
- **Goal**: Navigate through gaps by sizing your bubble perfectly:
  - Grow big enough to avoid falling through gaps
  - Stay small enough to fit through tight spaces
  - Avoid touching any obstacles

### Lose Conditions

1. **Pop**: Bubble touches any obstacle → Game Over
2. **Fall**: Bubble becomes too small and falls through a gap → Game Over  
3. **Stuck**: Bubble grows too large for the available space → Game Over

## Technical Features

### Cross-Platform Mobile Support
- **Responsive Design**: Works on all screen sizes and orientations
- **Touch Controls**: Optimized for mobile touch input
- **PWA Ready**: Can be installed as a native app
- **Performance Optimized**: Smooth 60fps gameplay

### Game Features
- Smooth bubble physics with realistic growth animation
- Procedurally generated obstacles and gaps
- Progressive difficulty scaling
- Score tracking with local storage
- Satisfying visual feedback and particle effects
- Mobile-optimized UI and controls

## Getting Started

### Quick Start
1. Open `index.html` in any modern web browser
2. The game works immediately on desktop and mobile devices
3. For mobile: Add to home screen for native app experience

### Mobile App Deployment
To deploy as a native mobile app, you can use:

#### Option 1: Capacitor (Recommended)
```bash
npm install -g @capacitor/cli @capacitor/core
npm init -y
npm install @capacitor/ios @capacitor/android

# Initialize Capacitor
npx cap init "Fill The Air" "com.yourcompany.filltheair"

# Add platforms
npx cap add ios
npx cap add android

# Copy web assets and sync
npx cap copy
npx cap sync

# Open in native IDEs
npx cap open ios     # Opens Xcode
npx cap open android # Opens Android Studio
```

#### Option 2: Cordova
```bash
npm install -g cordova

# Create Cordova project
cordova create FillTheAir com.yourcompany.filltheair "Fill The Air"
cd FillTheAir

# Copy game files to www folder
# Copy index.html, styles.css, game.js, manifest.json to www/

# Add platforms
cordova platform add ios
cordova platform add android

# Build
cordova build ios
cordova build android
```

### File Structure
```
myGame/
├── index.html          # Main HTML file
├── styles.css          # Mobile-optimized CSS
├── game.js            # Complete game logic
├── manifest.json      # PWA manifest
└── README.md          # This file
```

## Game Architecture

### Core Classes
- **Game**: Main game controller handling state, physics, and rendering
- **Bubble**: Player-controlled floating bubble with growth mechanics
- **World Generation**: Procedural obstacle and gap creation
- **Physics**: Realistic bubble movement with gravity and drift

### Mobile Optimizations
- Touch event handling for all mobile browsers
- Responsive canvas sizing for all screen ratios
- Optimized particle system for smooth performance
- Battery-efficient rendering loop

### Performance Features
- Efficient object pooling for obstacles
- Optimized collision detection
- Smooth 60fps animations
- Minimal memory usage

## Customization

### Adjusting Difficulty
In `game.js`, modify these values:
- `scrollSpeed`: Base world scrolling speed
- `obstacleSpacing`: Distance between obstacle groups
- `bubble.growthRate`: How fast bubble grows
- `bubble.maxRadius`: Maximum bubble size

### Visual Customization
In `styles.css`:
- Modify color gradients for different themes
- Adjust bubble appearance and effects
- Change UI styling and layout

### Adding Features
The codebase is modular and easy to extend:
- Add power-ups in the world generation
- Implement different bubble types
- Add sound effects and music
- Create new obstacle types

## Browser Compatibility

- **iOS Safari**: Full support
- **Android Chrome**: Full support
- **Mobile Firefox**: Full support
- **Desktop browsers**: Full support for testing

## Publishing to App Stores

### iOS App Store (via Capacitor/Cordova)
1. Build the iOS version
2. Test on physical devices
3. Submit through Xcode and App Store Connect

### Google Play Store (via Capacitor/Cordova)
1. Build signed Android APK
2. Test on various Android devices
3. Submit through Google Play Console

### Progressive Web App (PWA)
- The game includes a manifest.json for PWA installation
- Users can "Add to Home Screen" for native-like experience
- No app store approval needed

## License

This game template is provided as-is for educational and commercial use.

---

**Ready to play!** Open `index.html` in your browser or deploy to mobile devices for the full experience.