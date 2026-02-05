# three-troika-ui

Three.js UI library based on troika-three-text. A lightweight, pure Three.js UI system without Canvas2D dependency.

## Features

- **UICamera**: Dedicated OrthographicCamera for UI rendering with game camera composition
- **UIText**: Text rendering using troika-three-text (supports Korean, emoji, etc.)
- **UIBox**: Background boxes with rounded corners and borders
- **UIImage**: Image/icon display with texture caching
- **UIProgressBar**: Progress bar with customizable colors
- **UIShaderBar**: Advanced shader-based health bar with delayed gauge, shield, dissolve effects
- **UIPanel**: Layout container with flexbox-like positioning
- **UITooltip**: Multi-line tooltip with auto-positioning
- **UIButton**: Interactive button with hover/press states
- **UISlider**: Draggable slider with value display
- **UICheckbox**: Checkbox with label
- **UIToggle**: Animated toggle switch
- **UIScrollView**: Scrollable content container with stencil masking
- **UIFloatingText**: Animated floating text (damage numbers, etc.)

## Installation

```bash
npm install three-troika-ui
# or
bun add three-troika-ui
```

## Peer Dependencies

- `three` >= 0.150.0
- `troika-three-text` >= 0.50.0

## Usage

### Basic Setup with UICamera

```typescript
import { Scene, WebGLRenderer } from 'three';
import { UICamera, UIPanel, UIText } from 'three-troika-ui';

// Create separate UI scene
const uiScene = new Scene();

// Create UI camera (OrthographicCamera)
const uiCamera = new UICamera({
  viewWidth: 20,
  viewHeight: 15,
});
uiCamera.resize(window.innerWidth, window.innerHeight);

// Add UI elements to uiScene
const panel = new UIPanel({ /* ... */ });
uiScene.add(panel);

// In render loop: render game first, then UI on top
function render() {
  renderer.render(gameScene, gameCamera);
  uiCamera.render(renderer, uiScene); // Composites UI on top
}
```

### Creating UI Elements

```typescript
import { UIPanel, UIText, UIProgressBar, UIBox } from 'three-troika-ui';

// Create a panel with layout
const panel = new UIPanel({
  width: 2,
  height: 1,
  backgroundColor: 0x222222,
  backgroundOpacity: 0.9,
  borderRadius: 0.05,
  padding: 0.1,
  gap: 0.05,
  direction: 'vertical',
});

// Add text
const title = new UIText({
  text: 'Hello World',
  fontSize: 0.1,
  color: 0xffffff,
});
panel.addChild(title);

// Add progress bar
const hpBar = new UIProgressBar({
  width: 1.5,
  height: 0.1,
  value: 0.75,
  fillColor: 0x00ff00,
  backgroundColor: 0x333333,
  borderRadius: 0.02,
});
panel.addChild(hpBar);

// Add to UI scene
uiScene.add(panel);
```

### Interactive Widgets

```typescript
import { UIButton, UISlider, UICheckbox, UIToggle } from 'three-troika-ui';

// Button
const button = new UIButton({
  width: 2,
  height: 0.5,
  text: 'Click Me',
  backgroundColor: 0x3498db,
  hoverColor: 0x2980b9,
  pressColor: 0x1abc9c,
  onClick: () => console.log('Clicked!'),
});

// Slider
const slider = new UISlider({
  width: 3,
  height: 0.3,
  min: 0,
  max: 100,
  value: 50,
  showValue: true,
  onChange: (value) => console.log('Value:', value),
});

// Checkbox
const checkbox = new UICheckbox({
  size: 0.3,
  label: 'Enable Feature',
  checked: false,
  onChange: (checked) => console.log('Checked:', checked),
});

// Toggle
const toggle = new UIToggle({
  width: 0.8,
  height: 0.4,
  value: false,
  onChange: (value) => console.log('Toggled:', value),
});
```

### Raycasting for Interaction

