// @ts-ignore - troika-three-text doesn't have type definitions
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
  private _onSyncCallback: (() => void) | null = null;

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
    this.syncWithCallback();
    this.add(this.textMesh);
  }

  /**
   * 텍스트 내용 설정
   */
  setText(text: string): this {
    this.textMesh.text = text;
    this.syncWithCallback();
    return this;
  }

  /**
   * sync 완료 시 콜백 설정
   */
  onSync(callback: () => void): this {
    this._onSyncCallback = callback;
    return this;
  }

  /**
   * 콜백과 함께 sync 실행
   */
  private syncWithCallback(): void {
    this.textMesh.sync(() => {
      if (this._onSyncCallback) {
        this._onSyncCallback();
      }
    });
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
    this.syncWithCallback();
    return this;
  }

  /**
   * 최대 너비 설정 (자동 줄바꿈)
   */
  setMaxWidth(width: number): this {
    this.textMesh.maxWidth = width;
    this.syncWithCallback();
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
    this.syncWithCallback();
    return this;
  }

  /**
   * troika Text 객체 직접 접근
   */
  get text(): Text {
    return this.textMesh;
  }

  override update(_deltaTime?: number): void {
    // troika는 자동으로 업데이트됨
  }

  dispose(): void {
    this.textMesh.dispose();
    this.remove(this.textMesh);
  }
}
