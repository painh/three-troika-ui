import {
  Group,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  RingGeometry,
  CircleGeometry,
  TextureLoader,
  Texture,
  DoubleSide,
  SRGBColorSpace,
  BufferGeometry,
  BufferAttribute,
} from 'three';
import { UIText } from './UIText';

export interface UICircularGaugeConfig {
  size: number; // 전체 크기
  innerRadius: number; // 내부 원 반지름 (아이콘 영역)
  outerRadius: number; // 외부 반지름 (게이지 끝)
  backgroundColor?: number; // 게이지 배경 색상 (채워지지 않은 부분)
  fillColor?: number; // 채워지는 색상
  innerBackgroundColor?: number; // 내부 원(아이콘 배경) 색상
  readyGlowColor?: number; // 준비 완료 시 발광 색상
  icon?: string; // 아이콘 경로
  label?: string; // 하단 라벨
  segments?: number; // 원 세그먼트 수 (부드러움)
  tooltipTitle?: string; // 툴팁 제목
  tooltipDescription?: string; // 툴팁 설명
  // 테두리 옵션 (4면 프레임 - 안쪽/바깥쪽 호 + 시작/끝 캡)
  borderColor?: number; // 테두리 색상
  borderThickness?: number; // 테두리 두께 (world units)
}

/**
 * 원형 게이지 UI
 * - 아이콘 주변에 원형으로 쿨다운/게이지 표시
 * - 준비 완료 시 발광 효과
 * - 내부/외부 테두리 지원
 */
export class UICircularGauge extends Group {
  private config: Required<
    Pick<
      UICircularGaugeConfig,
      | 'size'
      | 'innerRadius'
      | 'outerRadius'
      | 'backgroundColor'
      | 'fillColor'
      | 'innerBackgroundColor'
      | 'readyGlowColor'
      | 'segments'
      | 'borderColor'
      | 'borderThickness'
    >
  > &
    UICircularGaugeConfig;

  // 배경 링
  private backgroundRing: Mesh;
  private backgroundMaterial: MeshBasicMaterial;

  // 게이지 링 (진행 표시)
  private gaugeRing: Mesh;
  private gaugeMaterial: MeshBasicMaterial;

  // 중앙 아이콘 배경
  private iconBackground: Mesh;
  private iconBackgroundMaterial: MeshBasicMaterial;

  // 아이콘
  private iconMesh: Mesh | null = null;
  private iconMaterial: MeshBasicMaterial | null = null;
  private iconTexture: Texture | null = null;

  // 하단 라벨
  private labelText: UIText | null = null;

  // 준비 완료 글로우
  private glowRing: Mesh;
  private glowMaterial: MeshBasicMaterial;

  // 상태
  private progress: number = 0; // 0~1
  private isReady: boolean = false;
  private glowPulse: number = 0;

  // Sweep + Trail 효과
  private sweepRing: Mesh | null = null;
  private sweepMaterial: MeshBasicMaterial | null = null;
  private sweepAngle: number = 0; // 현재 sweep 각도
  private isSweeping: boolean = false;
  private sweepSpeed: number = 8; // 라디안/초 (약 0.8초에 한 바퀴)

  // 키 힌트
  private keyHint: UIText | null = null;

  // 툴팁 정보
  private tooltipTitle: string = '';
  private tooltipDescription: string = '';

  // 클릭 콜백
  private onClickCallback: (() => void) | null = null;

  // 호버 상태
  private _isHovered: boolean = false;

  // 테두리 (4면 프레임 - 안쪽/바깥쪽 호 + 시작/끝 캡)
  private borderMesh: Mesh | null = null;
  private borderMaterial: MeshBasicMaterial | null = null;

