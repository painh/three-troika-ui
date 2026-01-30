import * as THREE from 'three';
import { UIElement } from './UIElement';
import { UIBox } from './UIBox';
import { UIText } from './UIText';

export interface UICheckboxConfig {
  /** 체크박스 크기 */
  size?: number;
  /** 라벨 텍스트 */
  label?: string;
  /** 라벨 폰트 크기 */
  labelSize?: number;
  /** 라벨 색상 */
  labelColor?: number;
  /** 초기 체크 상태 */
  checked?: boolean;
  /** 박스 색상 */
  boxColor?: number;
  /** 박스 호버 색상 */
  boxHoverColor?: number;
  /** 체크 마크 색상 */
  checkColor?: number;
  /** 모서리 둥글기 */
  borderRadius?: number;
  /** 라벨과의 간격 */
  gap?: number;
  /** 변경 콜백 */
  onChange?: (checked: boolean) => void;
}

/**
 * 체크박스 UI 요소
 */
export class UICheckbox extends UIElement {
  private box: UIBox;
  private checkMark: THREE.Group;
  private labelText: UIText | null = null;

  private config: Required<Omit<UICheckboxConfig, 'onChange'>> & { onChange?: (checked: boolean) => void };

  private _checked: boolean;
  private _isHovered: boolean = false;

  constructor(config: UICheckboxConfig = {}) {
    super();

    this.config = {
      size: config.size ?? 0.3,
      label: config.label ?? '',
      labelSize: config.labelSize ?? 0.18,
      labelColor: config.labelColor ?? 0xecf0f1,
      checked: config.checked ?? false,
      boxColor: config.boxColor ?? 0x2c3e50,
      boxHoverColor: config.boxHoverColor ?? 0x34495e,
      checkColor: config.checkColor ?? 0x2ecc71,
      borderRadius: config.borderRadius ?? 0.04,
      gap: config.gap ?? 0.15,
      onChange: config.onChange,
    };

    this._checked = this.config.checked;

    // 체크박스 배경
    this.box = new UIBox({
      width: this.config.size,
      height: this.config.size,
      color: this.config.boxColor,
      opacity: 1,
      borderRadius: this.config.borderRadius,
      hoverColor: this.config.boxHoverColor,
    });
    this.add(this.box);

    // 체크 마크 (V 모양)
    this.checkMark = this.createCheckMark();
    this.checkMark.position.z = 0.01;
    this.checkMark.visible = this._checked;
    this.add(this.checkMark);

    // 라벨
    if (this.config.label) {
      this.labelText = new UIText({
        text: this.config.label,
        fontSize: this.config.labelSize,
        color: this.config.labelColor,
        anchorX: 'left',
        anchorY: 'middle',
      });
      this.labelText.position.set(this.config.size / 2 + this.config.gap, 0, 0);
      this.add(this.labelText);
    }

    // 크기 계산
    this._width = this.config.size;
    this._height = this.config.size;
    if (this.labelText) {
      this._width += this.config.gap + this.config.label.length * this.config.labelSize * 0.6;
    }

    this.interactive = true;
  }

  /**
   * 체크 마크 생성
   */
  private createCheckMark(): THREE.Group {
    const group = new THREE.Group();
    const size = this.config.size * 0.6;

    // V 모양을 두 개의 선으로 표현
    const material = new THREE.MeshBasicMaterial({ color: this.config.checkColor });

    // 왼쪽 아래로 가는 선
    const line1Geometry = new THREE.PlaneGeometry(size * 0.3, size * 0.08);
    const line1 = new THREE.Mesh(line1Geometry, material);
    line1.rotation.z = -Math.PI / 4;
    line1.position.set(-size * 0.15, -size * 0.05, 0);
    group.add(line1);

    // 오른쪽 위로 가는 선
    const line2Geometry = new THREE.PlaneGeometry(size * 0.5, size * 0.08);
    const line2 = new THREE.Mesh(line2Geometry, material);
    line2.rotation.z = Math.PI / 4;
    line2.position.set(size * 0.1, size * 0.05, 0);
    group.add(line2);

    return group;
  }

  /**
   * 체크 상태 토글
   */
  toggle(): this {
    return this.setChecked(!this._checked);
  }

  /**
   * 체크 상태 설정
   */
  setChecked(checked: boolean): this {
    if (this._checked === checked) return this;
    this._checked = checked;
    this.checkMark.visible = checked;
    this.config.onChange?.(checked);
    return this;
  }

  /**
   * 호버 상태 설정
   */
  setHovered(hovered: boolean): this {
    if (this._isHovered === hovered) return this;
    this._isHovered = hovered;
    this.box.setHovered(hovered);
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

  get checked(): boolean {
    return this._checked;
  }

  get isHovered(): boolean {
    return this._isHovered;
  }

  override getInteractiveMeshes(): THREE.Mesh[] {
    const meshes = this.box.getInteractiveMeshes();
    // 라벨도 클릭 가능하게 하려면 라벨 영역도 추가 가능
    return meshes;
  }

  dispose(): void {
    this.box.dispose();
    this.checkMark.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    this.labelText?.dispose();
  }
}
