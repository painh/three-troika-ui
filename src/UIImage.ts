import * as THREE from 'three';
import { UIElement } from './UIElement';

export interface UIImageConfig {
  width?: number;
  height?: number;
  texture?: THREE.Texture | string;
  color?: number; // tint color
  opacity?: number;
}

// 전역 텍스처 캐시
const textureCache: Map<string, THREE.Texture> = new Map();
const textureLoader = new THREE.TextureLoader();

/**
 * 이미지/아이콘 UI 요소
 */
export class UIImage extends UIElement {
  private mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private currentTexturePath: string | null = null;

  constructor(config: UIImageConfig = {}) {
    super();

    this._width = config.width ?? 1;
    this._height = config.height ?? 1;

    const geometry = new THREE.PlaneGeometry(this._width, this._height);
    this.material = new THREE.MeshBasicMaterial({
      color: config.color ?? 0xffffff,
      transparent: true,
      opacity: config.opacity ?? 1,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.add(this.mesh);

    // 텍스처 설정
    if (config.texture) {
      if (typeof config.texture === 'string') {
        this.setTexture(config.texture);
      } else {
        this.material.map = config.texture;
        this.material.needsUpdate = true;
      }
    }

    this.interactive = true;
  }

  /**
   * 텍스처 설정 (URL 또는 Texture)
   */
  setTexture(texture: THREE.Texture | string): this {
    if (typeof texture === 'string') {
      this.currentTexturePath = texture;

      // 캐시 확인
      if (textureCache.has(texture)) {
        this.material.map = textureCache.get(texture)!;
        this.material.needsUpdate = true;
      } else {
        // 로드
        textureLoader.load(
          texture,
          (loadedTexture) => {
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            textureCache.set(texture, loadedTexture);
            // 아직 이 텍스처를 기다리고 있는지 확인
            if (this.currentTexturePath === texture) {
              this.material.map = loadedTexture;
              this.material.needsUpdate = true;
            }
          },
          undefined,
          (error) => {
            console.warn('Failed to load texture:', texture, error);
          }
        );
      }
    } else {
      this.currentTexturePath = null;
      this.material.map = texture;
      this.material.needsUpdate = true;
    }
    return this;
  }

  /**
   * 틴트 색상 설정
   */
  setColor(color: number): this {
    this.material.color.setHex(color);
    return this;
  }

  /**
   * 투명도 설정
   */
  setOpacity(opacity: number): this {
    this.material.opacity = opacity;
    return this;
  }

  override setSize(width: number, height: number): this {
    this._width = width;
    this._height = height;

    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(width, height);

    return this;
  }

  override getInteractiveMeshes(): THREE.Mesh[] {
    return [this.mesh];
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.remove(this.mesh);
  }
}

/**
 * 텍스처 캐시 클리어
 */
export function clearTextureCache(): void {
  for (const texture of textureCache.values()) {
    texture.dispose();
  }
  textureCache.clear();
}
