import {
  Group,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  RingGeometry,
  CircleGeometry,
  TextureLoader,
  Texture,
  DoubleSide,
  SRGBColorSpace,
  BufferGeometry,
  BufferAttribute,
  Color,
  AdditiveBlending,
} from 'three';
import { UIText } from './UIText';

// 공용 버텍스 쉐이더
const glowVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Solar Corona 쉐이더 - 일식의 금환고리 효과
const coronaVertexShader = glowVertexShader;

const coronaFragmentShader = `
  uniform float uTime;
  uniform float uProgress; // 0: 시작(작음), 1: 완전히 펼쳐짐
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;

  // 노이즈 함수
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 uv = vUv - center;

    float dist = length(uv) * 2.0;
    float angle = atan(uv.y, uv.x);

    // 기본 반경 (게이지에 딱 붙게)
    float baseInner = 0.72;
    float baseOuter = 0.5;

    // 외곽 일렁임 - 더 빠르고 과격하게!
    float flameNoise1 = fbm(vec2(angle * 3.0 + uTime * 3.5, uTime * 2.0)) * 0.18;
    float flameNoise2 = fbm(vec2(angle * 5.0 - uTime * 2.8, uTime * 3.2)) * 0.14;
    float flameNoise3 = fbm(vec2(angle * 8.0 + uTime * 4.0, uTime * 1.8)) * 0.10;
    // 급격한 스파이크 추가
    float spike = pow(fbm(vec2(angle * 12.0 + uTime * 5.0, uTime * 2.5)), 2.0) * 0.15;
    float totalFlame = flameNoise1 + flameNoise2 + flameNoise3 + spike;

    // 내부/외부 반경 (progress에 따라 스케일 + 일렁임)
    float innerRadius = baseInner * uProgress;
    float outerRadius = (baseOuter + totalFlame) * uProgress;

    // 부드러운 링 마스크
    float innerEdge = smoothstep(innerRadius - 0.04, innerRadius + 0.02, dist);
    float outerEdge = 1.0 - smoothstep(outerRadius - 0.02, outerRadius + 0.06, dist);
    float ringMask = innerEdge * outerEdge;

    // 중심부 밝기 (안쪽이 훨씬 더 밝음 - 빛 뿜어지는 느낌)
    float coreBrightness = 1.0 - smoothstep(innerRadius, outerRadius * 0.8, dist);
    coreBrightness = pow(coreBrightness, 0.4) * 0.9 + 0.5;

    // 외곽 글로우 (타오르는 느낌)
    float outerGlow = smoothstep(baseOuter * 0.75 * uProgress, outerRadius, dist);
    float glowIntensity = outerGlow * (0.5 + totalFlame * 3.0);

    // 전체 강도 (더 밝게)
    float intensity = ringMask * coreBrightness * 1.6 + glowIntensity * ringMask;

    // 미세한 펄스 (숨쉬는 느낌) - 더 빠르게
    float pulse = sin(uTime * 4.0) * 0.1 + 0.95;
    intensity *= pulse;

    // 중앙 코어 추가 밝기 (빛 뿜어지는 핵심부)
    float coreGlow = 1.0 - smoothstep(innerRadius * 0.85, innerRadius * 1.05, dist);
    coreGlow = pow(coreGlow, 1.5) * 0.7;
    intensity += coreGlow * ringMask;

    vec3 finalColor = uColor * intensity;
    float alpha = intensity * uOpacity * uProgress;

    // 중앙부는 더 밝은 흰색으로
    vec3 brightCore = vec3(1.0, 1.0, 0.95);
    finalColor = mix(finalColor, brightCore * intensity, coreGlow * 0.6);

    // 외곽으로 갈수록 색상 변화 (약간 주황빛)
    vec3 outerTint = vec3(1.0, 0.85, 0.6);
    finalColor = mix(finalColor, finalColor * outerTint, outerGlow * 0.5);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Rising Flame 쉐이더 - 좌우에서 타오르며 위로 올라가는 불꽃
const flameFragmentShader = `
  uniform float uTime;
  uniform float uProgress;
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 uv = vUv - center;

    float dist = length(uv) * 2.0;
    float angle = atan(uv.y, uv.x);

    // 기본 반경
    float baseInner = 0.72;
    float baseOuter = 0.5;

    // 위쪽 방향 (sin(angle) > 0이면 위쪽)
    float upStrength = max(0.0, sin(angle));
    // 아래쪽 방향도 약간의 불꽃
    float downStrength = max(0.0, -sin(angle));
    // 좌우 방향 - 위로 갈수록 약해짐
    float sideStrength = abs(cos(angle)) * (1.0 - upStrength * 0.6);

    // 랜덤 좌우 흔들림 (위로 갈수록 더 흔들림)
    float wobble = fbm(vec2(angle * 2.0 + uTime * 3.0, uTime * 2.0)) * 0.15 * upStrength;

    // 불꽃 높이 - 위쪽 줄이고 균형 조정
    float flameHeight = upStrength * 0.18 + sideStrength * 0.12 + downStrength * 0.08;

    // 불꽃 노이즈 - 위로 흘러가는 느낌
    float flameNoise1 = fbm(vec2(angle * 4.0 + wobble, uTime * 4.0 - dist * 3.0)) * 0.15;
    float flameNoise2 = fbm(vec2(angle * 6.0 - uTime * 0.5 + wobble, uTime * 5.0 - dist * 4.0)) * 0.10;
    float flameNoise3 = fbm(vec2(angle * 10.0 + uTime * 2.0, uTime * 3.5 - dist * 5.0)) * 0.08;

    // 위로 올라가는 불꽃 (줄임)
    float risingFlame = upStrength * (flameNoise1 + flameNoise2) * 0.9;
    // 좌우/아래 불꽃은 보조
    float sideFlame = sideStrength * flameNoise3 * 0.8;
    float downFlame = downStrength * flameNoise1 * 0.4;

    float totalFlame = flameHeight + risingFlame + sideFlame + downFlame + flameNoise1 * 0.2;

    // 내부/외부 반경
    float innerRadius = baseInner * uProgress;
    float outerRadius = (baseOuter + totalFlame) * uProgress;

    // 링 마스크
    float innerEdge = smoothstep(innerRadius - 0.03, innerRadius + 0.02, dist);
    float outerEdge = 1.0 - smoothstep(outerRadius - 0.02, outerRadius + 0.08, dist);
    float ringMask = innerEdge * outerEdge;

    // 코어 밝기
    float coreBrightness = 1.0 - smoothstep(innerRadius, outerRadius * 0.7, dist);
    coreBrightness = pow(coreBrightness, 0.5) * 0.8 + 0.4;

    // 불꽃 글로우
    float flameGlow = smoothstep(baseOuter * 0.6 * uProgress, outerRadius, dist);
    float glowIntensity = flameGlow * (0.6 + totalFlame * 2.5);

    // 전체 강도
    float intensity = ringMask * coreBrightness * 1.4 + glowIntensity * ringMask;

    // 펄스
    float pulse = sin(uTime * 5.0) * 0.08 + 0.95;
    intensity *= pulse;

    // 코어 글로우
    float coreGlow = 1.0 - smoothstep(innerRadius * 0.85, innerRadius * 1.1, dist);
    coreGlow = pow(coreGlow, 1.5) * 0.6;
    intensity += coreGlow * ringMask;

    vec3 finalColor = uColor * intensity;
    float alpha = intensity * uOpacity * uProgress;

    // 중앙은 밝은 노란색/흰색
    vec3 brightCore = vec3(1.0, 0.95, 0.8);
    finalColor = mix(finalColor, brightCore * intensity, coreGlow * 0.7);

    // 외곽으로 갈수록 주황색 -> 빨간색
    float heightFactor = (uv.y + 0.5); // 위로 갈수록 1
    vec3 outerTint = mix(vec3(1.0, 0.4, 0.1), vec3(1.0, 0.7, 0.3), heightFactor);
    finalColor = mix(finalColor, finalColor * outerTint, flameGlow * 0.6);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export type GlowType = 'none' | 'corona' | 'flame';

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
  // 발광 효과 타입
  glowType?: GlowType; // 'corona' (태양) 또는 'flame' (불꽃)
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
      | 'glowType'
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

  // Solar Corona 효과 (일식 금환고리)
  private coronaMesh: Mesh | null = null;
  private coronaMaterial: ShaderMaterial | null = null;
  private coronaTime: number = 0;
  private coronaProgress: number = 0; // 0: 숨김, 1: 완전히 표시
  private coronaTargetProgress: number = 0;
  private coronaAnimSpeed: number = 1; // 애니메이션 속도 (작을수록 느림)

  // 상태
  private progress: number = 0; // 0~1
  private isReady: boolean = false;

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
      glowType: 'corona',
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

    // Solar Corona 효과 (일식 금환고리)
    this.createCorona();

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
   * 발광 효과 생성 (glowType에 따라 corona 또는 flame)
   */
  private createCorona(): void {
    const { outerRadius, readyGlowColor, glowType } = this.config;

    // glowType이 'none'이면 생성하지 않음
    if (glowType === 'none') return;

    // 크기 (게이지보다 약간 크게)
    const coronaSize = outerRadius * 2.8;

    const coronaGeometry = new PlaneGeometry(coronaSize, coronaSize);

    // 색상을 vec3로 변환
    const color = new Color(readyGlowColor);

    // glowType에 따라 쉐이더 선택
    const fragmentShader =
      glowType === 'flame' ? flameFragmentShader : coronaFragmentShader;

    this.coronaMaterial = new ShaderMaterial({
      vertexShader: glowVertexShader,
      fragmentShader: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uColor: { value: new Color(color.r * 1.5, color.g * 1.2, color.b) },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });

    this.coronaMesh = new Mesh(coronaGeometry, this.coronaMaterial);
    this.coronaMesh.position.z = -0.01; // 게이지 뒤에 배치
    this.coronaMesh.visible = false;
    this.add(this.coronaMesh);
  }

  /**
   * Corona 애니메이션 업데이트
   */
  private updateCorona(deltaTime: number): void {
    if (!this.coronaMesh || !this.coronaMaterial) return;

    // 시간 업데이트
    this.coronaTime += deltaTime;
    this.coronaMaterial.uniforms.uTime.value = this.coronaTime;

    // progress 애니메이션 (부드럽게 나타나고 사라짐)
    if (this.coronaProgress !== this.coronaTargetProgress) {
      const diff = this.coronaTargetProgress - this.coronaProgress;
      const change = this.coronaAnimSpeed * deltaTime;

      if (Math.abs(diff) < change) {
        this.coronaProgress = this.coronaTargetProgress;
      } else {
        this.coronaProgress += Math.sign(diff) * change;
      }

      // easing 효과
      let displayProgress = this.coronaProgress;
      if (this.coronaTargetProgress > 0) {
        // 나타날 때: easeOutBack (살짝 튀어나왔다 들어감)
        const t = this.coronaProgress;
        const c1 = 1.70158;
        const c3 = c1 + 1;
        displayProgress = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      } else {
        // 사라질 때: easeInCubic (점점 작아지며 사라짐 - 불꽃처럼)
        const t = this.coronaProgress;
        displayProgress = t * t * t;
      }

      this.coronaMaterial.uniforms.uProgress.value = Math.max(0, displayProgress);
      this.coronaMesh.visible = this.coronaProgress > 0.01;
    }
  }

  /**
   * Corona 효과 표시
   */
  private showCorona(): void {
    this.coronaTargetProgress = 1;
    if (this.coronaMesh) {
      this.coronaMesh.visible = true;
    }
  }

  /**
   * Corona 효과 숨기기
   */
  private hideCorona(): void {
    this.coronaTargetProgress = 0;
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
    // ready 상태로 전환될 때 corona 표시
    if (ready && !this.isReady) {
      this.showCorona();
    } else if (!ready && this.isReady) {
      this.hideCorona();
    }

    this.isReady = ready;
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
   * 업데이트 (Corona 애니메이션)
   */
  update(deltaTime: number): void {
    // Corona 애니메이션 업데이트
    this.updateCorona(deltaTime);
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
    this.iconBackground.geometry.dispose();
    this.iconBackgroundMaterial.dispose();

    // Corona 정리
    if (this.coronaMesh) {
      this.coronaMesh.geometry.dispose();
      this.coronaMaterial?.dispose();
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
