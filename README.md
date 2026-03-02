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
- **UICircularGauge**: Circular progress gauge with icon, borders, glow effects (skill cooldowns, etc.)

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

### UICircularGauge

Circular gauge UI component for skill cooldowns, ability charges, and other radial progress indicators.

**Features:**
- Circular progress ring with customizable colors
- Center icon with background
- Inner and outer border rings for depth
- Ready state glow and pulse animation
- Sweep animation when gauge completes
- Key hint label (Q, E, etc.)
- Tooltip support
- Cooldown overlay effect

```typescript
import { UICircularGauge } from 'three-troika-ui';

const skillGauge = new UICircularGauge({
  size: 1.5,
  innerRadius: 0.4,      // Icon area radius
  outerRadius: 0.55,     // Gauge outer edge

  // Colors
  backgroundColor: 0x333333,
  fillColor: 0x3498db,        // Progress color (blue)
  readyGlowColor: 0x5dade2,   // Glow when ready

  // Border styling (4-sided frame around filled gauge area)
  borderColor: 0x5dade2, // Border color
  borderThickness: 0.02, // Border thickness in world units

  // Content
  icon: '/assets/icons/skill.svg',
  label: 'SKILL',

  // Tooltip
  tooltipTitle: 'Phantom Rush',
  tooltipDescription: 'Increases movement speed by 80%\nDuration: 3s, Cooldown: 10s',
});

// Set key hint
skillGauge.setKeyHint('Q');

// Update progress (0-1)
skillGauge.setProgress(0.75);

// Set ready state (triggers glow and sweep animation)
skillGauge.setReady(true);

// Cooldown overlay (dims the icon)
skillGauge.setCooldownOverlay(true);

// Click handler
skillGauge.setOnClick(() => activateSkill());

// In game loop
function update(deltaTime: number) {
  skillGauge.update(deltaTime); // Required for animations
}
```

- `setProgress(value)`: Set progress (0-1)
- `setReady(ready)`: Set ready state (triggers glow animation)
- `setFillColor(color)`: Change progress color
- `setBorderColor(color)`: Change border color
- `setKeyHint(key)`: Set key hint label
- `setLabel(label)`: Set bottom label text
- `setIcon(path)`: Change icon
- `setCooldownOverlay(active)`: Toggle cooldown dim effect
- `setOnClick(callback)`: Set click handler
- `setHovered(hovered)`: Set hover state
- `setOpacity(opacity)`: Set overall opacity (for fade effects)
- `getTooltipInfo()`: Get tooltip title and description
- `getHitRadius()`: Get outer radius for hit testing
- `update(deltaTime)`: Update animations

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

## Scene System (UI Scene Editor)

