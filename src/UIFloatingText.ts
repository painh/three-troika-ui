import { UIText } from './UIText';

export interface UIFloatingTextConfig {
  text: string;
  fontSize?: number;
  color?: number | string;
  /** 위로 떠오르는 속도 (units/sec) */
  floatSpeed?: number;
  /** 애니메이션 지속 시간 (초) */
  duration?: number;
  /** 페이드아웃 시작 시간 비율 (0-1) */
  fadeStartRatio?: number;
  /** 외곽선 너비 */
  outlineWidth?: number;
  /** 외곽선 색상 */
  outlineColor?: number | string;
  /** 완료 시 콜백 */
  onComplete?: () => void;
}

/**
 * 떠오르면서 사라지는 텍스트 (데미지 표시 등)
 */
export class UIFloatingText extends UIText {
  private floatSpeed: number;
  private duration: number;
  private fadeStartRatio: number;
  private elapsed: number = 0;
  private isComplete: boolean = false;
  private onCompleteCallback: (() => void) | null = null;
  private initialY: number = 0;

  constructor(config: UIFloatingTextConfig) {
    super({
      text: config.text,
      fontSize: config.fontSize ?? 0.3,
      color: config.color ?? 0xff4444,
      anchorX: 'center',
      anchorY: 'middle',
      outlineWidth: config.outlineWidth ?? 0.02,
      outlineColor: config.outlineColor ?? 0x000000,
    });

    this.floatSpeed = config.floatSpeed ?? 1.5;
    this.duration = config.duration ?? 1.0;
    this.fadeStartRatio = config.fadeStartRatio ?? 0.3;
    this.onCompleteCallback = config.onComplete ?? null;
  }

  /**
   * 초기 위치 설정 (애니메이션 시작 시 호출)
   */
  setInitialPosition(x: number, y: number, z: number = 0): this {
    this.position.set(x, y, z);
    this.initialY = y;
    return this;
  }

  /**
   * 매 프레임 업데이트
   */
  override update(deltaTime: number): void {
    if (this.isComplete) return;

    this.elapsed += deltaTime;

    // 위로 떠오르기
    this.position.y = this.initialY + this.elapsed * this.floatSpeed;

    // 페이드아웃
    const fadeStartTime = this.duration * this.fadeStartRatio;
    if (this.elapsed > fadeStartTime) {
      const fadeProgress = (this.elapsed - fadeStartTime) / (this.duration - fadeStartTime);
      const opacity = Math.max(0, 1 - fadeProgress);
      this.setOpacity(opacity);
    }

    // 완료 체크
    if (this.elapsed >= this.duration) {
      this.isComplete = true;
      this.visible = false;
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }
    }
  }

  /**
   * 투명도 설정
   */
  private setOpacity(opacity: number): void {
    this.traverse((child) => {
      if ((child as any).material) {
        const material = (child as any).material;
        material.opacity = opacity;
        material.transparent = true;
      }
    });
  }

  /**
   * 애니메이션 완료 여부
   */
  get complete(): boolean {
    return this.isComplete;
  }

  /**
   * 리셋 (재사용 시)
   */
  reset(config: Partial<UIFloatingTextConfig>): this {
    this.elapsed = 0;
    this.isComplete = false;
    this.visible = true;
    this.setOpacity(1);

    if (config.text !== undefined) {
      this.setText(config.text);
    }
    if (config.color !== undefined) {
      this.setColor(config.color);
    }
    if (config.fontSize !== undefined) {
      this.setFontSize(config.fontSize);
    }
    if (config.floatSpeed !== undefined) {
      this.floatSpeed = config.floatSpeed;
    }
    if (config.duration !== undefined) {
      this.duration = config.duration;
    }
    if (config.onComplete !== undefined) {
      this.onCompleteCallback = config.onComplete;
    }

    return this;
  }
}
