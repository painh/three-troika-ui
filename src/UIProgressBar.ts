import * as THREE from 'three';
import { UIElement } from './UIElement';
import { UIBox } from './UIBox';

export interface UIProgressBarConfig {
  width?: number;
  height?: number;
  value?: number; // 0 ~ 1
  backgroundColor?: number;
  fillColor?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: number;
  direction?: 'horizontal' | 'vertical';
}

/**
 * 프로그레스 바 UI 요소
 */
export class UIProgressBar extends UIElement {
  private background: UIBox;
  private fill: UIBox;

  private _value: number = 1;
  private _direction: 'horizontal' | 'vertical' = 'horizontal';
  private _fillColor: number = 0x00ff00;

  constructor(config: UIProgressBarConfig = {}) {
    super();

    this._width = config.width ?? 1;
    this._height = config.height ?? 0.1;
    this._value = config.value ?? 1;
    this._direction = config.direction ?? 'horizontal';
    this._fillColor = config.fillColor ?? 0x00ff00;

    const borderRadius = config.borderRadius ?? 0;
    const borderWidth = config.borderWidth ?? 0;
    const borderColor = config.borderColor ?? 0xffffff;

    // 배경
    this.background = new UIBox({
      width: this._width,
      height: this._height,
      color: config.backgroundColor ?? 0x333333,
      borderRadius,
      borderWidth,
      borderColor,
    });
    this.add(this.background);

    // 채움
    const fillWidth = this._direction === 'horizontal' ? this._width * this._value : this._width;
    const fillHeight = this._direction === 'vertical' ? this._height * this._value : this._height;

    this.fill = new UIBox({
      width: Math.max(0.001, fillWidth - borderWidth * 2),
      height: Math.max(0.001, fillHeight - borderWidth * 2),
      color: this._fillColor,
      borderRadius: Math.max(0, borderRadius - borderWidth),
    });
    this.fill.position.z = 0.002;
    this.add(this.fill);

    this.updateFillPosition();

    this.interactive = true;
  }

  /**
   * 값 설정 (0 ~ 1)
   */
  setValue(value: number): this {
    this._value = Math.max(0, Math.min(1, value));
    this.updateFillSize();
    this.updateFillPosition();
    return this;
  }

  /**
   * 값 가져오기
   */
  getValue(): number {
    return this._value;
  }

  /**
   * 채움 색상 설정
   */
  setFillColor(color: number): this {
    this._fillColor = color;
    this.fill.setColor(color);
    return this;
  }

  /**
   * 배경 색상 설정
   */
  setBackgroundColor(color: number): this {
    this.background.setColor(color);
    return this;
  }

  private updateFillSize(): void {
    if (this._direction === 'horizontal') {
      const fillWidth = Math.max(0.001, this._width * this._value);
      this.fill.setSize(fillWidth, this._height);
    } else {
      const fillHeight = Math.max(0.001, this._height * this._value);
      this.fill.setSize(this._width, fillHeight);
    }
  }

  private updateFillPosition(): void {
    if (this._direction === 'horizontal') {
      // 왼쪽 정렬
      const offsetX = (-this._width + this._width * this._value) / 2;
      this.fill.position.x = offsetX;
    } else {
      // 아래쪽 정렬
      const offsetY = (-this._height + this._height * this._value) / 2;
      this.fill.position.y = offsetY;
    }
  }

  override setSize(width: number, height: number): this {
    this._width = width;
    this._height = height;
    this.background.setSize(width, height);
    this.updateFillSize();
    this.updateFillPosition();
    return this;
  }

  override getInteractiveMeshes(): THREE.Mesh[] {
    return this.background.getInteractiveMeshes();
  }

  dispose(): void {
    this.background.dispose();
    this.fill.dispose();
    this.remove(this.background);
    this.remove(this.fill);
  }
}