UI 위젯 트리를 JSON 파일로 저장하고 런타임에 로드하는 시스템입니다.
별도의 **UI Scene Editor** (http://localhost:4174)에서 시각적으로 편집하고 저장할 수 있습니다.

### JSON Scene 형식

```json
{
  "version": "1.0",
  "name": "BossHealthBar",
  "root": {
    "type": "UIShaderBar",
    "id": "boss_hp_bar",
    "name": "Boss HP Bar",
    "props": {
      "width": 12,
      "height": 0.3,
      "value": 1,
      "fillColor": 11993626
    },
    "position": [0, 0, 0],
    "children": [
      {
        "type": "UIText",
        "id": "boss_name",
        "props": {
          "text": "",
          "fontSize": 0.35,
          "color": 16777215,
          "anchorX": "center",
          "anchorY": "bottom"
        },
        "position": [0, 0.25, 0.01]
      }
    ]
  }
}
```

지원 위젯 타입: `UIPanel`, `UIBox`, `UIText`, `UIImage`, `UI9Slice`, `UIButton`,
`UIProgressBar`, `UIShaderBar`, `UIHeartbeatBar`, `UICircularGauge`,
`UIFloatingText`, `UITooltip`, `UIScrollView`, `UISlider`, `UICheckbox`, `UIToggle`, `UISceneRef`

### UISceneLoader - JSON에서 씬 로드

```typescript
import { UISceneLoader } from 'three-troika-ui';

// URL에서 씬 JSON 로드
const { root, ids } = await UISceneLoader.load('/ui-scenes/game/boss-health-bar.json');

// 씬을 Three.js 씬에 추가
scene.add(root);

// id로 특정 위젯 접근
const hpBar = ids.get('boss_hp_bar') as UIShaderBar;
const nameText = ids.get('boss_name') as UIText;

hpBar?.setValue(0.75);
nameText?.setText('Dragon Lord');
```

### UISceneRef - 씬 중첩 (프리팹)

JSON 내에서 다른 씬 파일을 참조하여 재사용할 수 있습니다:

```json
{
  "type": "UISceneRef",
  "id": "hp_bar_ref",
  "src": "/ui-scenes/hud/player-hp.json"
}
```

### initFromScene() 패턴

기존 코드의 위젯을 JSON 씬으로 선택적으로 교체하는 패턴입니다.
constructor는 동기 상태 유지, 선택적 async 초기화로 JSON 스타일 적용:

```typescript
export class BossHealthBar extends Group {
  private shaderBar: UIShaderBar;
  private nameText: UIText;

  constructor() {
    super();
    // 기본 위젯 생성 (동기)
    this.shaderBar = new UIShaderBar({ width: 12, height: 0.3, value: 1 });
    this.nameText = new UIText({ text: '', fontSize: 0.35 });
    this.add(this.shaderBar);
  }

  // JSON 씬에서 위젯 교체 (optional)
  async initFromScene(): Promise<void> {
    try {
      const { ids } = await UISceneLoader.load('/ui-scenes/game/boss-health-bar.json');
      const barFromScene = ids.get('boss_hp_bar') as UIShaderBar | undefined;
      if (!barFromScene) return;

      this.remove(this.shaderBar);
      this.shaderBar = barFromScene;
      this.add(this.shaderBar);
    } catch (e) {
      console.warn('[BossHealthBar] initFromScene failed, using defaults:', e);
    }
  }
}

// 사용
const bar = new BossHealthBar();      // 즉시 사용 가능
await bar.initFromScene();            // JSON 스타일 적용 (optional)
```

### UISceneSerializer - 씬 직렬화

```typescript
import { UISceneSerializer, UISceneDef } from 'three-troika-ui';

// UISceneDef를 JSON 문자열로
const json = UISceneSerializer.serialize(sceneDef);

// JSON 문자열에서 UISceneDef로
const def = UISceneSerializer.deserialize(json);

// 빈 씬 생성
const empty = UISceneSerializer.createEmpty('MyScene');

// 모든 id 수집
const ids = UISceneSerializer.collectIds(sceneDef);

// id로 노드 찾기
const node = UISceneSerializer.findById(sceneDef, 'boss_hp_bar');
```

### UI Scene Editor

별도 앱으로 실행되는 시각적 씬 편집기입니다.

```bash
bun run ui-editor    # http://localhost:4174
```

**기능:**
- 위젯 계층(Hierarchy) 트리 편집
- Three.js 실시간 미리보기 (OrthographicCamera)
- 위젯 속성 편집 (Inspector)
- 씬 파일 CRUD (`public/ui-scenes/**/*.json`)
- Undo/Redo (Ctrl+Z / Ctrl+Y)
- 뷰포트 클릭으로 위젯 선택 (레이캐스트)
- 드래그앤드롭으로 계층 순서 변경

씬 파일은 `public/ui-scenes/` 경로에 JSON으로 저장되며,
게임 런타임에서 `UISceneLoader.load()`로 직접 fetch하여 사용합니다.

```
public/ui-scenes/
├── hud/
│   ├── main.json          # 메인 HUD (FPS, 버튼 등)
│   ├── player-hp.json     # 플레이어 HP바
│   └── character-info.json
└── game/
    ├── boss-health-bar.json
    ├── shop-layout.json
    └── center-banner.json
```

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
