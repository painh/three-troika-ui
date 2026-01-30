import * as THREE from 'three';
import { UIElement } from './UIElement';

export interface UIBoxConfig {
  width?: number;
  height?: number;
  color?: number;
  opacity?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: number;
  /** 호버 시 색상 */
  hoverColor?: number;
}

/**
 * 배경 박스 UI 요소
 * 둥근 모서리와 테두리 지원
 */
export class UIBox extends UIElement {
  private backgroundMesh: THREE.Mesh;
  private borderMesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicMaterial;
  private borderMaterial: THREE.MeshBasicMaterial | null = null;

  private _color: number = 0x333333;
  private _opacity: number = 1;
  private _borderRadius: number = 0;
  private _borderWidth: number = 0;
  private _borderColor: number = 0xffffff;
  private _hoverColor: number | null = null;
  private _isHovered: boolean = false;

  constructor(config: UIBoxConfig = {}) {
    super();

    this._width = config.width ?? 1;
    this._height = config.height ?? 1;
    this._color = config.color ?? 0x333333;
    this._opacity = config.opacity ?? 1;
    this._borderRadius = config.borderRadius ?? 0;
    this._borderWidth = config.borderWidth ?? 0;
    this._borderColor = config.borderColor ?? 0xffffff;
    this._hoverColor = config.hoverColor ?? null;

    // 배경 메시 생성
    this.material = new THREE.MeshBasicMaterial({
      color: this._color,
      transparent: this._opacity < 1,
      opacity: this._opacity,
    });

    const geometry = this.createRoundedRectGeometry(this._width, this._height, this._borderRadius);
    this.backgroundMesh = new THREE.Mesh(geometry, this.material);
    this.add(this.backgroundMesh);

    // 테두리가 있으면 생성
    if (this._borderWidth > 0) {
      this.createBorder();
    }

    this.interactive = true;
  }

  /**
   * 둥근 사각형 지오메트리 생성
   */
  private createRoundedRectGeometry(width: number, height: number, radius: number): THREE.ShapeGeometry {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    const w = width;
    const h = height;
    const r = Math.min(radius, Math.min(w, h) / 2);

    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    if (r > 0) shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    if (r > 0) shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    if (r > 0) shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    if (r > 0) shape.quadraticCurveTo(x, y, x + r, y);

    return new THREE.ShapeGeometry(shape);
  }

  /**
   * 테두리 생성
   */
  private createBorder(): void {
    if (this.borderMesh) {
      this.remove(this.borderMesh);
      this.borderMesh.geometry.dispose();
    }

    const outerWidth = this._width;
    const outerHeight = this._height;
    const innerWidth = this._width - this._borderWidth * 2;
    const innerHeight = this._height - this._borderWidth * 2;
    const outerRadius = this._borderRadius;
    const innerRadius = Math.max(0, this._borderRadius - this._borderWidth);

    // 외부 Shape
    const outerShape = new THREE.Shape();
    this.drawRoundedRect(outerShape, -outerWidth / 2, -outerHeight / 2, outerWidth, outerHeight, outerRadius);

    // 내부 Hole
    const innerPath = new THREE.Path();
    this.drawRoundedRect(innerPath, -innerWidth / 2, -innerHeight / 2, innerWidth, innerHeight, innerRadius);
    outerShape.holes.push(innerPath);

    const geometry = new THREE.ShapeGeometry(outerShape);

    if (!this.borderMaterial) {
      this.borderMaterial = new THREE.MeshBasicMaterial({
        color: this._borderColor,
        transparent: true,
      });
    }
    this.borderMaterial.color.setHex(this._borderColor);

    this.borderMesh = new THREE.Mesh(geometry, this.borderMaterial);
    this.borderMesh.position.z = 0.001; // 배경 위에
    this.add(this.borderMesh);
  }

  private drawRoundedRect(
    shape: THREE.Shape | THREE.Path,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    r = Math.min(r, Math.min(w, h) / 2);
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    if (r > 0) shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    if (r > 0) shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    if (r > 0) shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    if (r > 0) shape.quadraticCurveTo(x, y, x + r, y);
  }

  /**
   * 배경색 설정
   */
  setColor(color: number): this {
    this._color = color;
    this.material.color.setHex(color);
    return this;
  }

  /**
   * 투명도 설정
   */
  setOpacity(opacity: number): this {
    this._opacity = opacity;
    this.material.opacity = opacity;
    this.material.transparent = opacity < 1;
    return this;
  }

  /**
   * 테두리 설정
   */
  setBorder(width: number, color: number): this {
    this._borderWidth = width;
    this._borderColor = color;
    if (width > 0) {
      this.createBorder();
    } else if (this.borderMesh) {
      this.remove(this.borderMesh);
      this.borderMesh.geometry.dispose();
      this.borderMesh = null;
    }
    return this;
  }

  /**
   * 모서리 둥글기 설정
   */
  setBorderRadius(radius: number): this {
    this._borderRadius = radius;
    this.rebuildGeometry();
    return this;
  }

  /**
   * 크기 변경 시 지오메트리 재생성
   */
  override setSize(width: number, height: number): this {
    this._width = width;
    this._height = height;
    this.rebuildGeometry();
    return this;
  }

  private rebuildGeometry(): void {
    this.backgroundMesh.geometry.dispose();
    this.backgroundMesh.geometry = this.createRoundedRectGeometry(this._width, this._height, this._borderRadius);

    if (this._borderWidth > 0) {
      this.createBorder();
    }
  }

  override getInteractiveMeshes(): THREE.Mesh[] {
    return [this.backgroundMesh];
  }

  /**
   * 호버 색상 설정
   */
  setHoverColor(color: number | null): this {
    this._hoverColor = color;
    return this;
  }

  /**
   * 호버 상태 설정
   */
  setHovered(hovered: boolean): this {
    if (this._isHovered === hovered) return this;
    this._isHovered = hovered;

    if (this._hoverColor !== null) {
      this.material.color.setHex(hovered ? this._hoverColor : this._color);
    }
    return this;
  }

  /**
   * 호버 상태 확인
   */
  get isHovered(): boolean {
    return this._isHovered;
  }

  dispose(): void {
    this.backgroundMesh.geometry.dispose();
    this.material.dispose();
    this.remove(this.backgroundMesh);

    if (this.borderMesh) {
      this.borderMesh.geometry.dispose();
      this.remove(this.borderMesh);
    }
    if (this.borderMaterial) {
      this.borderMaterial.dispose();
    }
  }
}
