import * as THREE from 'three';
import { UIElement } from './UIElement';
import { UIText } from './UIText';

export interface UISliderConfig {
  /** 슬라이더 너비 */
  width?: number;
  /** 슬라이더 높이 */
  height?: number;
  /** 최소값 */
  min?: number;
  /** 최대값 */
  max?: number;
  /** 현재 값 */
  value?: number;
  /** 스텝 단위 (0이면 연속) */
  step?: number;
  /** 트랙 색상 */
  trackColor?: number;
  /** 채워진 트랙 색상 */
  fillColor?: number;
  /** 핸들 색상 */
  handleColor?: number;
  /** 핸들 호버 색상 */
  handleHoverColor?: number;
  /** 핸들 크기 */
  handleSize?: number;
  /** 값 표시 여부 */
  showValue?: boolean;
  /** 값 포맷 함수 */
  valueFormat?: (value: number) => string;
  /** 값 변경 콜백 */
  onChange?: (value: number) => void;
}

/**
 * 값 조절 슬라이더
 */
export class UISlider extends UIElement {
  private track: THREE.Mesh;
  private fill: THREE.Mesh;
  private handle: THREE.Mesh;
  private valueText: UIText | null = null;

  private trackMaterial: THREE.MeshBasicMaterial;
  private fillMaterial: THREE.MeshBasicMaterial;
  private handleMaterial: THREE.MeshBasicMaterial;

  private config: Required<Omit<UISliderConfig, 'onChange' | 'valueFormat'>> & {
    onChange?: (value: number) => void;
    valueFormat: (value: number) => string;
  };

  private _value: number;
  private _isDragging: boolean = false;
  private _isHovered: boolean = false;

  constructor(config: UISliderConfig = {}) {
    super();

    this.config = {
      width: config.width ?? 3,
      height: config.height ?? 0.15,
      min: config.min ?? 0,
      max: config.max ?? 100,
      value: config.value ?? 50,
      step: config.step ?? 0,
      trackColor: config.trackColor ?? 0x2c3e50,
      fillColor: config.fillColor ?? 0x3498db,
      handleColor: config.handleColor ?? 0xecf0f1,
      handleHoverColor: config.handleHoverColor ?? 0xffffff,
      handleSize: config.handleSize ?? 0.25,
      showValue: config.showValue ?? true,
      valueFormat: config.valueFormat ?? ((v) => Math.round(v).toString()),
      onChange: config.onChange,
    };

    this._width = this.config.width;
    this._height = this.config.height;
    this._value = this.config.value;

    // 트랙 (배경)
    const trackGeometry = new THREE.PlaneGeometry(this.config.width, this.config.height);
    this.trackMaterial = new THREE.MeshBasicMaterial({
      color: this.config.trackColor,
    });
    this.track = new THREE.Mesh(trackGeometry, this.trackMaterial);
    this.add(this.track);

    // 채워진 부분
    const fillGeometry = new THREE.PlaneGeometry(1, this.config.height);
    this.fillMaterial = new THREE.MeshBasicMaterial({
      color: this.config.fillColor,
    });
    this.fill = new THREE.Mesh(fillGeometry, this.fillMaterial);
    this.fill.position.z = 0.001;
    this.add(this.fill);

    // 핸들
    const handleGeometry = new THREE.CircleGeometry(this.config.handleSize / 2, 16);
    this.handleMaterial = new THREE.MeshBasicMaterial({
      color: this.config.handleColor,
    });
    this.handle = new THREE.Mesh(handleGeometry, this.handleMaterial);
    this.handle.position.z = 0.002;
    this.add(this.handle);

    // 값 텍스트
    if (this.config.showValue) {
      this.valueText = new UIText({
        text: this.config.valueFormat(this._value),
        fontSize: 0.15,
        color: 0xffffff,
        anchorX: 'center',
        anchorY: 'bottom',
      });
      this.valueText.position.set(0, this.config.handleSize / 2 + 0.1, 0.003);
      this.add(this.valueText);
    }

    this.updateVisuals();
    this.interactive = true;
  }

  /**
   * 비주얼 업데이트
   */
  private updateVisuals(): void {
    const ratio = this.getRatio();
    const trackWidth = this.config.width;
    const halfTrack = trackWidth / 2;

    // 채워진 부분 크기/위치
    const fillWidth = trackWidth * ratio;
    this.fill.scale.x = fillWidth || 0.001;
    this.fill.position.x = -halfTrack + fillWidth / 2;

    // 핸들 위치
    this.handle.position.x = -halfTrack + trackWidth * ratio;

    // 값 텍스트
    if (this.valueText) {
      this.valueText.setText(this.config.valueFormat(this._value));
      this.valueText.position.x = this.handle.position.x;
    }
  }

  /**
   * 현재 값의 비율 (0~1)
   */
  private getRatio(): number {
    const range = this.config.max - this.config.min;
    if (range === 0) return 0;
    return (this._value - this.config.min) / range;
  }

  /**
   * 값 설정
   */
  setValue(value: number): this {
    const newValue = this.clampAndStep(value);
    if (this._value !== newValue) {
      this._value = newValue;
      this.updateVisuals();
      this.config.onChange?.(this._value);
    }
    return this;
  }

  /**
   * 값 제한 및 스텝 적용
   */
  private clampAndStep(value: number): number {
    // 범위 제한
    value = Math.max(this.config.min, Math.min(this.config.max, value));

    // 스텝 적용
    if (this.config.step > 0) {
      const steps = Math.round((value - this.config.min) / this.config.step);
      value = this.config.min + steps * this.config.step;
      value = Math.max(this.config.min, Math.min(this.config.max, value));
    }

    return value;
  }

  /**
   * 로컬 X 좌표로 값 설정
   */
  setValueFromLocalX(localX: number): this {
    const halfWidth = this.config.width / 2;
    const ratio = (localX + halfWidth) / this.config.width;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const value = this.config.min + (this.config.max - this.config.min) * clampedRatio;
    return this.setValue(value);
  }

  /**
   * 드래그 시작
   */
  startDrag(): void {
    this._isDragging = true;
  }

  /**
   * 드래그 종료
   */
  endDrag(): void {
    this._isDragging = false;
  }

  /**
   * 호버 상태 설정
   */
  setHovered(hovered: boolean): this {
    if (this._isHovered === hovered) return this;
    this._isHovered = hovered;
    this.handleMaterial.color.setHex(
      hovered ? this.config.handleHoverColor : this.config.handleColor
    );
    return this;
  }

  get value(): number {
    return this._value;
  }

  get isDragging(): boolean {
    return this._isDragging;
  }

  get isHovered(): boolean {
    return this._isHovered;
  }

  /**
   * 핸들 메시 반환
   */
  getHandle(): THREE.Mesh {
    return this.handle;
  }

  /**
   * 트랙 메시 반환
   */
  getTrack(): THREE.Mesh {
    return this.track;
  }

  override getInteractiveMeshes(): THREE.Mesh[] {
    return [this.track, this.handle];
  }

  dispose(): void {
    this.track.geometry.dispose();
    this.trackMaterial.dispose();
    this.fill.geometry.dispose();
    this.fillMaterial.dispose();
    this.handle.geometry.dispose();
    this.handleMaterial.dispose();
    this.valueText?.dispose();
  }
}
