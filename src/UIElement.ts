import * as THREE from 'three';

/**
 * UI 요소의 기본 클래스
 */
export abstract class UIElement extends THREE.Object3D {
  protected _width: number = 0;
  protected _height: number = 0;
  protected _needsUpdate: boolean = false;
  protected _anchor: { x: number; y: number } = { x: 0.5, y: 0.5 }; // 중앙 기준

  // 인터랙션
  public interactive: boolean = false;
  public hovered: boolean = false;

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  /**
   * 크기 설정
   */
  setSize(width: number, height: number): this {
    this._width = width;
    this._height = height;
    this._needsUpdate = true;
    return this;
  }

  /**
   * 앵커 설정 (0,0 = 좌하단, 1,1 = 우상단, 0.5,0.5 = 중앙)
   */
  setAnchor(x: number, y: number): this {
    this._anchor.x = x;
    this._anchor.y = y;
    this._needsUpdate = true;
    return this;
  }

  /**
   * UI 업데이트
   */
  update(_deltaTime?: number): void {
    // 기본 구현
  }

  /**
   * 리소스 정리
   */
  abstract dispose(): void;

  /**
   * 레이캐스트용 메시들 반환
   */
  getInteractiveMeshes(): THREE.Mesh[] {
    return [];
  }

  /**
   * 월드 좌표 기준 바운딩 박스 계산
   */
  getWorldBounds(): THREE.Box3 {
    const box = new THREE.Box3();
    const worldPos = new THREE.Vector3();
    this.getWorldPosition(worldPos);

    const offsetX = -this._width * this._anchor.x;
    const offsetY = -this._height * this._anchor.y;

    box.min.set(worldPos.x + offsetX, worldPos.y + offsetY, worldPos.z);
    box.max.set(worldPos.x + offsetX + this._width, worldPos.y + offsetY + this._height, worldPos.z);

    return box;
  }
}