```typescript
import { Raycaster, Vector2 } from 'three';

const raycaster = new Raycaster();
const mouse = new Vector2();

function onClick(event: MouseEvent) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Use UI camera for raycasting
  raycaster.setFromCamera(mouse, uiCamera.camera);

  const meshes = button.getInteractiveMeshes();
  const intersects = raycaster.intersectObjects(meshes, true);

  if (intersects.length > 0) {
    button.click();
  }
}

function onMouseMove(event: MouseEvent) {
  // ... similar setup ...

  // Convert screen to UI world coordinates
  const worldPos = uiCamera.ndcToWorld(mouse.x, mouse.y);

  // Check hover states
  const intersects = raycaster.intersectObjects(meshes, true);
  button.setHovered(intersects.length > 0);
}
```

## API

### UICamera

Dedicated OrthographicCamera for UI rendering, composited on top of game rendering.

```typescript
const uiCamera = new UICamera({
  viewWidth: 20,      // UI world units width
  viewHeight: 15,     // UI world units height
  near: 0.1,          // Near clipping plane
  far: 100,           // Far clipping plane
});
```

- `setPosition(x, y)`: Set camera position (for syncing with game camera)
- `getViewSize()`: Get view dimensions `{ width, height }`
- `resize(screenWidth, screenHeight)`: Handle window resize
- `render(renderer, uiScene)`: Render UI scene on top of existing frame
- `screenToWorld(screenX, screenY, screenWidth, screenHeight)`: Convert screen to world coordinates
- `ndcToWorld(ndcX, ndcY)`: Convert NDC (-1 to 1) to world coordinates

### UIElement (Base Class)

All UI components extend this base class.

- `setSize(width, height)`: Set element size
- `setAnchor(x, y)`: Set anchor point (0-1)
- `update(deltaTime)`: Update element
- `dispose()`: Clean up resources
- `getInteractiveMeshes()`: Get meshes for raycasting

### UIText

- `setText(text)`: Set text content
- `setColor(color)`: Set text color
- `setFontSize(size)`: Set font size
- `setMaxWidth(width)`: Set max width for word wrapping
- `setOutline(width, color)`: Set text outline
- `setAlign(anchorX, anchorY)`: Set text alignment

### UIBox

- `setColor(color)`: Set background color
- `setOpacity(opacity)`: Set transparency
- `setBorder(width, color)`: Set border
- `setBorderRadius(radius)`: Set corner radius
- `setHoverColor(color)`: Set hover state color
- `setHovered(hovered)`: Set hover state

### UIImage

- `setTexture(texture)`: Set texture (URL or THREE.Texture)
- `setColor(color)`: Set tint color
- `setOpacity(opacity)`: Set transparency

### UIProgressBar

- `setValue(value)`: Set progress (0-1)
- `getValue()`: Get current value
- `setFillColor(color)`: Set fill color
- `setBackgroundColor(color)`: Set background color

### UIShaderBar

Advanced shader-based progress bar with delayed gauge animations, shield system, and visual effects. Perfect for boss health bars, stamina bars, or any gauge that needs smooth delayed decrease/increase animations.

**Features:**
- Delayed decrease animation (yellow "damage trail" effect)
- Shield gauge with delayed fill animation
- Noise edge effects
- Low health pulse effect
- Shine/gloss effect
- Dissolve death effect

```typescript
import { UIShaderBar } from 'three-troika-ui';

const healthBar = new UIShaderBar({
  width: 4,
  height: 0.3,
  value: 1,           // Initial health (0-1)
  shieldValue: 0,     // Initial shield

  // Colors (Dark Souls style)
  backgroundColor: 0x1a1a1e,
  fillColor: 0xb31a1a,        // Main health color (red)
  delayColor: 0xe6b319,       // Delayed gauge color (yellow)
  shieldColor: 0x1a80e6,      // Shield color (blue)
  shieldDelayColor: 0x99ccff, // Shield delay color
  lowHealthColor: 0x660d0d,   // Color when health is low
  dissolveEdgeColor: 0xff4d1a,

  // Behavior
  lowHealthThreshold: 0.3,    // Pulse effect below this
  delayWait: 0.3,             // Delay before trail starts
  delaySpeed: 1.0,            // Trail speed (1.0 = 1 second for full bar)
  shieldFillSpeed: 0.3,       // Shield fill speed

  // Effects toggle
  enableNoise: true,          // Noisy edge effect
  enablePulse: true,          // Low health pulse
  enableShine: true,          // Gloss effect
  enableDissolve: true,       // Dissolve capability
});

// In game loop
function update(deltaTime: number) {
  healthBar.update(deltaTime); // Required for animations
}

// Set health (0-1)
healthBar.setValue(0.5);

// Set shield (current value, max value)
// When max changes, shield fills from 0 with animation
healthBar.setShield(100, 200);

// Start dissolve effect (for death)
healthBar.startDissolve(1.5); // speed parameter

// Reset all state
healthBar.reset();

// Color customization
healthBar.setFillColor(0x00ff00);    // Change to green
healthBar.setShieldColor(0xff00ff);  // Change shield to purple
healthBar.setOpacity(0.8);           // Set transparency
```

