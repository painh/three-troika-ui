import * as THREE from 'three';
import { UIElement } from './UIElement';
import { UIText } from './UIText';

export interface UIToggleConfig {
  /** 토글 너비 */
  width?: number;
  /** 토글 높이 */
  height?: number;
  /** 라벨 텍스트 */
  label?: string;
  /** 라벨 폰트 크기 */
  labelSize?: number;
  /** 라벨 색상 */
  labelColor?: number;
  /** 초기 상태 */
  value?: boolean;
  /** OFF 상태 색상 */
  offColor?: number;
  /** ON 상태 색상 */
  onColor?: number;
  /** 핸들 색상 */
  handleColor?: number;
  /** 라벨과의 간격 */
  gap?: number;
  /** 변경 콜백 */
  onChange?: (value: boolean) => void;
}

/**
 * 토글 스위치 UI 요소
 */
export class UIToggle extends UIElement {
  private track: THREE.Mesh;
  private handle: THREE.Mesh;
  private labelText: UIText | null = null;

  private trackMaterial: THREE.MeshBasicMaterial;
  private handleMaterial: THREE.MeshBasicMaterial;

  private config: Required<Omit<UIToggleConfig, 'onChange'>> & { onChange?: (value: boolean) => void };

  private _value: boolean;
  private _isHovered: boolean = false;

  // 애니메이션 상태
  private targetHandleX: number = 0;
  private currentHandleX: number = 0;

  constructor(config: UIToggleConfig = {}) {
    super();

    this.config = {
      width: config.width ?? 0.6,
      height: config.height ?? 0.3,
      label: config.label ?? '',
      labelSize: config.labelSize ?? 0.18,
      labelColor: config.labelColor ?? 0xecf0f1,
      value: config.value ?? false,
      offColor: config.offColor ?? 0x7f8c8d,
      onColor: config.onColor ?? 0x2ecc71,
      handleColor: config.handleColor ?? 0xffffff,
      gap: config.gap ?? 0.15,
      onChange: config.onChange,
    };

    this._value = this.config.value;

    const radius = this.config.height / 2;

    // 트랙 (pill 모양)
    const trackShape = this.createPillShape(this.config.width, this.config.height);
    const trackGeometry = new THREE.ShapeGeometry(trackShape);
    this.trackMaterial = new THREE.MeshBasicMaterial({
      color: this._value ? this.config.onColor : this.config.offColor,
    });
    this.track = new THREE.Mesh(trackGeometry, this.trackMaterial);
    this.add(this.track);

    // 핸들 (원형)
    const handleRadius = radius * 0.8;
    const handleGeometry = new THREE.CircleGeometry(handleRadius, 16);
    this.handleMaterial = new THREE.MeshBasicMaterial({
      color: this.config.handleColor,
    });
    this.handle = new THREE.Mesh(handleGeometry, this.handleMaterial);
    this.handle.position.z = 0.01;
    this.add(this.handle);

    // 핸들 초기 위치
    const handleTravel = this.config.width - this.config.height;
    this.targetHandleX = this._value ? handleTravel / 2 : -handleTravel / 2;
    this.currentHandleX = this.targetHandleX;
    this.handle.position.x = this.currentHandleX;

    // 라벨
    if (this.config.label) {
      this.labelText = new UIText({
        text: this.config.label,
        fontSize: this.config.labelSize,
        color: this.config.labelColor,
        anchorX: 'left',
        anchorY: 'middle',
      });
      this.labelText.position.set(this.config.width / 2 + this.config.gap, 0, 0);
      this.add(this.labelText);
    }

    // 크기 계산
    this._width = this.config.width;
    this._height = this.config.height;
    if (this.labelText) {
      this._width += this.config.gap + this.config.label.length * this.config.labelSize * 0.6;
    }

    this.interactive = true;
  }

  /**
   * pill 모양 Shape 생성
   */
  private createPillShape(width: number, height: number): THREE.Shape {
    const shape = new THREE.Shape();
    const radius = height / 2;
    const x = -width / 2;
    const y = -height / 2;

    // 왼쪽 반원
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    // 오른쪽 반원
    shape.arc(0, radius, radius, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(x + radius, y + height);
    // 왼쪽 반원
    shape.arc(0, -radius, radius, Math.PI / 2, -Math.PI / 2, false);

    return shape;
  }

  /**
   * 토글
   */
  toggle(): this {
    return this.setValue(!this._value);
  }

  /**
   * 값 설정
   */
  setValue(value: boolean): this {
    if (this._value === value) return this;
    this._value = value;

    // 색상 변경
    this.trackMaterial.color.setHex(value ? this.config.onColor : this.config.offColor);

    // 핸들 목표 위치 설정 (애니메이션용)
    const handleTravel = this.config.width - this.config.height;
    this.targetHandleX = value ? handleTravel / 2 : -handleTravel / 2;

    this.config.onChange?.(value);
    return this;
  }

  /**
   * 호버 상태 설정
   */
  setHovered(hovered: boolean): this {
    this._isHovered = hovered;
    return this;
  }

  /**
   * 라벨 설정
   */
  setLabel(text: string): this {
    this.config.label = text;
    if (this.labelText) {
      this.labelText.setText(text);
    }
    return this;
  }

  /**
   * 애니메이션 업데이트
   */
  override update(deltaTime: number = 1 / 60): void {
    // 핸들 부드러운 이동
    const speed = 10;
    const diff = this.targetHandleX - this.currentHandleX;
    if (Math.abs(diff) > 0.001) {
      this.currentHandleX += diff * Math.min(1, speed * deltaTime);
      this.handle.position.x = this.currentHandleX;
    }
  }

  get value(): boolean {
    return this._value;
  }

  get isHovered(): boolean {
    return this._isHovered;
  }

  override getInteractiveMeshes(): THREE.Mesh[] {
    return [this.track];
  }

  dispose(): void {
    this.track.geometry.dispose();
    this.trackMaterial.dispose();
    this.handle.geometry.dispose();
    this.handleMaterial.dispose();
    this.labelText?.dispose();
  }
}
