import * as THREE from 'three';
import { UIElement } from './UIElement';
import { UIBox } from './UIBox';
import { UIText } from './UIText';

export interface UIButtonConfig {
  /** 버튼 너비 */
  width?: number;
  /** 버튼 높이 */
  height?: number;
  /** 버튼 텍스트 */
  text?: string;
  /** 폰트 크기 */
  fontSize?: number;
  /** 텍스트 색상 */
  textColor?: number;
  /** 배경 색상 */
  color?: number;
  /** 배경 투명도 */
  opacity?: number;
  /** 호버 시 배경 색상 */
  hoverColor?: number;
  /** 클릭 시 배경 색상 */
  pressColor?: number;
  /** 비활성화 시 배경 색상 */
  disabledColor?: number;
  /** 비활성화 시 텍스트 색상 */
  disabledTextColor?: number;
  /** 모서리 둥글기 */
  borderRadius?: number;
  /** 테두리 두께 */
  borderWidth?: number;
  /** 테두리 색상 */
  borderColor?: number;
  /** 클릭 콜백 */
  onClick?: () => void;
}

/**
 * 클릭 가능한 버튼 UI 요소
 * 텍스트 + 배경 + 호버/클릭 상태 지원
 */
export class UIButton extends UIElement {
  private background: UIBox;
  private label: UIText;

  private config: Required<Omit<UIButtonConfig, 'onClick'>> & { onClick?: () => void };
  private _isHovered: boolean = false;
  private _isPressed: boolean = false;
  private _isDisabled: boolean = false;

  constructor(config: UIButtonConfig = {}) {
    super();

    this.config = {
      width: config.width ?? 2,
      height: config.height ?? 0.5,
      text: config.text ?? 'Button',
      fontSize: config.fontSize ?? 0.2,
      textColor: config.textColor ?? 0xffffff,
      color: config.color ?? 0x3498db,
      opacity: config.opacity ?? 1,
      hoverColor: config.hoverColor ?? 0x2980b9,
      pressColor: config.pressColor ?? 0x1a5276,
      disabledColor: config.disabledColor ?? 0x7f8c8d,
      disabledTextColor: config.disabledTextColor ?? 0xbdc3c7,
      borderRadius: config.borderRadius ?? 0.08,
      borderWidth: config.borderWidth ?? 0,
      borderColor: config.borderColor ?? 0xffffff,
      onClick: config.onClick,
    };

    this._width = this.config.width;
    this._height = this.config.height;

    // 배경 생성
    this.background = new UIBox({
      width: this.config.width,
      height: this.config.height,
      color: this.config.color,
      opacity: this.config.opacity,
      borderRadius: this.config.borderRadius,
      borderWidth: this.config.borderWidth,
      borderColor: this.config.borderColor,
    });
    this.add(this.background);

    // 텍스트 생성
    this.label = new UIText({
      text: this.config.text,
      fontSize: this.config.fontSize,
      color: this.config.textColor,
      anchorX: 'center',
      anchorY: 'middle',
    });
    this.label.position.z = 0.01;
    this.add(this.label);

    this.interactive = true;
  }

  /**
   * 텍스트 설정
   */
  setText(text: string): this {
    this.config.text = text;
    this.label.setText(text);
    return this;
  }

  /**
   * 호버 상태 설정
   */
  setHovered(hovered: boolean): this {
    if (this._isDisabled || this._isHovered === hovered) return this;
    this._isHovered = hovered;
    this.updateAppearance();
    return this;
  }

  /**
   * 클릭(눌림) 상태 설정
   */
  setPressed(pressed: boolean): this {
    if (this._isDisabled || this._isPressed === pressed) return this;
    this._isPressed = pressed;
    this.updateAppearance();
    return this;
  }

  /**
   * 비활성화 상태 설정
   */
  setDisabled(disabled: boolean): this {
    if (this._isDisabled === disabled) return this;
    this._isDisabled = disabled;
    this._isHovered = false;
    this._isPressed = false;
    this.updateAppearance();
    return this;
  }

  /**
   * 클릭 콜백 설정
   */
  setOnClick(callback: (() => void) | undefined): this {
    this.config.onClick = callback;
    return this;
  }

  /**
   * 클릭 실행
   */
  click(): void {
    if (this._isDisabled) return;
    this.config.onClick?.();
  }

  /**
   * 상태에 따른 외관 업데이트
   */
  private updateAppearance(): void {
    if (this._isDisabled) {
      this.background.setColor(this.config.disabledColor);
      this.label.setColor(this.config.disabledTextColor);
    } else if (this._isPressed) {
      this.background.setColor(this.config.pressColor);
      this.label.setColor(this.config.textColor);
    } else if (this._isHovered) {
      this.background.setColor(this.config.hoverColor);
      this.label.setColor(this.config.textColor);
    } else {
      this.background.setColor(this.config.color);
      this.label.setColor(this.config.textColor);
    }
  }

  /**
   * 색상 설정
   */
  setColor(color: number): this {
    this.config.color = color;
    this.updateAppearance();
    return this;
  }

  /**
   * 호버 색상 설정
   */
  setHoverColor(color: number): this {
    this.config.hoverColor = color;
    this.updateAppearance();
    return this;
  }

  /**
   * 클릭 색상 설정
   */
  setPressColor(color: number): this {
    this.config.pressColor = color;
    this.updateAppearance();
    return this;
  }

  /**
   * 크기 설정
   */
  override setSize(width: number, height: number): this {
    this._width = width;
    this._height = height;
    this.config.width = width;
    this.config.height = height;
    this.background.setSize(width, height);
    return this;
  }

  get isHovered(): boolean {
    return this._isHovered;
  }

  get isPressed(): boolean {
    return this._isPressed;
  }

  get isDisabled(): boolean {
    return this._isDisabled;
  }

  override getInteractiveMeshes(): THREE.Mesh[] {
    return this.background.getInteractiveMeshes();
  }

  dispose(): void {
    this.background.dispose();
    this.label.dispose();
  }
}
