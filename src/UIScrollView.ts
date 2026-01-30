import * as THREE from 'three';
import { UIElement } from './UIElement';
import { UIBox } from './UIBox';

export interface UIScrollViewConfig {
  /** 뷰포트 너비 */
  width?: number;
  /** 뷰포트 높이 */
  height?: number;
  /** 콘텐츠 높이 (스크롤 가능한 전체 높이) */
  contentHeight?: number;
  /** 배경 색상 */
  backgroundColor?: number;
  /** 배경 투명도 */
  backgroundOpacity?: number;
  /** 모서리 둥글기 */
  borderRadius?: number;
  /** 스크롤바 표시 여부 */
  showScrollbar?: boolean;
  /** 스크롤바 너비 */
  scrollbarWidth?: number;
  /** 스크롤바 트랙 색상 */
  scrollbarTrackColor?: number;
  /** 스크롤바 썸 색상 */
  scrollbarThumbColor?: number;
  /** 스크롤바 썸 호버 색상 */
  scrollbarThumbHoverColor?: number;
  /** 스텐실 참조값 (다른 스크롤뷰와 구분) */
  stencilRef?: number;
}

/**
 * 스텐실 버퍼 기반 스크롤 뷰
 * 콘텐츠 클리핑 + 스크롤바 지원
 */
export class UIScrollView extends UIElement {
  private background: UIBox;
  private clipMask: THREE.Mesh;
  private contentContainer: THREE.Group;

  // 스크롤바
  private scrollbarTrack: THREE.Mesh | null = null;
  private scrollbarThumb: THREE.Mesh | null = null;
  private scrollbarThumbMaterial: THREE.MeshBasicMaterial | null = null;

  private config: Required<UIScrollViewConfig>;

  // 스크롤 상태
  private scrollOffset: number = 0;
  private _contentHeight: number;
  private viewportHeight: number;

  // 드래그 상태
  private _isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragStartScrollOffset: number = 0;
  private _isThumbHovered: boolean = false;

  // 스텐실 카운터
  private static stencilCounter: number = 1;

