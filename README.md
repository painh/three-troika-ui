# three-troika-ui

Three.js UI library based on troika-three-text. A lightweight, pure Three.js UI system without Canvas2D dependency.

## Features

- **UIText**: Text rendering using troika-three-text (supports Korean, emoji, etc.)
- **UIBox**: Background boxes with rounded corners and borders
- **UIImage**: Image/icon display with texture caching
- **UIProgressBar**: Progress bar with customizable colors
- **UIPanel**: Layout container with flexbox-like positioning

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

// Add to scene
scene.add(panel);
```

## API

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

### UIImage

- `setTexture(texture)`: Set texture (URL or THREE.Texture)
- `setColor(color)`: Set tint color
- `setOpacity(opacity)`: Set transparency

### UIProgressBar

- `setValue(value)`: Set progress (0-1)
- `getValue()`: Get current value
- `setFillColor(color)`: Set fill color
- `setBackgroundColor(color)`: Set background color

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

## License

MIT