  constructor(config: UICircularGaugeConfig) {
    super();

    this.config = {
      backgroundColor: 0x333333,
      fillColor: 0x00aaff,
      innerBackgroundColor: 0x1a1a2e,
      readyGlowColor: 0xffaa00,
      segments: 64,
      borderColor: 0x666666,
      borderThickness: 0.02,
      ...config,
    };

    const { innerRadius, outerRadius, segments, borderThickness } = this.config;

    // 테두리 안쪽으로 fill 영역 축소 (삐져나옴 방지)
    const fillInnerRadius = innerRadius + borderThickness;
    const fillOuterRadius = outerRadius - borderThickness;

    // 배경 링 (전체 원)
    const bgGeometry = new RingGeometry(innerRadius, outerRadius, segments!);
    this.backgroundMaterial = new MeshBasicMaterial({
      color: this.config.backgroundColor,
      side: DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    this.backgroundRing = new Mesh(bgGeometry, this.backgroundMaterial);
    this.backgroundRing.position.z = 0;
    this.add(this.backgroundRing);

    // 게이지 링 (진행 표시) - 초기에는 빈 상태, 테두리 안쪽 영역
    const gaugeGeometry = new RingGeometry(
      fillInnerRadius,
      fillOuterRadius,
      segments!,
      1,
      0,
      0
    );
    this.gaugeMaterial = new MeshBasicMaterial({
      color: this.config.fillColor,
      side: DoubleSide,
      transparent: true,
      opacity: 1.0,
    });
    this.gaugeRing = new Mesh(gaugeGeometry, this.gaugeMaterial);
    this.gaugeRing.position.z = 0.01;
    this.gaugeRing.rotation.z = Math.PI / 2; // 12시 방향에서 시작
    this.add(this.gaugeRing);

    // 글로우 링 (준비 완료 시)
    const glowGeometry = new RingGeometry(
      outerRadius,
      outerRadius + 0.1,
      segments!
    );
    this.glowMaterial = new MeshBasicMaterial({
      color: this.config.readyGlowColor,
      side: DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.glowRing = new Mesh(glowGeometry, this.glowMaterial);
    this.glowRing.position.z = 0.02;
    this.add(this.glowRing);

    // Sweep 링 (준비 완료 시 한 바퀴 도는 빛)
    this.createSweepRing();

    // 중앙 아이콘 배경 (원형)
    const iconBgGeometry = new CircleGeometry(innerRadius * 0.95, segments!);
    this.iconBackgroundMaterial = new MeshBasicMaterial({
      color: this.config.innerBackgroundColor,
      transparent: true,
      opacity: 0.9,
    });
    this.iconBackground = new Mesh(iconBgGeometry, this.iconBackgroundMaterial);
    this.iconBackground.position.z = 0.03;
    this.add(this.iconBackground);

    // 테두리 초기화 (progress에 따라 업데이트됨)
    this.createGaugeBorders();

    // 아이콘 로드
    if (config.icon) {
      this.loadIcon(config.icon);
    }

    // 하단 라벨
    if (config.label) {
      this.labelText = new UIText({
        text: config.label,
        fontSize: 0.2,
        color: 0xffffff,
        anchorX: 'center',
        anchorY: 'top',
      });
      this.labelText.position.set(0, -outerRadius - 0.15, 0.01);
      this.add(this.labelText);
    }

    // 툴팁 정보 설정
    this.tooltipTitle = config.tooltipTitle ?? '';
    this.tooltipDescription = config.tooltipDescription ?? '';
  }

  /**
   * 게이지 테두리 생성 (4면 프레임 - 안쪽/바깥쪽 호 + 시작/끝 캡)
   */
  private createGaugeBorders(): void {
    const { borderColor, borderThickness } = this.config;

    if (borderThickness <= 0) return;

    this.borderMaterial = new MeshBasicMaterial({
      color: borderColor,
      side: DoubleSide,
      transparent: true,
      opacity: 1,
      depthTest: false,
    });

    // 초기에는 빈 geometry
    const geometry = new BufferGeometry();
    this.borderMesh = new Mesh(geometry, this.borderMaterial);
    this.borderMesh.position.z = 0.015;
    this.borderMesh.rotation.z = Math.PI / 2; // 12시 방향에서 시작 (게이지와 동일)
    this.add(this.borderMesh);
  }

  /**
   * 테두리 지오메트리 업데이트 (4면 프레임)
   * - 안쪽 호 (innerRadius)
   * - 바깥쪽 호 (outerRadius)
   * - 시작 캡 (12시 방향)
   * - 끝 캡 (progress 끝 지점)
   */
  private updateBorderGeometry(): void {
    if (!this.borderMesh) return;

    const { innerRadius, outerRadius, segments, borderThickness } = this.config;

    if (borderThickness <= 0 || this.progress <= 0) {
      this.borderMesh.geometry.dispose();
      this.borderMesh.geometry = new BufferGeometry();
      return;
    }

    const thetaLength = this.progress * Math.PI * 2;
    const segmentCount = Math.max(4, Math.ceil((this.progress * segments) / 2));

    // 4개의 스트립을 합쳐서 테두리 프레임 생성
    const positions: number[] = [];
    const indices: number[] = [];

    // 1. 안쪽 호 (innerRadius ~ innerRadius + thickness)
    const innerR1 = innerRadius;
    const innerR2 = innerRadius + borderThickness;
    let vertexOffset = 0;

    for (let i = 0; i <= segmentCount; i++) {
      const angle = (i / segmentCount) * thetaLength;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // 안쪽 점
      positions.push(cos * innerR1, sin * innerR1, 0);
      // 바깥쪽 점
      positions.push(cos * innerR2, sin * innerR2, 0);

      if (i < segmentCount) {
        const base = vertexOffset + i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }
    vertexOffset = positions.length / 3;

    // 2. 바깥쪽 호 (outerRadius - thickness ~ outerRadius)
    const outerR1 = outerRadius - borderThickness;
    const outerR2 = outerRadius;

    for (let i = 0; i <= segmentCount; i++) {
      const angle = (i / segmentCount) * thetaLength;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // 안쪽 점
      positions.push(cos * outerR1, sin * outerR1, 0);
      // 바깥쪽 점
      positions.push(cos * outerR2, sin * outerR2, 0);

      if (i < segmentCount) {
        const base = vertexOffset + i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }
    vertexOffset = positions.length / 3;

    // 3. 시작/끝 캡은 게이지가 가득 차지 않았을 때만 그림 (100%면 완전한 원이므로 캡 불필요)
    const isFullCircle = this.progress >= 0.999;

    if (!isFullCircle) {
      // 3. 시작 캡 (angle = 0, 수직 직사각형)
      const startAngle = 0;
      const startCos = Math.cos(startAngle);
      const startSin = Math.sin(startAngle);

      // 시작 캡: innerRadius+thickness ~ outerRadius-thickness 구간
      positions.push(startCos * innerR2, startSin * innerR2, 0);
      positions.push(startCos * outerR1, startSin * outerR1, 0);
      positions.push(
        startCos * innerR2 - startSin * borderThickness,
        startSin * innerR2 + startCos * borderThickness,
        0
      );
      positions.push(
        startCos * outerR1 - startSin * borderThickness,
        startSin * outerR1 + startCos * borderThickness,
        0
      );

      indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
      indices.push(vertexOffset + 1, vertexOffset + 3, vertexOffset + 2);
      vertexOffset += 4;

      // 4. 끝 캡 (angle = thetaLength, 수직 직사각형)
      const endAngle = thetaLength;
      const endCos = Math.cos(endAngle);
      const endSin = Math.sin(endAngle);

      positions.push(endCos * innerR2, endSin * innerR2, 0);
      positions.push(endCos * outerR1, endSin * outerR1, 0);
      positions.push(
        endCos * innerR2 + endSin * borderThickness,
        endSin * innerR2 - endCos * borderThickness,
        0
      );
      positions.push(
        endCos * outerR1 + endSin * borderThickness,
        endSin * outerR1 - endCos * borderThickness,
        0
      );

      indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
      indices.push(vertexOffset + 1, vertexOffset + 3, vertexOffset + 2);
    }

    // BufferGeometry 생성
    this.borderMesh.geometry.dispose();
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(positions), 3)
    );
    geometry.setIndex(indices);
    this.borderMesh.geometry = geometry;
  }

  /**
   * Sweep 링 생성 (빛이 도는 효과용)
   */
  private createSweepRing(): void {
    const { innerRadius, outerRadius, segments } = this.config;

    // 작은 호(arc) 형태의 sweep - 약 45도 정도의 trail
    const sweepLength = Math.PI / 4; // 45도
    const sweepGeometry = new RingGeometry(
      innerRadius - 0.02,
      outerRadius + 0.08,
      Math.floor(segments! / 4),
      1,
      0,
      sweepLength
    );

    this.sweepMaterial = new MeshBasicMaterial({
      color: this.config.readyGlowColor,
      side: DoubleSide,
      transparent: true,
      opacity: 0,
    });

    this.sweepRing = new Mesh(sweepGeometry, this.sweepMaterial);
    this.sweepRing.position.z = 0.025;
    this.sweepRing.rotation.z = Math.PI / 2; // 12시 방향에서 시작
    this.add(this.sweepRing);
  }

  /**
   * Sweep 애니메이션 시작
   */
  private startSweep(): void {
    this.isSweeping = true;
    this.sweepAngle = 0;
    if (this.sweepMaterial) {
      this.sweepMaterial.opacity = 1.0;
    }
  }

  /**
   * Sweep 애니메이션 업데이트
   */
  private updateSweep(deltaTime: number): void {
    if (!this.isSweeping || !this.sweepRing || !this.sweepMaterial) return;

    // 각도 증가 (시계 방향 = 음의 방향)
    this.sweepAngle += this.sweepSpeed * deltaTime;

    // 회전 적용 (12시에서 시작, 시계방향)
    this.sweepRing.rotation.z = Math.PI / 2 - this.sweepAngle;

    // Trail 효과: sweep이 진행됨에 따라 opacity 변화
    // 처음엔 밝고, 끝날 때 fade out
    const progress = this.sweepAngle / (Math.PI * 2);

    if (progress < 0.7) {
      // 70%까지는 밝게 유지
      this.sweepMaterial.opacity = 1.0;
    } else {
      // 나머지 30%에서 fade out
      this.sweepMaterial.opacity = 1.0 - (progress - 0.7) / 0.3;
    }

    // 한 바퀴 완료
    if (this.sweepAngle >= Math.PI * 2) {
      this.isSweeping = false;
      this.sweepMaterial.opacity = 0;
      this.sweepAngle = 0;
    }
  }

  /**
   * 아이콘 로드
   */
  private loadIcon(path: string): void {
    const loader = new TextureLoader();
    loader.load(path, (texture) => {
      texture.colorSpace = SRGBColorSpace;
      this.iconTexture = texture;

      const iconSize = this.config.innerRadius * 1.4;
      const iconGeometry = new PlaneGeometry(iconSize, iconSize);
      this.iconMaterial = new MeshBasicMaterial({
        map: texture,
        transparent: true,
      });
      this.iconMesh = new Mesh(iconGeometry, this.iconMaterial);
      this.iconMesh.position.z = 0.04;
      this.add(this.iconMesh);
    });
  }

  /**
   * 진행도 설정 (0~1)
   */
  setProgress(progress: number): void {
    this.progress = Math.max(0, Math.min(1, progress));
    this.updateGaugeGeometry();
  }

  /**
   * 준비 완료 상태 설정
   */
  setReady(ready: boolean): void {
    // ready 상태로 전환될 때 sweep 시작
    if (ready && !this.isReady && !this.isSweeping) {
      this.startSweep();
    }

    this.isReady = ready;
    if (!ready) {
      this.glowMaterial.opacity = 0;
    }
  }

  /**
   * 게이지 색상 변경
   */
  setFillColor(color: number): void {
    this.gaugeMaterial.color.setHex(color);
  }

  /**
   * 테두리 색상 변경
   */
  setBorderColor(color: number): void {
    if (this.borderMaterial) {
      this.borderMaterial.color.setHex(color);
    }
  }

  /**
   * 키 힌트 표시
   */
  setKeyHint(key: string): void {
    if (this.keyHint) {
      this.keyHint.setText(key);
    } else {
      this.keyHint = new UIText({
        text: key,
        fontSize: 0.25,
        color: 0xffffff,
        anchorX: 'center',
        anchorY: 'middle',
        outlineWidth: 0.02,
        outlineColor: 0x000000,
      });
      this.keyHint.position.set(0, this.config.outerRadius + 0.25, 0.01);
      this.add(this.keyHint);
    }
  }

  /**
   * 라벨 텍스트 변경
   */
  setLabel(label: string): void {
    if (this.labelText) {
      this.labelText.setText(label);
    }
  }

  /**
   * 게이지 지오메트리 업데이트
   */
  private updateGaugeGeometry(): void {
    // 기존 지오메트리 삭제
    this.gaugeRing.geometry.dispose();

    // 테두리 안쪽으로 fill 영역 축소 (삐져나옴 방지)
    const fillInnerRadius = this.config.innerRadius + this.config.borderThickness;
    const fillOuterRadius = this.config.outerRadius - this.config.borderThickness;

    // 새 지오메트리 생성 (시계 방향으로 채워짐)
    const thetaLength = this.progress * Math.PI * 2;
    const newGeometry = new RingGeometry(
      fillInnerRadius,
      fillOuterRadius,
      this.config.segments!,
      1,
      0,
      thetaLength
    );
    this.gaugeRing.geometry = newGeometry;

    // 테두리도 함께 업데이트
    this.updateBorderGeometry();
  }

  /**
   * 업데이트 (글로우 애니메이션)
   */
  update(deltaTime: number): void {
    // Sweep 애니메이션 업데이트
    this.updateSweep(deltaTime);

    if (this.isReady) {
      // 펄스 애니메이션
      this.glowPulse += deltaTime * 4;
      const pulseValue = (Math.sin(this.glowPulse) + 1) / 2; // 0~1
      this.glowMaterial.opacity = 0.3 + pulseValue * 0.5;

      // 아이콘 밝기 변화
      if (this.iconBackgroundMaterial) {
        this.iconBackgroundMaterial.color.setHex(
          pulseValue > 0.5 ? 0x2a2a3e : 0x1a1a2e
        );
      }
    }
  }

  /**
   * 쿨다운 오버레이 표시 (어둡게)
   */
  setCooldownOverlay(active: boolean): void {
    if (this.iconMaterial) {
      this.iconMaterial.opacity = active ? 0.5 : 1.0;
    }
    this.iconBackgroundMaterial.opacity = active ? 0.95 : 0.9;
    this.iconBackgroundMaterial.color.setHex(active ? 0x111122 : 0x1a1a2e);
  }

  /**
   * 클릭 콜백 설정
   */
  setOnClick(callback: () => void): void {
    this.onClickCallback = callback;
  }

  /**
   * 클릭 처리
   */
  handleClick(): void {
    this.onClickCallback?.();
  }

  /**
   * 호버 상태 설정
   */
  setHovered(hovered: boolean): void {
    this._isHovered = hovered;
  }

  /**
   * 호버 상태 확인
   */
  isHovered(): boolean {
    return this._isHovered;
  }

  /**
   * 툴팁 정보 가져오기
   */
  getTooltipInfo(): { title: string; description: string } | null {
    if (!this.tooltipTitle) return null;
    return {
      title: this.tooltipTitle,
      description: this.tooltipDescription,
    };
  }

  /**
   * 툴팁 정보 설정
   */
  setTooltipInfo(title: string, description: string): void {
    this.tooltipTitle = title;
    this.tooltipDescription = description;
  }

  /**
   * 히트 테스트용 반지름 가져오기
   */
  getHitRadius(): number {
    return this.config.outerRadius;
  }

  /**
   * 전체 opacity 설정 (페이드 효과용)
   */
  setOpacity(opacity: number): void {
    this.backgroundMaterial.opacity = 0.8 * opacity;
    this.gaugeMaterial.opacity = 0.9 * opacity;
    this.iconBackgroundMaterial.opacity = 0.9 * opacity;
    if (this.iconMaterial) {
      this.iconMaterial.opacity = opacity;
    }
    if (this.labelText) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textMesh = this.labelText.text as any;
      if (textMesh?.material) {
        textMesh.material.opacity = opacity;
      }
    }
    if (this.keyHint) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const keyMesh = this.keyHint.text as any;
      if (keyMesh?.material) {
        keyMesh.material.opacity = opacity;
      }
    }
    // 테두리 opacity
    if (this.borderMaterial) {
      this.borderMaterial.opacity = opacity;
    }
  }

  /**
   * 아이콘 변경
   */
  setIcon(path: string): void {
    // 기존 아이콘 제거
    if (this.iconMesh) {
      this.remove(this.iconMesh);
      this.iconMesh.geometry.dispose();
      this.iconMaterial?.dispose();
      this.iconTexture?.dispose();
      this.iconMesh = null;
      this.iconMaterial = null;
      this.iconTexture = null;
    }
    // 새 아이콘 로드
    this.loadIcon(path);
  }

  dispose(): void {
    this.backgroundRing.geometry.dispose();
    this.backgroundMaterial.dispose();
    this.gaugeRing.geometry.dispose();
    this.gaugeMaterial.dispose();
    this.glowRing.geometry.dispose();
    this.glowMaterial.dispose();
    this.iconBackground.geometry.dispose();
    this.iconBackgroundMaterial.dispose();

    // Sweep 링 정리
    if (this.sweepRing) {
      this.sweepRing.geometry.dispose();
      this.sweepMaterial?.dispose();
    }

    if (this.iconMesh) {
      this.iconMesh.geometry.dispose();
      this.iconMaterial?.dispose();
      this.iconTexture?.dispose();
    }

    if (this.labelText) {
      this.remove(this.labelText);
    }

    if (this.keyHint) {
      this.remove(this.keyHint);
    }

    // 테두리 정리
    if (this.borderMesh) {
      this.borderMesh.geometry.dispose();
      this.borderMaterial?.dispose();
    }
  }
}
