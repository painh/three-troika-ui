/**
 * UIHeartbeatBar - 심전도/파형 스타일 체력바 (Monster Hunter Wilds 스타일)
 *
 * 기능:
 * - 심전도 파형이 흐르는 체력바
 * - 체력에 따라 파형 강도/속도 변화
 * - 회복 가능 체력 표시 (Recoverable Health)
 * - 경계면 × 파형 교차점에 플레어 효과
 */

import { PlaneGeometry, Mesh, ShaderMaterial, IUniform, AdditiveBlending, DoubleSide } from 'three';
import { UIElement } from './UIElement';

// 수직 플레어 쉐이더 (경계면 × 파형 교차점 표시용)
const verticalFlareVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const verticalFlareFragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor;
  uniform float uPulse;

  varying vec2 vUv;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), f);
  }

  void main() {
    vec2 uv = vUv - 0.5;

    // 수직 스트릭으로 변경 (x, y 교체)
    vec2 rotatedUv = vec2(uv.y, uv.x);

    // 중심 코어
    float coreDist = length(rotatedUv);
    float angle = atan(rotatedUv.y, rotatedUv.x);
    float coreNoise = noise(angle * 3.0 + uTime * 30.0) * 0.3 + 0.85;
    float distortedDist = coreDist * coreNoise;

    float coreScale = 10.0;
    float core = exp(-distortedDist * coreScale) * uIntensity;

    float innerNoise = noise(uTime * 50.0) * 0.2 + 0.9;
    float innerCore = exp(-distortedDist * coreScale * 3.0) * uIntensity * 0.5 * innerNoise;

    // 수직 스트릭
    float streakFalloffX = 2.5;
    float streakFalloffY = 50.0;

    float streakX = exp(-abs(rotatedUv.x) * streakFalloffX);
    float taper = 1.0 - smoothstep(0.0, 0.45, abs(rotatedUv.x));
    float taperY = exp(-abs(rotatedUv.y) * streakFalloffY / max(0.1, taper * taper + 0.1));

    float distFromCenter = abs(rotatedUv.x) / 0.5;
    float flickerAmount = distFromCenter * distFromCenter;
    float flicker = 1.0 - flickerAmount * 0.5 * noise(uTime * 60.0 + rotatedUv.x * 20.0);

    float pulseEffect = 0.8 + uPulse * 0.4;
    float streak = streakX * taperY * uIntensity * 0.8 * flicker * pulseEffect;

    // 보조 스트릭
    float wideStreakX = exp(-abs(rotatedUv.x) * streakFalloffX * 0.5);
    float wideTaper = 1.0 - smoothstep(0.0, 0.5, abs(rotatedUv.x));
    float wideStreakY = exp(-abs(rotatedUv.y) * streakFalloffY * 0.7 / max(0.1, wideTaper + 0.1));
    float wideFlicker = 1.0 - flickerAmount * 0.3 * noise(uTime * 45.0 + rotatedUv.x * 15.0 + 100.0);
    float wideStreak = wideStreakX * wideStreakY * uIntensity * 0.3 * wideFlicker * pulseEffect;

    float glow = core + innerCore + streak + wideStreak;
    glow = min(glow, 2.0);

    vec3 finalColor = mix(uColor, vec3(1.0), glow * 0.5);
    finalColor *= glow;

    gl_FragColor = vec4(finalColor, glow);
  }
