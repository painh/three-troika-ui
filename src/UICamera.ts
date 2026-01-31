import { OrthographicCamera, Scene, WebGLRenderer } from 'three';

export interface UICameraConfig {
  /** UI 월드 단위 너비 (기본: 20) */
  viewWidth?: number;
  /** UI 월드 단위 높이 (기본: 15) */
  viewHeight?: number;
  /** near plane (기본: 0.1) */
  near?: number;
  /** far plane (기본: 100) */
  far?: number;
}

/**
 * UI 전용 OrthographicCamera
 * - 게임 카메라(PerspectiveCamera)와 별도로 UI를 렌더링
 * - autoClear: false로 설정하여 게임 렌더링 위에 합성
 * - z-fighting 없이 일관된 UI 렌더링 제공
 */
export class UICamera {
  readonly camera: OrthographicCamera;

  private viewWidth: number;
  private viewHeight: number;

  constructor(config: UICameraConfig = {}) {
    this.viewWidth = config.viewWidth ?? 20;
    this.viewHeight = config.viewHeight ?? 15;
    const near = config.near ?? 0.1;
    const far = config.far ?? 100;

    const halfW = this.viewWidth / 2;
    const halfH = this.viewHeight / 2;

    this.camera = new OrthographicCamera(-halfW, halfW, halfH, -halfH, near, far);
    this.camera.position.set(0, 0, 50);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * 카메라 위치 설정 (게임 카메라와 동기화용)
   */
  setPosition(x: number, y: number): void {
    this.camera.position.x = x;
    this.camera.position.y = y;
  }

  /**
   * 뷰 크기 반환
   */
  getViewSize(): { width: number; height: number } {
    return { width: this.viewWidth, height: this.viewHeight };
  }

  /**
   * 화면 리사이즈 처리
   * 종횡비를 유지하면서 뷰 크기 조정
   */
  resize(screenWidth: number, screenHeight: number): void {
    const aspect = screenWidth / screenHeight;
    const targetAspect = this.viewWidth / this.viewHeight;

    let newWidth = this.viewWidth;
    let newHeight = this.viewHeight;

    if (aspect > targetAspect) {
      // 화면이 더 넓음 - 너비 확장
      newWidth = this.viewHeight * aspect;
    } else {
      // 화면이 더 높음 - 높이 확장
      newHeight = this.viewWidth / aspect;
    }

    const halfW = newWidth / 2;
    const halfH = newHeight / 2;

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  /**
   * UI 씬 렌더링 (게임 렌더링 후 호출)
   * autoClear를 false로 설정하여 기존 렌더링 위에 합성
   */
  render(renderer: WebGLRenderer, uiScene: Scene): void {
    // 깊이/컬러 버퍼 클리어 하지 않고 위에 렌더링
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    // 깊이 버퍼만 클리어 (UI가 게임 오브젝트 위에 그려지도록)
    renderer.clearDepth();
    renderer.render(uiScene, this.camera);

    renderer.autoClear = prevAutoClear;
  }

  /**
   * 스크린 좌표를 UI 월드 좌표로 변환
   */
  screenToWorld(
    screenX: number,
    screenY: number,
    screenWidth: number,
    screenHeight: number
  ): { x: number; y: number } {
    // NDC 좌표 계산
    const ndcX = (screenX / screenWidth) * 2 - 1;
    const ndcY = -(screenY / screenHeight) * 2 + 1;

    // OrthographicCamera의 뷰 범위 계산
    const viewWidth = this.camera.right - this.camera.left;
    const viewHeight = this.camera.top - this.camera.bottom;

    const worldX = this.camera.position.x + ndcX * (viewWidth / 2);
    const worldY = this.camera.position.y + ndcY * (viewHeight / 2);

    return { x: worldX, y: worldY };
  }

  /**
   * NDC 좌표를 UI 월드 좌표로 변환
   */
  ndcToWorld(ndcX: number, ndcY: number): { x: number; y: number } {
    const viewWidth = this.camera.right - this.camera.left;
    const viewHeight = this.camera.top - this.camera.bottom;

    const worldX = this.camera.position.x + ndcX * (viewWidth / 2);
    const worldY = this.camera.position.y + ndcY * (viewHeight / 2);

    return { x: worldX, y: worldY };
  }
}