**Shield Behavior:**
- When `max` parameter changes in `setShield()`, it's treated as a new shield phase
- Shield gauge fills from 0 with smooth animation
- During shield fill, damage shows delayed decrease from current displayed value
- Shield decrease shows delayed trail effect

### UIPanel

- `addChild(element)`: Add child element
- `removeChild(element)`: Remove child element
- `clearChildren()`: Remove all children
- `setDirection('horizontal' | 'vertical')`: Set layout direction
- `setAlign('start' | 'center' | 'end')`: Set cross-axis alignment
- `setJustify('start' | 'center' | 'end' | 'space-between' | 'space-around')`: Set main-axis alignment
- `setGap(gap)`: Set spacing between children
- `setPadding(padding)`: Set padding
- `setBackgroundColor(color)`: Set background color
- `setBorder(width, color)`: Set border

### UIButton

- `setText(text)`: Set button text
- `setEnabled(enabled)`: Enable/disable button
- `setHovered(hovered)`: Set hover state
- `click()`: Trigger click programmatically
- `getInteractiveMeshes()`: Get meshes for raycasting

### UISlider

- `setValue(value)`: Set slider value
- `getValue()`: Get current value
- `setMin(min)`: Set minimum value
- `setMax(max)`: Set maximum value
- `setHovered(hovered)`: Set hover state
- `startDrag()`: Begin drag operation
- `endDrag()`: End drag operation
- `setValueFromLocalX(localX)`: Set value from local x coordinate
- `getTrack()`: Get track mesh for raycasting
- `getHandle()`: Get handle mesh for raycasting

### UICheckbox

- `setChecked(checked)`: Set checked state
- `isChecked()`: Get checked state
- `toggle()`: Toggle checked state
- `setHovered(hovered)`: Set hover state

### UIToggle

- `setValue(value)`: Set toggle state
- `getValue()`: Get toggle state
- `toggle()`: Toggle state
- `update(deltaTime)`: Update animation

### UITooltip

- `setContent(lines)`: Set tooltip content (array of `TooltipLine`)
- `setText(text, color?)`: Set single-line text
- `setBorderColor(color)`: Set border color
- `setAnchorPosition(x, y)`: Set anchor position for auto-positioning
- `setViewBounds(width, height)`: Set view bounds for auto-positioning
- `show()`: Show tooltip
- `hide()`: Hide tooltip

### UIScrollView

- `setContent(content)`: Set scrollable content
- `scroll(amount)`: Scroll by amount
- `setScrollPosition(position)`: Set scroll position (0-1)
- `getScrollPosition()`: Get current scroll position

### UIFloatingText

- `setText(text)`: Set text content
- `setColor(color)`: Set text color
- `start()`: Start float animation
- `update(deltaTime)`: Update animation

## Architecture

### Separate Camera System

The library uses a dedicated `UICamera` (OrthographicCamera) separate from the game camera. This provides several benefits:

1. **No z-fighting**: UI elements don't compete with game objects for depth
2. **Consistent sizing**: UI elements maintain consistent size regardless of game camera settings
3. **Simplified positioning**: UI uses fixed world coordinates without following the game camera
4. **Clean composition**: UI is rendered on top of the game frame

### Rendering Pipeline

```
1. Clear buffers
2. Render game scene with PerspectiveCamera
3. Clear depth buffer only
4. Render UI scene with OrthographicCamera (composited on top)
```

## License

MIT