  constructor(config: UIScrollViewConfig = {}) {
    super();

    this.config = {
      width: config.width ?? 4,
      height: config.height ?? 3,
      contentHeight: config.contentHeight ?? 3,
      backgroundColor: config.backgroundColor ?? 0x1a1a2e,
      backgroundOpacity: config.backgroundOpacity ?? 0.95,
      borderRadius: config.borderRadius ?? 0.08,
      showScrollbar: config.showScrollbar ?? true,
      scrollbarWidth: config.scrollbarWidth ?? 0.15,
      scrollbarTrackColor: config.scrollbarTrackColor ?? 0x2c3e50,
      scrollbarThumbColor: config.scrollbarThumbColor ?? 0x7f8c8d,
      scrollbarThumbHoverColor: config.scrollbarThumbHoverColor ?? 0x95a5a6,
      stencilRef: config.stencilRef ?? UIScrollView.stencilCounter++,
    };

    this._width = this.config.width;
    this._height = this.config.height;
    this._contentHeight = this.config.contentHeight;
    this.viewportHeight = this.config.height;

    // 배경
    this.background = new UIBox({
      width: this.config.width,
      height: this.config.height,
      color: this.config.backgroundColor,
      opacity: this.config.backgroundOpacity,
      borderRadius: this.config.borderRadius,
    });
    this.add(this.background);

    // 클리핑 마스크 (스텐실)
    const maskGeometry = this.createRoundedRectGeometry(
      this.config.width - 0.1,
      this.config.height - 0.1,
      Math.max(0, this.config.borderRadius - 0.02)
    );
    const maskMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
    });
    maskMaterial.stencilWrite = true;
    maskMaterial.stencilRef = this.config.stencilRef;
    maskMaterial.stencilFunc = THREE.AlwaysStencilFunc;
    maskMaterial.stencilZPass = THREE.ReplaceStencilOp;

    this.clipMask = new THREE.Mesh(maskGeometry, maskMaterial);
    this.clipMask.position.z = 0.01;
    this.clipMask.renderOrder = 0;
    this.add(this.clipMask);

    // 콘텐츠 컨테이너
    this.contentContainer = new THREE.Group();
    this.contentContainer.position.z = 0.02;
    this.add(this.contentContainer);

    // 스크롤바 생성
    if (this.config.showScrollbar) {
      this.createScrollbar();
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
   * 스크롤바 생성
   */
  private createScrollbar(): void {
    const scrollbarHeight = this.config.height - 0.2;
    const scrollbarX = this.config.width / 2 - this.config.scrollbarWidth / 2 - 0.1;

    // 트랙
    const trackGeometry = new THREE.PlaneGeometry(this.config.scrollbarWidth, scrollbarHeight);
    const trackMaterial = new THREE.MeshBasicMaterial({
      color: this.config.scrollbarTrackColor,
      transparent: true,
      opacity: 0.5,
    });
    this.scrollbarTrack = new THREE.Mesh(trackGeometry, trackMaterial);
    this.scrollbarTrack.position.set(scrollbarX, 0, 0.03);
    this.add(this.scrollbarTrack);

    // 썸
    this.scrollbarThumbMaterial = new THREE.MeshBasicMaterial({
      color: this.config.scrollbarThumbColor,
      transparent: true,
      opacity: 0.8,
    });
    const thumbGeometry = new THREE.PlaneGeometry(this.config.scrollbarWidth - 0.02, 0.5);
    this.scrollbarThumb = new THREE.Mesh(thumbGeometry, this.scrollbarThumbMaterial);
    this.scrollbarThumb.position.set(scrollbarX, 0, 0.04);
    this.add(this.scrollbarThumb);

    this.updateScrollbar();
  }

  /**
   * 스크롤바 업데이트
   */
  private updateScrollbar(): void {
    if (!this.scrollbarThumb) return;

    const scrollbarHeight = this.config.height - 0.2;
    const maxScroll = Math.max(0, this._contentHeight - this.viewportHeight);

    // 썸 높이 계산
    const thumbRatio = Math.min(1, this.viewportHeight / this._contentHeight);
    const thumbHeight = Math.max(0.3, scrollbarHeight * thumbRatio);

    // 썸 위치 계산
    const scrollRatio = maxScroll > 0 ? this.scrollOffset / maxScroll : 0;
    const thumbRange = scrollbarHeight - thumbHeight;
    const thumbY = (scrollbarHeight / 2 - thumbHeight / 2) - scrollRatio * thumbRange;

    // 썸 지오메트리 업데이트
    this.scrollbarThumb.geometry.dispose();
    this.scrollbarThumb.geometry = new THREE.PlaneGeometry(this.config.scrollbarWidth - 0.02, thumbHeight);
    this.scrollbarThumb.position.y = thumbY;

    // 스크롤 불필요 시 숨김
    const needsScroll = this._contentHeight > this.viewportHeight;
    if (this.scrollbarTrack) this.scrollbarTrack.visible = needsScroll;
    this.scrollbarThumb.visible = needsScroll;
  }

  /**
   * 콘텐츠 추가
   */
  addContent(element: THREE.Object3D): this {
    // 스텐실 테스트 설정
    element.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (mat) {
            mat.stencilWrite = false;
            mat.stencilRef = this.config.stencilRef;
            mat.stencilFunc = THREE.EqualStencilFunc;
          }
        });
        mesh.renderOrder = 1;
      }
    });

    this.contentContainer.add(element);
    return this;
  }

  /**
   * 콘텐츠 제거
   */
  removeContent(element: THREE.Object3D): this {
    this.contentContainer.remove(element);
    return this;
  }

  /**
   * 모든 콘텐츠 제거
   */
  clearContent(): this {
    while (this.contentContainer.children.length > 0) {
      this.contentContainer.remove(this.contentContainer.children[0]);
    }
    return this;
  }

  /**
   * 콘텐츠 높이 설정
   */
  setContentHeight(height: number): this {
    this._contentHeight = height;
    this.scrollOffset = Math.min(this.scrollOffset, Math.max(0, height - this.viewportHeight));
    this.updateContentPosition();
    this.updateScrollbar();
    return this;
  }

  /**
   * 스크롤 (deltaY 기반)
   */
  scroll(delta: number): this {
    const maxScroll = Math.max(0, this._contentHeight - this.viewportHeight);
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset + delta));
    this.updateContentPosition();
    this.updateScrollbar();
    return this;
  }

  /**
   * 스크롤 위치 설정 (0~1 비율)
   */
  setScrollPosition(ratio: number): this {
    const maxScroll = Math.max(0, this._contentHeight - this.viewportHeight);
    this.scrollOffset = maxScroll * Math.max(0, Math.min(1, ratio));
    this.updateContentPosition();
    this.updateScrollbar();
    return this;
  }

  /**
   * 콘텐츠 위치 업데이트
   */
  private updateContentPosition(): void {
    // 콘텐츠를 위로 이동 (스크롤 다운 = 콘텐츠 위로)
    const topY = this.viewportHeight / 2;
    this.contentContainer.position.y = topY + this.scrollOffset;
  }

  /**
   * 스크롤바 드래그 시작
   */
  startDrag(localY: number): void {
    this._isDragging = true;
    this.dragStartY = localY;
    this.dragStartScrollOffset = this.scrollOffset;
  }

  /**
   * 스크롤바 드래그 중
   */
  updateDrag(localY: number): void {
    if (!this._isDragging) return;

    const deltaY = this.dragStartY - localY;
    const scrollbarHeight = this.config.height - 0.2;
    const thumbRatio = Math.min(1, this.viewportHeight / this._contentHeight);
    const thumbHeight = Math.max(0.3, scrollbarHeight * thumbRatio);
    const thumbRange = scrollbarHeight - thumbHeight;

    if (thumbRange > 0) {
      const maxScroll = this._contentHeight - this.viewportHeight;
      const scrollDelta = (deltaY / thumbRange) * maxScroll;
      this.scrollOffset = Math.max(0, Math.min(maxScroll, this.dragStartScrollOffset + scrollDelta));
      this.updateContentPosition();
      this.updateScrollbar();
    }
  }

  /**
   * 스크롤바 드래그 종료
   */
  endDrag(): void {
    this._isDragging = false;
  }

  /**
   * 스크롤바 썸 호버 상태 설정
   */
  setThumbHovered(hovered: boolean): this {
    if (this._isThumbHovered === hovered) return this;
    this._isThumbHovered = hovered;

    if (this.scrollbarThumbMaterial) {
      this.scrollbarThumbMaterial.color.setHex(
        hovered ? this.config.scrollbarThumbHoverColor : this.config.scrollbarThumbColor
      );
    }
    return this;
  }

  get isDragging(): boolean {
    return this._isDragging;
  }

  get contentHeight(): number {
    return this._contentHeight;
  }

  get scrollRatio(): number {
    const maxScroll = Math.max(0, this._contentHeight - this.viewportHeight);
    return maxScroll > 0 ? this.scrollOffset / maxScroll : 0;
  }

  /**
   * 스크롤바 썸 메시 반환 (레이캐스트용)
   */
  getScrollbarThumb(): THREE.Mesh | null {
    return this.scrollbarThumb;
  }

  /**
   * 콘텐츠 컨테이너 반환
   */
  getContentContainer(): THREE.Group {
    return this.contentContainer;
  }

  /**
   * 스텐실 참조값 반환
   */
  getStencilRef(): number {
    return this.config.stencilRef;
  }

  override getInteractiveMeshes(): THREE.Mesh[] {
    const meshes = this.background.getInteractiveMeshes();
    if (this.scrollbarThumb) meshes.push(this.scrollbarThumb);
    return meshes;
  }

  dispose(): void {
    this.background.dispose();
    this.clipMask.geometry.dispose();
    (this.clipMask.material as THREE.Material).dispose();

    if (this.scrollbarTrack) {
      this.scrollbarTrack.geometry.dispose();
      (this.scrollbarTrack.material as THREE.Material).dispose();
    }
    if (this.scrollbarThumb) {
      this.scrollbarThumb.geometry.dispose();
    }
    if (this.scrollbarThumbMaterial) {
      this.scrollbarThumbMaterial.dispose();
    }
  }
}
