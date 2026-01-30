import * as THREE from 'three';
import { UIElement } from './UIElement';
import { UIBox } from './UIBox';

export type LayoutDirection = 'horizontal' | 'vertical';
export type LayoutAlign = 'start' | 'center' | 'end';
export type LayoutJustify = 'start' | 'center' | 'end' | 'space-between' | 'space-around';

export interface UIPanelConfig {
  width?: number;
  height?: number;
  padding?: number | [number, number, number, number]; // top, right, bottom, left
  gap?: number;
  direction?: LayoutDirection;
  align?: LayoutAlign; // 교차축 정렬
  justify?: LayoutJustify; // 주축 정렬
  backgroundColor?: number;
  backgroundOpacity?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: number;
  autoSize?: boolean; // 자식에 맞게 자동 크기 조절
}

/**
 * 레이아웃을 지원하는 컨테이너 패널
 */
export class UIPanel extends UIElement {
  private background: UIBox | null = null;
  private _children: UIElement[] = [];

  private _padding: [number, number, number, number] = [0, 0, 0, 0];
  private _gap: number = 0;
  private _direction: LayoutDirection = 'vertical';
  private _align: LayoutAlign = 'center';
  private _justify: LayoutJustify = 'start';
  private _autoSize: boolean = false;

  constructor(config: UIPanelConfig = {}) {
    super();

    this._width = config.width ?? 1;
    this._height = config.height ?? 1;
    this._gap = config.gap ?? 0;
    this._direction = config.direction ?? 'vertical';
    this._align = config.align ?? 'center';
    this._justify = config.justify ?? 'start';
    this._autoSize = config.autoSize ?? false;

    // 패딩 설정
    if (config.padding !== undefined) {
      if (typeof config.padding === 'number') {
        this._padding = [config.padding, config.padding, config.padding, config.padding];
      } else {
        this._padding = config.padding;
      }
    }

    // 배경이 있는 경우
    if (config.backgroundColor !== undefined || config.borderWidth) {
      this.background = new UIBox({
        width: this._width,
        height: this._height,
        color: config.backgroundColor ?? 0x000000,
        opacity: config.backgroundOpacity ?? 1,
        borderRadius: config.borderRadius ?? 0,
        borderWidth: config.borderWidth ?? 0,
        borderColor: config.borderColor ?? 0xffffff,
      });
      super.add(this.background);
    }

    this.interactive = true;
  }

  /**
   * 자식 요소 추가
   */
  addChild(element: UIElement): this {
    this._children.push(element);
    super.add(element);
    this.layout();
    return this;
  }

  /**
   * 자식 요소 제거
   */
  removeChild(element: UIElement): this {
    const index = this._children.indexOf(element);
    if (index !== -1) {
      this._children.splice(index, 1);
      super.remove(element);
      this.layout();
    }
    return this;
  }

  /**
   * 모든 자식 요소 제거
   */
  clearChildren(): this {
    for (const child of this._children) {
      super.remove(child);
    }
    this._children = [];
    this.layout();
    return this;
  }

  /**
   * 자식 요소 가져오기
   */
  getChildren(): UIElement[] {
    return [...this._children];
  }

