import * as THREE from 'three';
import { UIElement } from './UIElement';

export interface UI9SliceConfig {
  width?: number;
  height?: number;
  texture?: THREE.Texture | string;
  /**
   * 9-slice 경계 (픽셀 단위, 텍스처 기준)
   * left, right, top, bottom - 각 모서리에서 안쪽으로의 거리
   */
  sliceBorders?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  /** 텍스처 원본 크기 (픽셀) - 슬라이스 계산에 필요 */
  textureSize?: { width: number; height: number };
  color?: number;
  opacity?: number;
}

// 전역 텍스처 캐시
const textureCache: Map<string, THREE.Texture> = new Map();
const textureLoader = new THREE.TextureLoader();

/**
 * 9-Slice (9-patch) 이미지 UI 요소
 *
 * 9개의 영역으로 나뉘어 코너는 그대로, 가장자리와 중앙은 늘어나는 방식
 *
 * 구조:
 * [TL] [TC] [TR]
 * [ML] [MC] [MR]
 * [BL] [BC] [BR]
 *
 * TL, TR, BL, BR: 코너 (크기 고정)
 * TC, BC: 상하 가장자리 (가로로 늘어남)
 * ML, MR: 좌우 가장자리 (세로로 늘어남)
 * MC: 중앙 (가로세로 모두 늘어남)
 */
export class UI9Slice extends UIElement {
  private group: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private materials: THREE.MeshBasicMaterial[] = [];

  private _color: number = 0xffffff;
  private _opacity: number = 1;
  private _sliceBorders = { left: 16, right: 16, top: 16, bottom: 16 };
  private _textureSize = { width: 64, height: 64 };
  private _texture: THREE.Texture | null = null;
  private currentTexturePath: string | null = null;

  constructor(config: UI9SliceConfig = {}) {
    super();

    this._width = config.width ?? 1;
    this._height = config.height ?? 1;
    this._color = config.color ?? 0xffffff;
    this._opacity = config.opacity ?? 1;

    if (config.sliceBorders) {
      this._sliceBorders = { ...config.sliceBorders };
    }
    if (config.textureSize) {
      this._textureSize = { ...config.textureSize };
    }

    this.group = new THREE.Group();
    this.add(this.group);

    // 초기 메시 생성
    this.createMeshes();

    // 텍스처 설정
    if (config.texture) {
      if (typeof config.texture === 'string') {
        this.setTexture(config.texture);
      } else {
        this._texture = config.texture;
        this.updateTexture();
      }
    }

    this.interactive = true;
  }

  /**
   * 9개의 메시 생성
   */
  private createMeshes(): void {
    // 기존 메시 정리
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      this.group.remove(mesh);
    }
    for (const material of this.materials) {
      material.dispose();
    }
    this.meshes = [];
    this.materials = [];

    // 슬라이스 크기 계산 (UI 단위로 변환)
    const { left, right, top, bottom } = this._sliceBorders;
    const { width: texW, height: texH } = this._textureSize;

    // UV 좌표 (0~1 범위)
    const leftU = left / texW;
    const rightU = right / texW;
    const topU = top / texH;
    const bottomU = bottom / texH;

    // 코너 크기는 픽셀 기준으로 고정 (PX = 0.01)
    const PX = 0.01;
    const leftSize = left * PX;
    const rightSize = right * PX;
    const topSize = top * PX;
    const bottomSize = bottom * PX;

    // 중앙 영역 크기
    const centerWidth = Math.max(0, this._width - leftSize - rightSize);
    const centerHeight = Math.max(0, this._height - topSize - bottomSize);