`;

const heartbeatBarVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const heartbeatBarFragmentShader = `
  precision highp float;

  uniform float uHealthValue;        // 현재 체력 (0~1)
  uniform float uRecoverableHealth;  // 회복 가능 체력 (0~1)
  uniform float uDamageIntensity;    // 피격 강도 (0~1, 피격시 1로 설정 후 서서히 감소)
  uniform float uShieldDamageIntensity; // 쉴드 피격 강도 (0~1)
  uniform float uStaminaValue;
  uniform float uRecoverableStamina;
  uniform float uOpacity;
  uniform float uTime;

  uniform vec3 uBackgroundColor;
  uniform vec3 uHealthColor;
  uniform vec3 uRecoverableColor;
  uniform vec3 uLowHealthColor;
  uniform vec3 uStaminaColor;
  uniform vec3 uStaminaRecoverableColor;
  uniform vec3 uWaveColor;
  uniform vec3 uWaveGlowColor;
  uniform vec3 uShieldColor;          // 쉴드 피격 시 파란색
  uniform vec3 uDelayColor;           // 지연 영역 색상 (노란색)

  uniform float uLowHealthThreshold;
  uniform float uWaveSpeed;
  uniform float uWaveIntensity;
  uniform float uBarSplit;

  varying vec2 vUv;

  // 노이즈 함수
  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), f);
  }

  // 몬헌 와일즈 스타일 파형 (offset으로 서브 파형 위치 조절)
  float mhWildsWave(float x, float time, float health, float damageIntensity, float offset) {
    float scrollSpeed = uWaveSpeed * 0.8;
    float scrollX = x + time * scrollSpeed;

    float baseY = 0.5 + offset;

    // 기본 파형 - 여러 사인파 합성
    float wave = 0.0;

    // 저주파 움직임
    wave += sin(scrollX * 2.5 + time * 0.4) * 0.12;
    wave += sin(scrollX * 4.0 + time * 0.7) * 0.08;

    // 중주파 노이즈
    wave += (noise(scrollX * 10.0 + time * 2.5) - 0.5) * 0.1;
    wave += (noise(scrollX * 15.0 - time * 1.8) - 0.5) * 0.06;

    // 피격 시 크고 촘촘하게 요동 (damageIntensity에 비례)
    float damageWave = damageIntensity * 0.35;
    // 고주파 촘촘한 파형 (피격 시)
    wave += sin(scrollX * 25.0 + time * 15.0) * damageWave;
    wave += sin(scrollX * 35.0 - time * 20.0) * damageWave * 0.7;
    wave += sin(scrollX * 50.0 + time * 25.0) * damageWave * 0.5;
    // 노이즈로 불규칙성 추가
    wave += (noise(scrollX * 40.0 + time * 18.0) - 0.5) * damageWave * 0.8;
    wave += (noise(scrollX * 60.0 - time * 22.0) - 0.5) * damageWave * 0.6;

    // 고주파 미세 떨림 (체력 낮거나 피격시 강해짐)
    float tremor = max((1.0 - health) * 0.1, damageIntensity * 0.2);
    wave += (noise(scrollX * 45.0 + time * 12.0) - 0.5) * tremor;

    wave *= uWaveIntensity;

    return baseY + wave;
  }

  // 파형 굵기 계산 (0.5 ~ 3.0 배율로 불규칙하게 변화)
  float getWaveThickness(float x, float time) {
    float scrollSpeed = uWaveSpeed * 0.8;
    float scrollX = x + time * scrollSpeed;

    // 여러 주파수의 노이즈 합성으로 불규칙한 굵기 생성
    float thickness = 1.0;

    // 저주파 변화 (큰 덩어리)
    thickness += sin(scrollX * 3.0 + time * 0.3) * 0.4;
    thickness += sin(scrollX * 5.0 - time * 0.5) * 0.3;

    // 중주파 노이즈
    thickness += (noise(scrollX * 8.0 + time * 1.5) - 0.5) * 0.6;
    thickness += (noise(scrollX * 12.0 - time * 2.0) - 0.5) * 0.4;

    // 고주파 미세 변화
    thickness += (noise(scrollX * 25.0 + time * 4.0) - 0.5) * 0.3;

    // 0.5 ~ 3.0 범위로 클램프
    return clamp(thickness, 0.5, 3.0);
  }

  // 단일 파형 라인 그리기
  void drawWaveLine(float waveY, float dist, vec3 waveColor, float lineWidth, float glowStrength, inout vec3 finalColor, inout float alpha) {
    // 글로우
    float glow = exp(-dist * (20.0 / glowStrength)) * glowStrength * 0.5;
    if (glow > 0.03) {
      finalColor = mix(finalColor, waveColor * 0.5, glow);
      alpha = max(alpha, uOpacity * glow);
    }

    // 메인 라인
    if (dist < lineWidth) {
      float lineIntensity = 1.0 - (dist / lineWidth);
      lineIntensity = pow(lineIntensity, 0.4);
      finalColor = mix(finalColor, waveColor, lineIntensity * 0.9);
      alpha = max(alpha, uOpacity * lineIntensity);
    }

    // 코어 (가장 밝은 중심)
    float coreWidth = lineWidth * 0.3;
    if (dist < coreWidth) {
      float coreIntensity = 1.0 - (dist / coreWidth);
      coreIntensity = pow(coreIntensity, 0.5);
      finalColor = mix(finalColor, waveColor + vec3(0.3), coreIntensity * 0.5);
      alpha = max(alpha, uOpacity);
    }
  }

  void main() {
    vec2 uv = vUv;

    // UV.y 리매핑: geometry가 2배 높이이므로 UV 0~1을 -0.25~1.25로 확장
    // 이렇게 하면 파형이 원래 0~1 범위 밖으로 그려져도 잘리지 않음
    uv.y = uv.y * 1.5 - 0.25;

    vec3 finalColor = vec3(0.0);
    float alpha = 0.0;

    // 총 피격 강도 (체력 + 쉴드)
    float totalDamageIntensity = max(uDamageIntensity, uShieldDamageIntensity);

    // 파형 색상 계산 (체력바 영역용)
    vec3 healthWaveColor = uHealthColor;
    if (uShieldDamageIntensity > 0.01) {
      healthWaveColor = mix(uHealthColor, uShieldColor, uShieldDamageIntensity);
    } else if (uDamageIntensity > 0.01) {
      healthWaveColor = mix(uHealthColor, uLowHealthColor, uDamageIntensity);
    }
    if (uHealthValue < uLowHealthThreshold) {
      float t = uHealthValue / uLowHealthThreshold;
      healthWaveColor = mix(uLowHealthColor, healthWaveColor, t);
    }

    // 지연 영역 색상
    vec3 delayWaveColor = uDelayColor;
    float damageBlend = max(uDamageIntensity, uShieldDamageIntensity);
    delayWaveColor = mix(delayWaveColor, vec3(0.95, 0.3, 0.2), damageBlend * 0.5);

    // 어두운 영역 색상
    vec3 darkColor = vec3(0.15, 0.15, 0.18);

    // 체력 범위 내에서만 파형 그리기
    if (uv.x <= uHealthValue) {
      // 현재 체력 범위(0~uHealthValue)에서 0~1로 정규화
      float normalizedX = uv.x / max(uHealthValue, 0.01);

      // === 메인 파형 (굵고 밝음, 굵기 불규칙) ===
      float mainWaveY = mhWildsWave(uv.x, uTime, uHealthValue, totalDamageIntensity, 0.0);
      float mainDist = abs(uv.y - mainWaveY);
      float thicknessMult = getWaveThickness(uv.x, uTime);
      float mainLineWidth = 0.12 * thicknessMult;
      drawWaveLine(mainWaveY, mainDist, healthWaveColor, mainLineWidth, 1.5 * thicknessMult, finalColor, alpha);

      // === 서브 파형 1 (위쪽, 양끝에서 메인과 합류) ===
      float sub1Spread = sin(normalizedX * 3.14159); // 0→1→0 (중간에서 최대)
      float sub1BaseY = mhWildsWave(uv.x + 0.1, uTime * 1.1, uHealthValue, totalDamageIntensity, 0.0);
      float sub1OffsetY = sub1Spread * 0.32;
      float sub1WaveY = sub1BaseY + sub1OffsetY;
      float sub1Dist = abs(uv.y - sub1WaveY);
      vec3 sub1Color = healthWaveColor * 0.7;
      float sub1Thickness = getWaveThickness(uv.x + 0.1, uTime * 1.1);
      drawWaveLine(sub1WaveY, sub1Dist, sub1Color, 0.04 * sub1Thickness, 0.8 * sub1Thickness, finalColor, alpha);

      // === 서브 파형 2 (아래쪽, 양끝에서 메인과 합류) ===
      float sub2Spread = sin(normalizedX * 3.14159); // 0→1→0 (중간에서 최대)
      float sub2BaseY = mhWildsWave(uv.x - 0.15, uTime * 0.9, uHealthValue, totalDamageIntensity, 0.0);
      float sub2OffsetY = -sub2Spread * 0.28;
      float sub2WaveY = sub2BaseY + sub2OffsetY;
      float sub2Dist = abs(uv.y - sub2WaveY);
      vec3 sub2Color = healthWaveColor * 0.6;
      float sub2Thickness = getWaveThickness(uv.x - 0.15, uTime * 0.9);
      drawWaveLine(sub2WaveY, sub2Dist, sub2Color, 0.024 * sub2Thickness, 0.6 * sub2Thickness, finalColor, alpha);
    }

    // === 지연 영역 (uHealthValue ~ uRecoverableHealth): 노란색/빨간색 잔상 파형 ===
    if (uv.x > uHealthValue && uv.x <= uRecoverableHealth) {
      float normalizedX = uv.x;

      // === 메인 파형 (지연 영역) ===
      float mainWaveY = mhWildsWave(uv.x, uTime, 1.0, damageBlend * 0.5, 0.0);
      float mainDist = abs(uv.y - mainWaveY);
      float thicknessMult = getWaveThickness(uv.x, uTime);
      float mainLineWidth = 0.12 * thicknessMult;
      drawWaveLine(mainWaveY, mainDist, delayWaveColor, mainLineWidth, 1.5 * thicknessMult, finalColor, alpha);

      // === 서브 파형 1 (위쪽) ===
      float sub1Spread = sin(normalizedX * 3.14159);
      float sub1BaseY = mhWildsWave(uv.x + 0.1, uTime * 1.1, 1.0, damageBlend * 0.5, 0.0);
      float sub1OffsetY = sub1Spread * 0.32;
      float sub1WaveY = sub1BaseY + sub1OffsetY;
      float sub1Dist = abs(uv.y - sub1WaveY);
      vec3 sub1Color = delayWaveColor * 0.7;
      float sub1Thickness = getWaveThickness(uv.x + 0.1, uTime * 1.1);
      drawWaveLine(sub1WaveY, sub1Dist, sub1Color, 0.04 * sub1Thickness, 0.8 * sub1Thickness, finalColor, alpha);

      // === 서브 파형 2 (아래쪽) ===
      float sub2Spread = sin(normalizedX * 3.14159);
      float sub2BaseY = mhWildsWave(uv.x - 0.15, uTime * 0.9, 1.0, damageBlend * 0.5, 0.0);
      float sub2OffsetY = -sub2Spread * 0.28;
      float sub2WaveY = sub2BaseY + sub2OffsetY;
      float sub2Dist = abs(uv.y - sub2WaveY);
      vec3 sub2Color = delayWaveColor * 0.6;
      float sub2Thickness = getWaveThickness(uv.x - 0.15, uTime * 0.9);
      drawWaveLine(sub2WaveY, sub2Dist, sub2Color, 0.024 * sub2Thickness, 0.6 * sub2Thickness, finalColor, alpha);
    }

    // 최대 체력 영역 (recoverable ~ max): 검은색/어두운 파형으로 표시
    if (uv.x > uRecoverableHealth && uv.x <= 1.0) {
      float normalizedX = uv.x;

      // === 메인 파형 (동일한 파형, 어두운 색상) ===
      float mainWaveY = mhWildsWave(uv.x, uTime, 1.0, 0.0, 0.0);
      float mainDist = abs(uv.y - mainWaveY);
      float thicknessMult = getWaveThickness(uv.x, uTime);
      float mainLineWidth = 0.12 * thicknessMult;
      drawWaveLine(mainWaveY, mainDist, darkColor, mainLineWidth, 1.5 * thicknessMult, finalColor, alpha);

      // === 서브 파형 1 (위쪽) ===
      float sub1Spread = sin(normalizedX * 3.14159);
      float sub1BaseY = mhWildsWave(uv.x + 0.1, uTime * 1.1, 1.0, 0.0, 0.0);
      float sub1OffsetY = sub1Spread * 0.32;
      float sub1WaveY = sub1BaseY + sub1OffsetY;
      float sub1Dist = abs(uv.y - sub1WaveY);
      vec3 sub1Color = darkColor * 0.7;
      float sub1Thickness = getWaveThickness(uv.x + 0.1, uTime * 1.1);
      drawWaveLine(sub1WaveY, sub1Dist, sub1Color, 0.04 * sub1Thickness, 0.8 * sub1Thickness, finalColor, alpha);

      // === 서브 파형 2 (아래쪽) ===
      float sub2Spread = sin(normalizedX * 3.14159);
      float sub2BaseY = mhWildsWave(uv.x - 0.15, uTime * 0.9, 1.0, 0.0, 0.0);
      float sub2OffsetY = -sub2Spread * 0.28;
      float sub2WaveY = sub2BaseY + sub2OffsetY;
      float sub2Dist = abs(uv.y - sub2WaveY);
      vec3 sub2Color = darkColor * 0.6;
      float sub2Thickness = getWaveThickness(uv.x - 0.15, uTime * 0.9);
      drawWaveLine(sub2WaveY, sub2Dist, sub2Color, 0.024 * sub2Thickness, 0.6 * sub2Thickness, finalColor, alpha);
    }

    // 투명한 부분은 discard
    if (alpha < 0.02) {
      discard;
    }

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export interface UIHeartbeatBarConfig {
  width?: number;
  height?: number;

  // 초기값
  healthValue?: number;
  staminaValue?: number;

  // 색상 (Monster Hunter Wilds 스타일)
  backgroundColor?: number;
  healthColor?: number;
  recoverableColor?: number;
  lowHealthColor?: number;
  staminaColor?: number;
  staminaRecoverableColor?: number;
  waveColor?: number;
  waveGlowColor?: number;

  // 동작 설정
  lowHealthThreshold?: number;
  waveSpeed?: number;
  waveIntensity?: number;
  barSplit?: number;  // 체력/스태미나 바 비율 (기본 0.3 = 하단 30% 스태미나)

  // 지연 애니메이션
  healthDelaySpeed?: number;
  staminaDelaySpeed?: number;
}

// 플레어 타입 정의
interface FlareData {
  mesh: Mesh;
  material: ShaderMaterial;
  boundaryType: 'start' | 'health' | 'delay' | 'end';
  waveType: 'main' | 'sub1' | 'sub2';
}

export class UIHeartbeatBar extends UIElement {
  private bar: Mesh;
  private material: ShaderMaterial;

  // 12개 플레어 (경계면 4개 × 파형 3개)
  private flares: FlareData[] = [];

  // 타이밍
  private globalTime: number = 0;

  // 파형 계산용 설정
  private waveSpeed: number = 0.8;
  private waveIntensity: number = 1.0;

  // 체력 상태
  private targetHealth: number = 1;       // 목표 체력 (실제 값)
  private displayedHealth: number = 1;    // 화면에 표시되는 체력 (부드럽게 이동)
  private delayedHealth: number = 1;      // 지연 게이지 (피격 시 잔상)
  private healthDelayTimer: number = 0;   // 지연 대기 시간
  private lastHealthValue: number = -1;   // 이전 체력 값 (증가/감소 판단용)

  // 스태미나 상태
  private targetStamina: number = 1;
  private displayedStamina: number = 1;
  private delayedStamina: number = 1;
  private staminaDelayTimer: number = 0;
  private lastStaminaValue: number = -1;

  // 피격 상태
  private damageIntensity: number = 0;
  private shieldDamageIntensity: number = 0;
  private damageDecaySpeed: number = 1.5; // 피격 효과 감소 속도

  // 쉴드 상태
  private currentShield: number = 0;
  private maxShield: number = 0;

  // 설정
  private healthDelaySpeed: number;       // 지연 게이지 따라오는 속도
  private healthFillSpeed: number;        // 체력 증가 시 부드러운 증가 속도
  private staminaDelaySpeed: number;
  private staminaFillSpeed: number;
  private delayWait: number = 0.3;        // 피격 후 대기 시간

  constructor(config: UIHeartbeatBarConfig = {}) {
    super();

    this._width = config.width ?? 4;
    this._height = config.height ?? 0.5;

    this.healthDelaySpeed = config.healthDelaySpeed ?? 1.0;   // 지연 게이지 속도
    this.healthFillSpeed = 2.0;                               // 체력 증가 시 애니메이션 속도
    this.staminaDelaySpeed = config.staminaDelaySpeed ?? 1.2;
    this.staminaFillSpeed = 2.5;

    const toVec3 = (color: number): [number, number, number] => [
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
    ];

    this.material = new ShaderMaterial({
      vertexShader: heartbeatBarVertexShader,
      fragmentShader: heartbeatBarFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uHealthValue: { value: config.healthValue ?? 1 } as IUniform<number>,
        uRecoverableHealth: { value: config.healthValue ?? 1 } as IUniform<number>,
        uDamageIntensity: { value: 0 } as IUniform<number>,
        uShieldDamageIntensity: { value: 0 } as IUniform<number>,
        uStaminaValue: { value: config.staminaValue ?? 1 } as IUniform<number>,
        uRecoverableStamina: { value: config.staminaValue ?? 1 } as IUniform<number>,
        uOpacity: { value: 1 } as IUniform<number>,
        uTime: { value: 0 } as IUniform<number>,

        // MH Wilds 스타일 색상 (녹색/청록색 계열)
        uBackgroundColor: { value: toVec3(config.backgroundColor ?? 0x1a1a1e) },
        uHealthColor: { value: toVec3(config.healthColor ?? 0x2ecc71) },        // 녹색
        uRecoverableColor: { value: toVec3(config.recoverableColor ?? 0x1a5c38) }, // 어두운 녹색
        uLowHealthColor: { value: toVec3(config.lowHealthColor ?? 0xe74c3c) },   // 빨간색
        uStaminaColor: { value: toVec3(config.staminaColor ?? 0xf1c40f) },       // 노란색
        uStaminaRecoverableColor: { value: toVec3(config.staminaRecoverableColor ?? 0x7d6608) },
        uWaveColor: { value: toVec3(config.waveColor ?? 0xffffff) },             // 파형 흰색
        uWaveGlowColor: { value: toVec3(config.waveGlowColor ?? 0x7dffb3) },     // 파형 글로우
        uShieldColor: { value: toVec3(0x3b82f6) },                               // 쉴드 피격 시 파란색
        uDelayColor: { value: toVec3(0xe6b319) },                                // 지연 영역 색상 (노란색)

        uLowHealthThreshold: { value: config.lowHealthThreshold ?? 0.3 },
        uWaveSpeed: { value: config.waveSpeed ?? 0.8 },
        uWaveIntensity: { value: config.waveIntensity ?? 1.0 },
        uBarSplit: { value: config.barSplit ?? 0.35 },
      },
    });

    // 파형 설정 저장
    this.waveSpeed = config.waveSpeed ?? 0.8;
    this.waveIntensity = config.waveIntensity ?? 1.0;

    // 파형이 위아래로 크게 요동치므로 geometry 높이를 2배로 확장
    // (UV는 그대로 0~1이지만 파형이 잘리지 않도록)
    const waveHeightMultiplier = 2.0;
    const geometry = new PlaneGeometry(this._width, this._height * waveHeightMultiplier);
    this.bar = new Mesh(geometry, this.material);
    this.add(this.bar);

    // 12개 플레어 생성 (경계면 4개 × 파형 3개)
    this.createFlares(toVec3(config.healthColor ?? 0x2ecc71));

    // 초기값
    this.targetHealth = config.healthValue ?? 1;
    this.displayedHealth = this.targetHealth;
    this.delayedHealth = this.targetHealth;

    this.targetStamina = config.staminaValue ?? 1;
    this.displayedStamina = this.targetStamina;
    this.delayedStamina = this.targetStamina;
  }

  /**
   * 12개 플레어 Mesh 생성
   */
  private createFlares(healthColor: [number, number, number]): void {
    const flareSize = this._height * 2.5;
    const flareGeometry = new PlaneGeometry(flareSize, flareSize);

    const boundaryTypes: Array<'start' | 'health' | 'delay' | 'end'> = ['start', 'health', 'delay', 'end'];
    const waveTypes: Array<'main' | 'sub1' | 'sub2'> = ['main', 'sub1', 'sub2'];

    const delayColor: [number, number, number] = [0.9, 0.7, 0.1];  // 노란색
    const darkColor: [number, number, number] = [0.25, 0.25, 0.3]; // 어두운 색

    for (const boundaryType of boundaryTypes) {
      for (const waveType of waveTypes) {
        // 색상 결정
        let color: [number, number, number];
        let intensity: number;

        if (boundaryType === 'end') {
          color = darkColor;
          intensity = waveType === 'main' ? 0.8 : 0.55;
        } else if (boundaryType === 'delay') {
          color = delayColor;
          intensity = waveType === 'main' ? 0.6 : 0.4;
        } else {
          color = healthColor;
          intensity = waveType === 'main' ? 0.7 : 0.45;
        }

        const material = new ShaderMaterial({
          vertexShader: verticalFlareVertexShader,
          fragmentShader: verticalFlareFragmentShader,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
          uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: intensity },
            uColor: { value: [...color] },
            uPulse: { value: 0 },
          },
        });

        const mesh = new Mesh(flareGeometry.clone(), material);
        mesh.position.set(0, 0, 0.01);

        // delay 플레어는 초기에 숨김
        if (boundaryType === 'delay') {
          mesh.visible = false;
        }
        // health 플레어도 체력 100%일 때는 숨김
        if (boundaryType === 'health') {
          mesh.visible = false;
        }

        this.add(mesh);
        this.flares.push({ mesh, material, boundaryType, waveType });
      }
    }
  }

  /**
   * 체력 설정 (0~1)
   */
  setHealth(value: number): this {
    const newValue = Math.max(0, Math.min(1, value));
    this.targetHealth = newValue;

    // 첫 설정 시 초기화
    if (this.lastHealthValue < 0) {
      this.lastHealthValue = newValue;
      this.displayedHealth = newValue;
      this.delayedHealth = newValue;
      this.material.uniforms.uHealthValue.value = newValue;
      return this;
    }

    const diff = newValue - this.lastHealthValue;

    if (diff < 0) {
      // 피해 입음 - 표시 체력 즉시 감소, 지연 게이지는 대기 후 따라감
      this.displayedHealth = newValue;
      this.material.uniforms.uHealthValue.value = newValue;
      this.healthDelayTimer = this.delayWait;

      // 피격 강도 설정 (피해량에 비례, 최소 0.7 보장)
      const damageAmount = this.lastHealthValue - newValue;
      this.damageIntensity = Math.min(1, Math.max(0.7, damageAmount * 5 + 0.7));
      this.material.uniforms.uDamageIntensity.value = this.damageIntensity;
    } else if (diff > 0) {
      // 회복됨 - displayedHealth는 update()에서 부드럽게 증가
      // delayedHealth도 함께 증가 (지연 없이)
      this.healthDelayTimer = 0;
      this.delayedHealth = newValue;
    }

    this.lastHealthValue = newValue;
    return this;
  }

  /**
   * 스태미나 설정 (0~1)
   */
  setStamina(value: number): this {
    const newValue = Math.max(0, Math.min(1, value));
    this.targetStamina = newValue;

    // 첫 설정 시 초기화
    if (this.lastStaminaValue < 0) {
      this.lastStaminaValue = newValue;
      this.displayedStamina = newValue;
      this.delayedStamina = newValue;
      this.material.uniforms.uStaminaValue.value = newValue;
      return this;
    }

    const diff = newValue - this.lastStaminaValue;

    if (diff < 0) {
      // 스태미나 감소 - 즉시 감소, 지연 게이지는 대기 후 따라감
      this.displayedStamina = newValue;
      this.material.uniforms.uStaminaValue.value = newValue;
      this.staminaDelayTimer = this.delayWait;
    } else if (diff > 0) {
      // 스태미나 회복 - 부드럽게 증가
      this.staminaDelayTimer = 0;
      this.delayedStamina = newValue;
    }

    this.lastStaminaValue = newValue;
    return this;
  }

  /**
   * 쉴드 설정
   */
  setShield(current: number, max: number): this {
    const newShield = Math.max(0, current);
    const newMax = Math.max(0, max);

    if (newShield < this.currentShield && this.currentShield > 0) {
      // 쉴드 피격
      const shieldDamageAmount = (this.currentShield - newShield) / Math.max(this.maxShield, 1);
      this.shieldDamageIntensity = Math.min(1, Math.max(0.7, shieldDamageAmount * 5 + 0.7));
      this.material.uniforms.uShieldDamageIntensity.value = this.shieldDamageIntensity;
      console.log('[UIHeartbeatBar] SHIELD DAMAGE! intensity:', this.shieldDamageIntensity);
    }

    this.currentShield = newShield;
    this.maxShield = newMax;

    return this;
  }

  /**
   * 체력/스태미나 동시 설정
   */
  setValues(health: number, stamina: number): this {
    this.setHealth(health);
    this.setStamina(stamina);
    return this;
  }

  /**
   * 투명도 설정
   */
  setOpacity(opacity: number): this {
    this.material.uniforms.uOpacity.value = Math.max(0, Math.min(1, opacity));
    return this;
  }

  /**
   * 파형 속도 설정
   */
  setWaveSpeed(speed: number): this {
    this.material.uniforms.uWaveSpeed.value = speed;
    return this;
  }

  /**
   * 파형 강도 설정
   */
  setWaveIntensity(intensity: number): this {
    this.material.uniforms.uWaveIntensity.value = intensity;
    return this;
  }

  /**
   * 색상 설정
   */
  setHealthColor(color: number): this {
    this.material.uniforms.uHealthColor.value = [
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
    ];
    return this;
  }

  setStaminaColor(color: number): this {
    this.material.uniforms.uStaminaColor.value = [
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
    ];
    return this;
  }

  /**
   * 노이즈 함수 (쉐이더와 동일)
   */
  private hash(n: number): number {
    return (Math.sin(n) * 43758.5453) % 1;
  }

  private noise(x: number): number {
    const i = Math.floor(x);
    const f = x - i;
    const ff = f * f * (3.0 - 2.0 * f);
    return this.hash(i) * (1 - ff) + this.hash(i + 1) * ff;
  }

  /**
   * 파형 Y 위치 계산 (쉐이더의 mhWildsWave와 동일)
   */
  private calculateWaveY(x: number, time: number, health: number, damageIntensity: number): number {
    const scrollSpeed = this.waveSpeed * 0.8;
    const scrollX = x + time * scrollSpeed;

    let wave = 0.0;

    // 저주파 움직임
    wave += Math.sin(scrollX * 2.5 + time * 0.4) * 0.12;
    wave += Math.sin(scrollX * 4.0 + time * 0.7) * 0.08;

    // 중주파 노이즈
    wave += (this.noise(scrollX * 10.0 + time * 2.5) - 0.5) * 0.1;
    wave += (this.noise(scrollX * 15.0 - time * 1.8) - 0.5) * 0.06;

    // 피격 시 고주파 파형
    const damageWave = damageIntensity * 0.35;
    wave += Math.sin(scrollX * 25.0 + time * 15.0) * damageWave;
    wave += Math.sin(scrollX * 35.0 - time * 20.0) * damageWave * 0.7;
    wave += Math.sin(scrollX * 50.0 + time * 25.0) * damageWave * 0.5;
    wave += (this.noise(scrollX * 40.0 + time * 18.0) - 0.5) * damageWave * 0.8;
    wave += (this.noise(scrollX * 60.0 - time * 22.0) - 0.5) * damageWave * 0.6;

    // 고주파 미세 떨림
    const tremor = Math.max((1.0 - health) * 0.1, damageIntensity * 0.2);
    wave += (this.noise(scrollX * 45.0 + time * 12.0) - 0.5) * tremor;

    wave *= this.waveIntensity;

    return 0.5 + wave;
  }

  /**
   * 특정 X 위치에서 3개 파형의 Y값 계산
   */
  private getWaveYPositions(x: number, time: number, health: number, damageIntensity: number): { mainY: number; sub1Y: number; sub2Y: number } {
    const mainY = this.calculateWaveY(x, time, health, damageIntensity);

    const normalizedX = x / Math.max(health, 0.01);
    const sub1Spread = Math.sin(Math.min(Math.max(normalizedX, 0), 1) * Math.PI);
    const sub1BaseY = this.calculateWaveY(x + 0.1, time * 1.1, health, damageIntensity);
    const sub1Y = sub1BaseY + sub1Spread * 0.32;

    const sub2Spread = Math.sin(Math.min(Math.max(normalizedX, 0), 1) * Math.PI);
    const sub2BaseY = this.calculateWaveY(x - 0.15, time * 0.9, health, damageIntensity);
    const sub2Y = sub2BaseY - sub2Spread * 0.28;

    return { mainY, sub1Y, sub2Y };
  }

  /**
   * 매 프레임 호출
   */
  update(deltaTime: number): void {
    this.globalTime += deltaTime;
    this.material.uniforms.uTime.value = this.globalTime;

    // 피격 강도 감소 (서서히 녹색으로 복귀)
    if (this.damageIntensity > 0) {
      this.damageIntensity = Math.max(0, this.damageIntensity - this.damageDecaySpeed * deltaTime);
      this.material.uniforms.uDamageIntensity.value = this.damageIntensity;
    }

    // 쉴드 피격 강도 감소 (서서히 녹색으로 복귀)
    if (this.shieldDamageIntensity > 0) {
      this.shieldDamageIntensity = Math.max(0, this.shieldDamageIntensity - this.damageDecaySpeed * deltaTime);
      this.material.uniforms.uShieldDamageIntensity.value = this.shieldDamageIntensity;
    }

    // === 체력 애니메이션 ===
    // 1. 체력 증가 시: displayedHealth가 targetHealth로 부드럽게 증가
    if (this.displayedHealth < this.targetHealth) {
      this.displayedHealth = Math.min(
        this.targetHealth,
        this.displayedHealth + this.healthFillSpeed * deltaTime
      );
      this.material.uniforms.uHealthValue.value = this.displayedHealth;
    }

    // 2. 지연 게이지 애니메이션 (피격 후 잔상이 따라옴)
    if (this.healthDelayTimer > 0) {
      this.healthDelayTimer -= deltaTime;
    } else {
      // 지연 게이지가 현재 표시 체력보다 높으면 따라감
      if (this.delayedHealth > this.displayedHealth) {
        this.delayedHealth = Math.max(
          this.displayedHealth,
          this.delayedHealth - this.healthDelaySpeed * deltaTime
        );
      }
      // 지연 게이지가 현재 표시 체력보다 낮으면 (회복 시) 즉시 따라감
      else if (this.delayedHealth < this.displayedHealth) {
        this.delayedHealth = this.displayedHealth;
      }
    }
    this.material.uniforms.uRecoverableHealth.value = this.delayedHealth;

    // === 스태미나 애니메이션 ===
    // 1. 스태미나 증가 시: displayedStamina가 targetStamina로 부드럽게 증가
    if (this.displayedStamina < this.targetStamina) {
      this.displayedStamina = Math.min(
        this.targetStamina,
        this.displayedStamina + this.staminaFillSpeed * deltaTime
      );
      this.material.uniforms.uStaminaValue.value = this.displayedStamina;
    }

    // 2. 지연 게이지 애니메이션
    if (this.staminaDelayTimer > 0) {
      this.staminaDelayTimer -= deltaTime;
    } else {
      if (this.delayedStamina > this.displayedStamina) {
        this.delayedStamina = Math.max(
          this.displayedStamina,
          this.delayedStamina - this.staminaDelaySpeed * deltaTime
        );
      } else if (this.delayedStamina < this.displayedStamina) {
        this.delayedStamina = this.displayedStamina;
      }
    }
    this.material.uniforms.uRecoverableStamina.value = this.delayedStamina;

    // === 플레어 위치 업데이트 ===
    this.updateFlares();
  }

  /**
   * 플레어 위치 및 색상 업데이트
   */
  private updateFlares(): void {
    const totalDamageIntensity = Math.max(this.damageIntensity, this.shieldDamageIntensity);

    // 디버그 로그 (매 프레임이 아닌 가끔만 출력)
    if (Math.random() < 0.01) {
      console.log('[UIHeartbeatBar] displayedHealth:', this.displayedHealth.toFixed(3),
                  'delayedHealth:', this.delayedHealth.toFixed(3),
                  'hasDelayGap:', (this.delayedHealth - this.displayedHealth > 0.01));
    }
    const healthColor = this.material.uniforms.uHealthColor.value as number[];
    const lowHealthColor = this.material.uniforms.uLowHealthColor.value as number[];
    const shieldColor = this.material.uniforms.uShieldColor.value as number[];
    const delayColor: [number, number, number] = [0.9, 0.7, 0.1];
    const darkColor: [number, number, number] = [0.25, 0.25, 0.3];

    // 피격 시 색상 계산
    let currentHealthColor: number[] = [...healthColor];
    if (this.shieldDamageIntensity > 0.01) {
      currentHealthColor = healthColor.map((c, i) =>
        c * (1 - this.shieldDamageIntensity) + shieldColor[i] * this.shieldDamageIntensity
      );
    } else if (this.damageIntensity > 0.01) {
      currentHealthColor = healthColor.map((c, i) =>
        c * (1 - this.damageIntensity) + lowHealthColor[i] * this.damageIntensity
      );
    }

    // 지연 색상 (피격 강도에 따라 노란색 → 빨간색)
    const damageBlend = Math.max(this.damageIntensity, this.shieldDamageIntensity);
    const currentDelayColor = delayColor.map((c, i) =>
      c * (1 - damageBlend * 0.5) + [0.95, 0.3, 0.2][i] * damageBlend * 0.5
    );

    // 지연 영역이 있는지 확인
    const hasDelayGap = this.delayedHealth - this.displayedHealth > 0.01;

    for (const flare of this.flares) {
      // 시간 업데이트
      flare.material.uniforms.uTime.value = this.globalTime;

      // 펄싱 효과
      const pulse = Math.sin(this.globalTime * 3.5 + Math.random() * 0.1) * 0.5 + 0.5;
      flare.material.uniforms.uPulse.value = pulse;

      // 경계면 X 위치 결정
      let boundaryX: number;
      let health: number;
      let damage: number;
      let visible = true;

      switch (flare.boundaryType) {
        case 'start':
          boundaryX = 0;
          health = this.displayedHealth;
          damage = totalDamageIntensity;
          flare.material.uniforms.uColor.value = currentHealthColor;
          break;
        case 'health':
          boundaryX = this.displayedHealth;
          health = this.displayedHealth;
          damage = totalDamageIntensity;
          // 체력이 0보다 크고 1보다 작을 때 표시 (양 끝 제외)
          visible = this.displayedHealth > 0.005 && this.displayedHealth < 0.995;
          flare.material.uniforms.uColor.value = currentHealthColor;
          break;
        case 'delay':
          boundaryX = this.delayedHealth;
          health = 1.0;
          damage = damageBlend * 0.5;
          // 지연 갭이 있을 때만 표시 (health와 delay 사이에 간격이 있을 때)
          visible = hasDelayGap;
          flare.material.uniforms.uColor.value = currentDelayColor;
          break;
        case 'end':
          boundaryX = 1.0;
          health = 1.0;
          damage = 0;
          flare.material.uniforms.uColor.value = darkColor;
          break;
      }

      flare.mesh.visible = visible;

      if (visible) {
        // 파형 Y 위치 계산
        const wavePositions = this.getWaveYPositions(boundaryX, this.globalTime, health, damage);

        let waveY: number;
        switch (flare.waveType) {
          case 'main':
            waveY = wavePositions.mainY;
            break;
          case 'sub1':
            waveY = wavePositions.sub1Y;
            break;
          case 'sub2':
            waveY = wavePositions.sub2Y;
            break;
        }

        // UV 좌표(0~1)를 월드 좌표로 변환
        const worldX = -this._width / 2 + boundaryX * this._width;
        const worldY = (waveY - 0.5) * this._height;

        flare.mesh.position.set(worldX, worldY, 0.01);
      }
    }
  }

  /**
   * 상태 리셋
   */
  reset(): this {
    this.targetHealth = 1;
    this.displayedHealth = 1;
    this.delayedHealth = 1;
    this.healthDelayTimer = 0;
    this.lastHealthValue = -1;

    this.targetStamina = 1;
    this.displayedStamina = 1;
    this.delayedStamina = 1;
    this.staminaDelayTimer = 0;
    this.lastStaminaValue = -1;

    this.damageIntensity = 0;
    this.shieldDamageIntensity = 0;
    this.currentShield = 0;
    this.maxShield = 0;

    this.material.uniforms.uHealthValue.value = 1;
    this.material.uniforms.uRecoverableHealth.value = 1;
    this.material.uniforms.uDamageIntensity.value = 0;
    this.material.uniforms.uShieldDamageIntensity.value = 0;
    this.material.uniforms.uStaminaValue.value = 1;
    this.material.uniforms.uRecoverableStamina.value = 1;

    return this;
  }

  /**
   * 크기 변경
   */
  override setSize(width: number, height: number): this {
    this._width = width;
    this._height = height;
    this.bar.geometry.dispose();
    // 파형이 위아래로 크게 요동치므로 geometry 높이를 2배로 확장
    const waveHeightMultiplier = 2.0;
    this.bar.geometry = new PlaneGeometry(width, height * waveHeightMultiplier);

    // 플레어 크기 업데이트
    const flareSize = height * 2.5;
    for (const flare of this.flares) {
      flare.mesh.geometry.dispose();
      flare.mesh.geometry = new PlaneGeometry(flareSize, flareSize);
    }

    return this;
  }

  /**
   * 현재 값 가져오기
   */
  getHealth(): number {
    return this.targetHealth;
  }

  getStamina(): number {
    return this.targetStamina;
  }

  /**
   * 표시 중인 값 가져오기 (애니메이션 중간 값)
   */
  getDisplayedHealth(): number {
    return this.displayedHealth;
  }

  getDisplayedStamina(): number {
    return this.displayedStamina;
  }

  dispose(): void {
    this.material.dispose();
    this.bar.geometry.dispose();

    // 플레어 리소스 정리
    for (const flare of this.flares) {
      flare.material.dispose();
      flare.mesh.geometry.dispose();
    }
    this.flares = [];
  }
}
