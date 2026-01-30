import { UIElement } from './UIElement';
import { UIText } from './UIText';
import { UIBox } from './UIBox';

export interface UITooltipConfig {
  /** 배경 색상 */
  backgroundColor?: number;
  /** 배경 투명도 */
  backgroundOpacity?: number;
  /** 테두리 색상 */
  borderColor?: number;
  /** 테두리 두께 */
  borderWidth?: number;
  /** 테두리 radius */
  borderRadius?: number;
  /** 패딩 */
  padding?: number;
  /** 최대 너비 */
  maxWidth?: number;
  /** 기본 폰트 크기 */
  fontSize?: number;
  /** 기본 텍스트 색상 */
  textColor?: number;
  /** 화면 경계 체크용 뷰 크기 */
  viewBounds?: { width: number; height: number };
  /** 타겟으로부터 떨어질 거리 */
  offset?: { x: number; y: number };
}

export interface TooltipLine {
  text: string;
  color?: number;
  fontSize?: number;
}

/**
 * 범용 툴팁 컴포넌트
 * - 내용에 맞게 자동 크기 조절
 * - 화면 경계 체크로 위치 자동 조절
 * - 패딩 지원
 */
export class UITooltip extends UIElement {
  private background: UIBox;
  private textElements: UIText[] = [];
  private textPool: UIText[] = [];

  private config: Required<UITooltipConfig>;
  private lines: TooltipLine[] = [];
  private contentWidth: number = 0;
  private contentHeight: number = 0;

  // 화면 경계
  private viewBounds: { width: number; height: number } | null = null;

  // 앵커 위치 (슬롯 위치 기준)
  private anchorX: number = 0;
  private anchorY: number = 0;

  constructor(config: UITooltipConfig = {}) {
    super();

    this.config = {
      backgroundColor: config.backgroundColor ?? 0x1a1a1a,
      backgroundOpacity: config.backgroundOpacity ?? 0.95,
      borderColor: config.borderColor ?? 0x444444,
      borderWidth: config.borderWidth ?? 0.02,
      borderRadius: config.borderRadius ?? 0.04,
      padding: config.padding ?? 0.1,
      maxWidth: config.maxWidth ?? 2.5,
      fontSize: config.fontSize ?? 0.12,
      textColor: config.textColor ?? 0xffffff,
      viewBounds: config.viewBounds ?? { width: 20, height: 15 },
      offset: config.offset ?? { x: 0.3, y: 0.3 },
    };

    this.viewBounds = this.config.viewBounds;

    // 배경 생성
    this.background = new UIBox({
      width: 1,
      height: 1,
      color: this.config.backgroundColor,
      opacity: this.config.backgroundOpacity,
      borderRadius: this.config.borderRadius,
      borderWidth: this.config.borderWidth,
      borderColor: this.config.borderColor,
    });
    this.add(this.background);

    this.visible = false;
  }

  /**
   * 화면 경계 설정
   */
  setViewBounds(width: number, height: number): this {
    this.viewBounds = { width, height };
    return this;
  }

  /**
   * 테두리 색상 설정
   */
  setBorderColor(color: number): this {
    this.background.setBorder(this.config.borderWidth, color);
    return this;
  }

  /**
   * 툴팁 내용 설정 (여러 줄)
   */
  setContent(lines: TooltipLine[]): this {
    this.lines = lines;
    this.rebuildContent();
    return this;
  }

  /**
   * 단일 텍스트로 설정
   */
  setText(text: string, color?: number): this {
    return this.setContent([{ text, color }]);
  }

  /**
   * 내용 다시 빌드
   */
  private rebuildContent(): void {
    // 기존 텍스트를 풀로 반환
    for (const text of this.textElements) {
      this.remove(text);
      this.textPool.push(text);
    }
    this.textElements = [];

    if (this.lines.length === 0) {
      this.visible = false;
      return;
    }

    const padding = this.config.padding;
    const lineHeight = this.config.fontSize * 1.4;
    let maxTextWidth = 0;
    let yPos = 0;

    // 텍스트 생성
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const text = this.getTextFromPool();

      text.setText(line.text);
      text.setColor(line.color ?? this.config.textColor);
      text.setFontSize(line.fontSize ?? this.config.fontSize);
      text.setAlign('left', 'top');

      // 텍스트 너비 추정 (대략적)
      const estimatedWidth = line.text.length * (line.fontSize ?? this.config.fontSize) * 0.5;
      maxTextWidth = Math.max(maxTextWidth, Math.min(estimatedWidth, this.config.maxWidth - padding * 2));

      this.textElements.push(text);
      this.add(text);

      yPos += lineHeight;
    }