    // 9개 영역 정의
    const regions = [
      // [row, col, x, y, w, h, u0, v0, u1, v1]
      // Bottom row
      { x: -this._width/2, y: -this._height/2, w: leftSize, h: bottomSize, u0: 0, v0: 0, u1: leftU, v1: bottomU }, // BL
      { x: -this._width/2 + leftSize, y: -this._height/2, w: centerWidth, h: bottomSize, u0: leftU, v0: 0, u1: 1 - rightU, v1: bottomU }, // BC
      { x: this._width/2 - rightSize, y: -this._height/2, w: rightSize, h: bottomSize, u0: 1 - rightU, v0: 0, u1: 1, v1: bottomU }, // BR
      // Middle row
      { x: -this._width/2, y: -this._height/2 + bottomSize, w: leftSize, h: centerHeight, u0: 0, v0: bottomU, u1: leftU, v1: 1 - topU }, // ML
      { x: -this._width/2 + leftSize, y: -this._height/2 + bottomSize, w: centerWidth, h: centerHeight, u0: leftU, v0: bottomU, u1: 1 - rightU, v1: 1 - topU }, // MC
      { x: this._width/2 - rightSize, y: -this._height/2 + bottomSize, w: rightSize, h: centerHeight, u0: 1 - rightU, v0: bottomU, u1: 1, v1: 1 - topU }, // MR
      // Top row
      { x: -this._width/2, y: this._height/2 - topSize, w: leftSize, h: topSize, u0: 0, v0: 1 - topU, u1: leftU, v1: 1 }, // TL
      { x: -this._width/2 + leftSize, y: this._height/2 - topSize, w: centerWidth, h: topSize, u0: leftU, v0: 1 - topU, u1: 1 - rightU, v1: 1 }, // TC
      { x: this._width/2 - rightSize, y: this._height/2 - topSize, w: rightSize, h: topSize, u0: 1 - rightU, v0: 1 - topU, u1: 1, v1: 1 }, // TR
    ];

    for (const region of regions) {
      if (region.w <= 0 || region.h <= 0) continue;

      const geometry = new THREE.PlaneGeometry(region.w, region.h);

      // UV 설정 - PlaneGeometry 정점 순서: 좌상, 우상, 좌하, 우하
      const uvs = geometry.attributes.uv as THREE.BufferAttribute;
      uvs.setXY(0, region.u0, region.v1); // 좌상
      uvs.setXY(1, region.u1, region.v1); // 우상
      uvs.setXY(2, region.u0, region.v0); // 좌하
      uvs.setXY(3, region.u1, region.v0); // 우하
      uvs.needsUpdate = true;

      const material = new THREE.MeshBasicMaterial({
        color: this._color,
        transparent: true,
        opacity: this._opacity,
        map: this._texture,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(region.x + region.w / 2, region.y + region.h / 2, 0);

      this.meshes.push(mesh);
      this.materials.push(material);
      this.group.add(mesh);
    }
  }

  /**
   * 텍스처 설정
   */
  setTexture(texture: THREE.Texture | string): this {
    if (typeof texture === 'string') {
      this.currentTexturePath = texture;

      if (textureCache.has(texture)) {
        this._texture = textureCache.get(texture)!;
        this.updateTexture();
      } else {
        textureLoader.load(
          texture,
          (loadedTexture) => {
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            loadedTexture.magFilter = THREE.LinearFilter;
            loadedTexture.minFilter = THREE.LinearFilter;
            textureCache.set(texture, loadedTexture);

            if (this.currentTexturePath === texture) {
              this._texture = loadedTexture;
              this.updateTexture();
            }
          },
          undefined,
          (error) => {
            console.warn('Failed to load 9-slice texture:', texture, error);
          }
        );
      }
    } else {
      this.currentTexturePath = null;
      this._texture = texture;
      this.updateTexture();
    }
    return this;
  }

  /**
   * 모든 메시에 텍스처 적용
   */
  private updateTexture(): void {
    for (const material of this.materials) {
      material.map = this._texture;
      material.needsUpdate = true;
    }
  }

  /**
   * 슬라이스 경계 설정
   */
  setSliceBorders(left: number, right: number, top: number, bottom: number): this {
    this._sliceBorders = { left, right, top, bottom };
    this.createMeshes();
    this.updateTexture();
    return this;
  }

  /**
   * 텍스처 크기 설정
   */
  setTextureSize(width: number, height: number): this {
    this._textureSize = { width, height };
    this.createMeshes();
    this.updateTexture();
    return this;
  }

  /**
   * 색상 설정 (틴트)
   */
  setColor(color: number): this {
    this._color = color;
    for (const material of this.materials) {
      material.color.setHex(color);
    }
    return this;
  }

  /**
   * 투명도 설정
   */
  setOpacity(opacity: number): this {
    this._opacity = opacity;
    for (const material of this.materials) {
      material.opacity = opacity;
    }
    return this;
  }

  override setSize(width: number, height: number): this {
    this._width = width;
    this._height = height;
    this.createMeshes();
    this.updateTexture();
    return this;
  }

  override getInteractiveMeshes(): THREE.Mesh[] {
    return this.meshes;
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      this.group.remove(mesh);
    }
    for (const material of this.materials) {
      material.dispose();
    }
    this.meshes = [];
    this.materials = [];
  }
}
