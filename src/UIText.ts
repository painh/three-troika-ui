import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { UIElement } from './UIElement';

export interface UITextConfig {
  text?: string;
  fontSize?: number;
  color?: number | string;
  fontFamily?: string;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  maxWidth?: number;
  lineHeight?: number;
  outlineWidth?: number;
  outlineColor?: number | string;
}

/**
 * 텍스트 UI 요소 (troika-three-text 기반)
 */
export class UIText extends UIElement {
  private textMesh: Text;

  constructor(config: UITextConfig = {}) {
    super();

    this.textMesh = new Text();
    this.textMesh.text = config.text ?? '';
    this.textMesh.fontSize = config.fontSize ?? 0.1;
    this.textMesh.color = config.color ?? 0xffffff;
    this.textMesh.anchorX = config.anchorX ?? 'center';
    this.textMesh.anchorY = config.anchorY ?? 'middle';

    if (config.fontFamily) {
      this.textMesh.font = config.fontFamily;
    }
    if (config.maxWidth !== undefined) {
      this.textMesh.maxWidth = config.maxWidth;
    }
    if (config.lineHeight !== undefined) {
      this.textMesh.lineHeight = config.lineHeight;
    }
    if (config.outlineWidth !== undefined) {
      this.textMesh.outlineWidth = config.outlineWidth;
    }
    if (config.outlineColor !== undefined) {
      this.textMesh.outlineColor = config.outlineColor;
    }

    // 텍스트 동기화
    this.textMesh.sync();
    this.add(this.textMesh);
  }

  /**
   * 텍스트 내용 설정
   */
  setText(text: string): this {
    this.textMesh.text = text;
    this.textMesh.sync();
    return this;
  }

  /**
   * 텍스트 색상 설정
   */
  setColor(color: number | string): this {
    this.textMesh.color = color;
    return this;
  }

  /**
   * 폰트 크기 설정
   */
  setFontSize(size: number): this {
    this.textMesh.fontSize = size;
    this.textMesh.sync();
    return this;
  }

  /**
   * 최대 너비 설정 (자동 줄바꿈)
   */
  setMaxWidth(width: number): this {
    this.textMesh.maxWidth = width;
    this.textMesh.sync();
    return this;
  }

  /**
   * 외곽선 설정
   */
  setOutline(width: number, color: number | string): this {
    this.textMesh.outlineWidth = width;
    this.textMesh.outlineColor = color;
    return this;
  }

  /**
   * 텍스트 정렬
   */
  setAlign(anchorX: 'left' | 'center' | 'right', anchorY: 'top' | 'middle' | 'bottom'): this {
    this.textMesh.anchorX = anchorX;
    this.textMesh.anchorY = anchorY;
    this.textMesh.sync();
    return this;
  }

  /**
   * troika Text 객체 직접 접근
   */
  get text(): Text {
    return this.textMesh;
  }

  override update(): void {
    // troika는 자동으로 업데이트됨
  }

  dispose(): void {
    this.textMesh.dispose();
    this.remove(this.textMesh);
  }
}