    // 컨텐츠 크기 계산
    this.contentWidth = Math.min(maxTextWidth + padding * 2, this.config.maxWidth);
    this.contentHeight = yPos + padding * 2;

    // 배경 크기 업데이트
    this.background.setSize(this.contentWidth, this.contentHeight);

    // 텍스트 위치 조정 (배경 내부, 왼쪽 상단 기준)
    const startX = -this.contentWidth / 2 + padding;
    const startY = this.contentHeight / 2 - padding;
    let currentY = startY;

    for (let i = 0; i < this.textElements.length; i++) {
      const text = this.textElements[i];
      const fontSize = this.lines[i].fontSize ?? this.config.fontSize;
      text.position.set(startX, currentY, 0.01);
      currentY -= fontSize * 1.4;
    }

    this.visible = true;
  }

  /**
   * 텍스트 풀에서 가져오기
   */
  private getTextFromPool(): UIText {
    if (this.textPool.length > 0) {
      return this.textPool.pop()!;
    }
    return new UIText({
      text: '',
      fontSize: this.config.fontSize,
      color: this.config.textColor,
      anchorX: 'left',
      anchorY: 'top',
    });
  }

  /**
   * 앵커 위치 설정 (슬롯/아이템 위치)
   * 이 위치를 기준으로 툴팁이 배치됨
   */
  setAnchorPosition(x: number, y: number): this {
    this.anchorX = x;
    this.anchorY = y;
    this.updatePosition();
    return this;
  }

  /**
   * 화면 경계를 고려하여 위치 업데이트
   */
  private updatePosition(): void {
    if (!this.viewBounds) {
      this.position.set(this.anchorX + this.config.offset.x, this.anchorY + this.config.offset.y, 10);
      return;
    }

    const halfViewW = this.viewBounds.width / 2;
    const halfViewH = this.viewBounds.height / 2;
    const halfW = this.contentWidth / 2;
    const halfH = this.contentHeight / 2;
    const offset = this.config.offset;

    // 기본: 오른쪽 위에 배치
    let tooltipX = this.anchorX + offset.x + halfW;
    let tooltipY = this.anchorY + offset.y + halfH;

    // 오른쪽 경계 체크 - 왼쪽으로 이동
    if (tooltipX + halfW > halfViewW) {
      tooltipX = this.anchorX - offset.x - halfW;
    }

    // 왼쪽 경계 체크
    if (tooltipX - halfW < -halfViewW) {
      tooltipX = -halfViewW + halfW + 0.1;
    }

    // 위쪽 경계 체크 - 아래로 이동
    if (tooltipY + halfH > halfViewH) {
      tooltipY = this.anchorY - offset.y - halfH;
    }

    // 아래쪽 경계 체크
    if (tooltipY - halfH < -halfViewH) {
      tooltipY = -halfViewH + halfH + 0.1;
    }

    this.position.set(tooltipX, tooltipY, 10);
  }

  /**
   * 툴팁 표시
   */
  show(): this {
    this.visible = true;
    return this;
  }

  /**
   * 툴팁 숨기기
   */
  hide(): this {
    this.visible = false;
    return this;
  }

  /**
   * 표시 여부
   */
  get isVisible(): boolean {
    return this.visible;
  }

  override update(_deltaTime?: number): void {
    // 자동 업데이트
  }

  /**
   * 렌더 순서 설정
   */
  setRenderOrder(order: number): this {
    this.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as any;
        mesh.renderOrder = order;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat: any) => {
          if (mat) {
            mat.depthTest = false;
            mat.depthWrite = false;
          }
        });
      }
    });
    return this;
  }

  dispose(): void {
    for (const text of this.textElements) {
      text.dispose();
    }
    for (const text of this.textPool) {
      text.dispose();
    }
    this.background.dispose();
    this.textElements = [];
    this.textPool = [];
  }
}