  /**
   * 레이아웃 재계산
   */
  layout(): void {
    if (this._children.length === 0) return;

    const [paddingTop, paddingRight, paddingBottom, paddingLeft] = this._padding;
    const contentWidth = this._width - paddingLeft - paddingRight;
    const contentHeight = this._height - paddingTop - paddingBottom;

    // 자식들의 총 크기 계산
    let totalMainSize = 0;
    let maxCrossSize = 0;

    for (const child of this._children) {
      if (this._direction === 'horizontal') {
        totalMainSize += child.width;
        maxCrossSize = Math.max(maxCrossSize, child.height);
      } else {
        totalMainSize += child.height;
        maxCrossSize = Math.max(maxCrossSize, child.width);
      }
    }
    totalMainSize += this._gap * (this._children.length - 1);

    // autoSize면 크기 조절
    if (this._autoSize) {
      if (this._direction === 'horizontal') {
        this._width = totalMainSize + paddingLeft + paddingRight;
        this._height = maxCrossSize + paddingTop + paddingBottom;
      } else {
        this._width = maxCrossSize + paddingLeft + paddingRight;
        this._height = totalMainSize + paddingTop + paddingBottom;
      }
      if (this.background) {
        this.background.setSize(this._width, this._height);
      }
    }

    // 시작 위치 계산 (주축)
    let mainPos: number;
    const mainSize = this._direction === 'horizontal' ? contentWidth : contentHeight;
    const mainStart = this._direction === 'horizontal' ? -this._width / 2 + paddingLeft : this._height / 2 - paddingTop;

    let spacing = this._gap;

    switch (this._justify) {
      case 'start':
        mainPos = mainStart;
        break;
      case 'center':
        mainPos = mainStart + (mainSize - totalMainSize) / 2;
        break;
      case 'end':
        mainPos = mainStart + mainSize - totalMainSize;
        break;
      case 'space-between':
        mainPos = mainStart;
        if (this._children.length > 1) {
          spacing = (mainSize - (totalMainSize - this._gap * (this._children.length - 1))) / (this._children.length - 1);
        }
        break;
      case 'space-around':
        spacing = (mainSize - (totalMainSize - this._gap * (this._children.length - 1))) / (this._children.length + 1);
        mainPos = mainStart + spacing;
        break;
    }

    // 자식들 배치
    for (const child of this._children) {
      const childMainSize = this._direction === 'horizontal' ? child.width : child.height;
      const childCrossSize = this._direction === 'horizontal' ? child.height : child.width;

      // 교차축 위치
      let crossPos: number;

      switch (this._align) {
        case 'start':
          if (this._direction === 'horizontal') {
            // horizontal: Y축이 교차축, start = bottom
            crossPos = -this._height / 2 + paddingBottom + childCrossSize / 2;
          } else {
            // vertical: X축이 교차축, start = left
            crossPos = -this._width / 2 + paddingLeft + childCrossSize / 2;
          }
          break;
        case 'center':
          crossPos = 0; // 중앙 정렬
          break;
        case 'end':
          if (this._direction === 'horizontal') {
            // horizontal: Y축이 교차축, end = top
            crossPos = this._height / 2 - paddingTop - childCrossSize / 2;
          } else {
            // vertical: X축이 교차축, end = right
            crossPos = this._width / 2 - paddingRight - childCrossSize / 2;
          }
          break;
      }

      // 위치 설정
      if (this._direction === 'horizontal') {
        child.position.x = mainPos + childMainSize / 2;
        child.position.y = crossPos;
        mainPos += childMainSize + spacing;
      } else {
        child.position.x = crossPos;
        child.position.y = mainPos - childMainSize / 2;
        mainPos -= childMainSize + spacing;
      }

      // z는 배경 위
      child.position.z = 0.01;
    }
  }

  /**
   * 방향 설정
   */
  setDirection(direction: LayoutDirection): this {
    this._direction = direction;
    this.layout();
    return this;
  }

  /**
   * 정렬 설정
   */
  setAlign(align: LayoutAlign): this {
    this._align = align;
    this.layout();
    return this;
  }

  /**
   * 주축 정렬 설정
   */
  setJustify(justify: LayoutJustify): this {
    this._justify = justify;
    this.layout();
    return this;
  }

  /**
   * 간격 설정
   */
  setGap(gap: number): this {
    this._gap = gap;
    this.layout();
    return this;
  }

  /**
   * 패딩 설정
   */
  setPadding(padding: number | [number, number, number, number]): this {
    if (typeof padding === 'number') {
      this._padding = [padding, padding, padding, padding];
    } else {
      this._padding = padding;
    }
    this.layout();
    return this;
  }

  /**
   * 배경색 설정
   */
  setBackgroundColor(color: number): this {
    if (this.background) {
      this.background.setColor(color);
    }
    return this;
  }

  /**
   * 테두리 설정
   */
  setBorder(width: number, color: number): this {
    if (this.background) {
      this.background.setBorder(width, color);
    }
    return this;
  }

  override setSize(width: number, height: number): this {
    this._width = width;
    this._height = height;
    if (this.background) {
      this.background.setSize(width, height);
    }
    this.layout();
    return this;
  }

  override getInteractiveMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    if (this.background) {
      meshes.push(...this.background.getInteractiveMeshes());
    }
    for (const child of this._children) {
      meshes.push(...child.getInteractiveMeshes());
    }
    return meshes;
  }

  override update(deltaTime?: number): void {
    for (const child of this._children) {
      child.update(deltaTime);
    }
  }

  dispose(): void {
    if (this.background) {
      this.background.dispose();
      super.remove(this.background);
    }
    for (const child of this._children) {
      child.dispose();
      super.remove(child);
    }
    this._children = [];
  }
}
