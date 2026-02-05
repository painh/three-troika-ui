/**
 * UIHeartbeatBar - 심전도/파형 스타일 체력바 (Monster Hunter Wilds 스타일)
 *
 * 기능:
 * - 심전도 파형이 흐르는 체력바
 * - 체력에 따라 파형 강도/속도 변화
 * - 회복 가능 체력 표시 (Recoverable Health)
 * - 스태미나 바 (하단)
 */

import { PlaneGeometry, Mesh, ShaderMaterial, IUniform, AdditiveBlending, DoubleSide } from 'three';
import { UIElement } from './UIElement';

/**
 * 수직 플레어 쉐이더 (체력바 양쪽 끝 데코레이션)
 * AnamorphicFlareShader를 90도 회전 + 펄싱 효과 추가
 */
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
  uniform float uStreakLength;
  uniform float uCoreSize;
  uniform float uPulse; // 펄싱 값 (0~1)

  varying vec2 vUv;

  // 노이즈 함수
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

    // 90도 회전 (x, y 교체) - 수직 스트릭으로 변경
    vec2 rotatedUv = vec2(uv.y, uv.x);

    // === 1. 중심 코어 (불규칙한 광원) ===
    float coreDist = length(rotatedUv);

    // 코어에 불규칙함 추가
    float angle = atan(rotatedUv.y, rotatedUv.x);
    float coreNoise = noise(angle * 3.0 + uTime * 30.0) * 0.3 + 0.85;
    float distortedDist = coreDist * coreNoise;

    float coreScale = 8.0 / uCoreSize;
    float core = exp(-distortedDist * coreScale) * uIntensity;

    // 코어 내부 밝은 부분 (펄싱)
    float innerNoise = noise(uTime * 50.0) * 0.2 + 0.9;
    float innerCore = exp(-distortedDist * coreScale * 3.0) * uIntensity * 0.5 * innerNoise;

    // === 2. 수직 스트릭 (아나모픽 효과를 90도 회전) ===
    float streakFalloffX = 2.0 / uStreakLength;
    float streakFalloffY = 40.0;

    // 스트릭 기본 형태 (rotatedUv.x가 이제 수직 방향)
    float streakX = exp(-abs(rotatedUv.x) * streakFalloffX);

    // 끝을 뾰족하게
    float taper = 1.0 - smoothstep(0.0, 0.45, abs(rotatedUv.x));
    float taperY = exp(-abs(rotatedUv.y) * streakFalloffY / max(0.1, taper * taper + 0.1));

    // 끝부분 깜빡임
    float distFromCenter = abs(rotatedUv.x) / 0.5;
    float flickerAmount = distFromCenter * distFromCenter;
    float flicker = 1.0 - flickerAmount * 0.5 * noise(uTime * 60.0 + rotatedUv.x * 20.0);

    // 펄싱 효과 적용
    float pulseEffect = 0.8 + uPulse * 0.4;

    float streak = streakX * taperY * uIntensity * 0.8 * flicker * pulseEffect;

    // === 3. 보조 스트릭 (더 넓고 약한 글로우) ===
    float wideStreakX = exp(-abs(rotatedUv.x) * streakFalloffX * 0.5);
    float wideTaper = 1.0 - smoothstep(0.0, 0.5, abs(rotatedUv.x));
    float wideStreakY = exp(-abs(rotatedUv.y) * streakFalloffY * 0.7 / max(0.1, wideTaper + 0.1));

    float wideFlicker = 1.0 - flickerAmount * 0.3 * noise(uTime * 45.0 + rotatedUv.x * 15.0 + 100.0);
    float wideStreak = wideStreakX * wideStreakY * uIntensity * 0.3 * wideFlicker * pulseEffect;

    // === 4. 합성 ===
    float glow = core + innerCore + streak + wideStreak;

    // 밝기 클램핑
    glow = min(glow, 2.0);

    // 색상 적용
    vec3 finalColor = mix(uColor, vec3(1.0), glow * 0.5);
    finalColor *= glow;

    float alpha = glow;

    gl_FragColor = vec4(finalColor, alpha);
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
    vec3 finalColor = vec3(0.0);
    float alpha = 0.0;

    // 체력 범위 내에서만 파형 그리기
    if (uv.x <= uHealthValue) {
      // 현재 체력 범위(0~uHealthValue)에서 0~1로 정규화
      float normalizedX = uv.x / max(uHealthValue, 0.01);

      // 총 피격 강도 (체력 + 쉴드)
      float totalDamageIntensity = max(uDamageIntensity, uShieldDamageIntensity);

      // 파형 색상 계산
      vec3 baseColor = uHealthColor;
      vec3 waveColor = baseColor;

      // 쉴드 피격 시 파란색 (우선), 체력 피격 시 빨간색
      if (uShieldDamageIntensity > 0.01) {
        waveColor = mix(baseColor, uShieldColor, uShieldDamageIntensity);
      } else if (uDamageIntensity > 0.01) {
        waveColor = mix(baseColor, uLowHealthColor, uDamageIntensity);
      }

      // 체력 낮을 때도 빨간색으로
      if (uHealthValue < uLowHealthThreshold) {
        float t = uHealthValue / uLowHealthThreshold;
        waveColor = mix(uLowHealthColor, waveColor, t);
      }

      // === 메인 파형 (굵고 밝음, 굵기 불규칙) ===
      float mainWaveY = mhWildsWave(uv.x, uTime, uHealthValue, totalDamageIntensity, 0.0);
      float mainDist = abs(uv.y - mainWaveY);
      float thicknessMult = getWaveThickness(uv.x, uTime);
      float mainLineWidth = 0.12 * thicknessMult;
      drawWaveLine(mainWaveY, mainDist, waveColor, mainLineWidth, 1.5 * thicknessMult, finalColor, alpha);

      // === 서브 파형 1 (위쪽, 양끝에서 메인과 합류) ===
      float sub1Spread = sin(normalizedX * 3.14159); // 0→1→0 (중간에서 최대)
      // 피격 강도 동일하게 적용 (totalDamageIntensity)
      float sub1BaseY = mhWildsWave(uv.x + 0.1, uTime * 1.1, uHealthValue, totalDamageIntensity, 0.0);
      // 서브 파형 벌어짐 더 크게 (0.22 -> 0.32) - 위아래 요동 강화
      float sub1OffsetY = sub1Spread * 0.32;
      float sub1WaveY = sub1BaseY + sub1OffsetY;
      float sub1Dist = abs(uv.y - sub1WaveY);
      vec3 sub1Color = waveColor * 0.7;
      // 굵기 2배 + 불규칙 굵기 적용 (0.02 -> 0.04 * thickness)
      float sub1Thickness = getWaveThickness(uv.x + 0.1, uTime * 1.1);
      drawWaveLine(sub1WaveY, sub1Dist, sub1Color, 0.04 * sub1Thickness, 0.8 * sub1Thickness, finalColor, alpha);

      // === 서브 파형 2 (아래쪽, 양끝에서 메인과 합류) ===
      float sub2Spread = sin(normalizedX * 3.14159); // 0→1→0 (중간에서 최대)
      // 피격 강도 동일하게 적용 (totalDamageIntensity)
      float sub2BaseY = mhWildsWave(uv.x - 0.15, uTime * 0.9, uHealthValue, totalDamageIntensity, 0.0);
      // 서브 파형 벌어짐 더 크게 (0.18 -> 0.28) - 위아래 요동 강화
      float sub2OffsetY = -sub2Spread * 0.28;
      float sub2WaveY = sub2BaseY + sub2OffsetY;
      float sub2Dist = abs(uv.y - sub2WaveY);
      vec3 sub2Color = waveColor * 0.6;
      // 굵기 2배 + 불규칙 굵기 적용 (0.012 -> 0.024 * thickness)
      float sub2Thickness = getWaveThickness(uv.x - 0.15, uTime * 0.9);
      drawWaveLine(sub2WaveY, sub2Dist, sub2Color, 0.024 * sub2Thickness, 0.6 * sub2Thickness, finalColor, alpha);
    }

    // 회복 가능 체력 영역 (희미한 파형)
    if (uv.x > uHealthValue && uv.x <= uRecoverableHealth) {
      float waveY = mhWildsWave(uv.x, uTime, uHealthValue, 0.0, 0.0);
      float dist = abs(uv.y - waveY);

      float glow = exp(-dist * 25.0) * 0.25;
      if (glow > 0.03) {
        finalColor = uRecoverableColor;
        alpha = max(alpha, uOpacity * glow * 0.4);
      }
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

export class UIHeartbeatBar extends UIElement {
  private bar: Mesh;
  private material: ShaderMaterial;

  // 양쪽 플레어 데코레이션
  private leftFlare: Mesh;
  private rightFlare: Mesh;
  private leftFlareMaterial: ShaderMaterial;
  private rightFlareMaterial: ShaderMaterial;

  // 타이밍
  private globalTime: number = 0;

  // 체력 상태
  private currentHealth: number = 1;
  private displayedHealth: number = 1;
  private recoverableHealth: number = 1;
  private healthDelayTimer: number = 0;

  // 스태미나 상태
  private currentStamina: number = 1;
  private displayedStamina: number = 1;
  private recoverableStamina: number = 1;
  private staminaDelayTimer: number = 0;

  // 피격 상태
  private damageIntensity: number = 0;
  private shieldDamageIntensity: number = 0;
  private damageDecaySpeed: number = 1.5; // 피격 효과 감소 속도

  // 쉴드 상태
  private currentShield: number = 0;
  private maxShield: number = 0;

  // 설정
  private healthDelaySpeed: number;
  private staminaDelaySpeed: number;
  private delayWait: number = 0.5;

  constructor(config: UIHeartbeatBarConfig = {}) {
    super();

    this._width = config.width ?? 4;
    this._height = config.height ?? 0.5;

    this.healthDelaySpeed = config.healthDelaySpeed ?? 0.8;
    this.staminaDelaySpeed = config.staminaDelaySpeed ?? 1.2;

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

        uLowHealthThreshold: { value: config.lowHealthThreshold ?? 0.3 },
        uWaveSpeed: { value: config.waveSpeed ?? 0.8 },
        uWaveIntensity: { value: config.waveIntensity ?? 1.0 },
        uBarSplit: { value: config.barSplit ?? 0.35 },
      },
    });

    const geometry = new PlaneGeometry(this._width, this._height);
    this.bar = new Mesh(geometry, this.material);
    this.add(this.bar);

    // 플레어 색상 (체력바와 동일한 녹색 계열)
    const flareColor = toVec3(config.healthColor ?? 0x3fb950);

    // 왼쪽 플레어 생성
    this.leftFlareMaterial = new ShaderMaterial({
      vertexShader: verticalFlareVertexShader,
      fragmentShader: verticalFlareFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.6 },
        uColor: { value: flareColor },
        uStreakLength: { value: 1.2 },
        uCoreSize: { value: 0.8 },
        uPulse: { value: 0 },
      },
    });

    const flareSize = this._height * 2.5;
    const flareGeometry = new PlaneGeometry(flareSize, flareSize);
    this.leftFlare = new Mesh(flareGeometry, this.leftFlareMaterial);
    this.leftFlare.position.set(-this._width / 2, 0, 0.01);
    this.add(this.leftFlare);

    // 오른쪽 플레어 생성
    this.rightFlareMaterial = new ShaderMaterial({
      vertexShader: verticalFlareVertexShader,
      fragmentShader: verticalFlareFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.6 },
        uColor: { value: flareColor },
        uStreakLength: { value: 1.2 },
        uCoreSize: { value: 0.8 },
        uPulse: { value: 0 },
      },
    });

    this.rightFlare = new Mesh(flareGeometry.clone(), this.rightFlareMaterial);
    this.rightFlare.position.set(this._width / 2, 0, 0.01);
    this.add(this.rightFlare);

    // 초기값
    this.currentHealth = config.healthValue ?? 1;
    this.displayedHealth = this.currentHealth;
    this.recoverableHealth = this.currentHealth;

    this.currentStamina = config.staminaValue ?? 1;
    this.displayedStamina = this.currentStamina;
    this.recoverableStamina = this.currentStamina;
  }

  /**
   * 체력 설정 (0~1)
   */
  setHealth(value: number): this {
    const newValue = Math.max(0, Math.min(1, value));

    if (newValue < this.currentHealth) {
      // 피해 입음 - 회복 가능 체력은 이전 값 유지
      this.recoverableHealth = this.displayedHealth;
      this.healthDelayTimer = this.delayWait;

      // 피격 강도 설정 (피해량에 비례, 최소 0.7 보장하여 확실한 빨간색)
      const damageAmount = this.currentHealth - newValue;
      this.damageIntensity = Math.min(1, Math.max(0.7, damageAmount * 5 + 0.7));
      this.material.uniforms.uDamageIntensity.value = this.damageIntensity;
      console.log('[UIHeartbeatBar] DAMAGE! damageIntensity:', this.damageIntensity, 'amount:', damageAmount);
    } else if (newValue > this.currentHealth) {
      // 회복됨 - 바로 반영
      this.recoverableHealth = newValue;
    }

    this.currentHealth = newValue;
    this.material.uniforms.uHealthValue.value = newValue;

    return this;
  }

  /**
   * 스태미나 설정 (0~1)
   */
  setStamina(value: number): this {
    const newValue = Math.max(0, Math.min(1, value));

    if (newValue < this.currentStamina) {
      this.recoverableStamina = this.displayedStamina;
      this.staminaDelayTimer = this.delayWait;
    } else if (newValue > this.currentStamina) {
      this.recoverableStamina = newValue;
    }

    this.currentStamina = newValue;
    this.material.uniforms.uStaminaValue.value = newValue;

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
   * 매 프레임 호출
   */
  update(deltaTime: number): void {
    this.globalTime += deltaTime;
    this.material.uniforms.uTime.value = this.globalTime;

    // 플레어 애니메이션 업데이트
    this.updateFlares();

    // 오른쪽 플레어 위치를 현재 체력에 맞게 조정
    const healthX = -this._width / 2 + this._width * this.currentHealth;
    this.rightFlare.position.x = healthX;

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

    // 체력 회복 가능 게이지 애니메이션
    if (this.healthDelayTimer > 0) {
      this.healthDelayTimer -= deltaTime;
    } else {
      if (this.recoverableHealth > this.currentHealth) {
        this.recoverableHealth = Math.max(
          this.currentHealth,
          this.recoverableHealth - this.healthDelaySpeed * deltaTime
        );
      }
    }
    this.material.uniforms.uRecoverableHealth.value = this.recoverableHealth;
    this.displayedHealth = this.currentHealth;

    // 스태미나 회복 가능 게이지 애니메이션
    if (this.staminaDelayTimer > 0) {
      this.staminaDelayTimer -= deltaTime;
    } else {
      if (this.recoverableStamina > this.currentStamina) {
        this.recoverableStamina = Math.max(
          this.currentStamina,
          this.recoverableStamina - this.staminaDelaySpeed * deltaTime
        );
      }
    }
    this.material.uniforms.uRecoverableStamina.value = this.recoverableStamina;
    this.displayedStamina = this.currentStamina;
  }

  /**
   * 플레어 애니메이션 업데이트
   */
  private updateFlares(): void {
    // 시간 업데이트
    this.leftFlareMaterial.uniforms.uTime.value = this.globalTime;
    this.rightFlareMaterial.uniforms.uTime.value = this.globalTime;

    // 펄싱 효과 (서로 다른 위상으로)
    const leftPulse = Math.sin(this.globalTime * 3.5) * 0.5 + 0.5;
    const rightPulse = Math.sin(this.globalTime * 3.5 + Math.PI * 0.7) * 0.5 + 0.5;

    this.leftFlareMaterial.uniforms.uPulse.value = leftPulse;
    this.rightFlareMaterial.uniforms.uPulse.value = rightPulse;

    // 인텐시티도 약간 변동 (깜빡임 효과)
    const baseIntensity = 0.5;
    const flickerL = Math.sin(this.globalTime * 8.3) * 0.1 + Math.sin(this.globalTime * 13.7) * 0.05;
    const flickerR = Math.sin(this.globalTime * 9.1 + 1.0) * 0.1 + Math.sin(this.globalTime * 12.3) * 0.05;

    this.leftFlareMaterial.uniforms.uIntensity.value = baseIntensity + flickerL + leftPulse * 0.2;
    this.rightFlareMaterial.uniforms.uIntensity.value = baseIntensity + flickerR + rightPulse * 0.2;

    // 코어 사이즈도 펄싱
    const baseCoreSize = 0.7;
    this.leftFlareMaterial.uniforms.uCoreSize.value = baseCoreSize + leftPulse * 0.3;
    this.rightFlareMaterial.uniforms.uCoreSize.value = baseCoreSize + rightPulse * 0.3;

    // 피격 시 플레어도 색상 변경
    if (this.shieldDamageIntensity > 0.01) {
      // 쉴드 피격 시 파란색
      const blueColor: [number, number, number] = [0.23, 0.51, 0.96]; // 0x3b82f6
      const healthColor = this.leftFlareMaterial.uniforms.uColor.value as number[];
      const mixedColor = healthColor.map((c, i) =>
        c * (1 - this.shieldDamageIntensity) + blueColor[i] * this.shieldDamageIntensity
      );
      this.leftFlareMaterial.uniforms.uColor.value = mixedColor;
      this.rightFlareMaterial.uniforms.uColor.value = mixedColor;
    } else if (this.damageIntensity > 0.01) {
      // 체력 피격 시 빨간색
      const redColor: [number, number, number] = [0.97, 0.32, 0.29]; // 0xf85149
      const healthColor = this.material.uniforms.uHealthColor.value as number[];
      const mixedColor = healthColor.map((c, i) =>
        c * (1 - this.damageIntensity) + redColor[i] * this.damageIntensity
      );
      this.leftFlareMaterial.uniforms.uColor.value = mixedColor;
      this.rightFlareMaterial.uniforms.uColor.value = mixedColor;
    } else {
      // 기본 녹색으로 복귀
      const healthColor = this.material.uniforms.uHealthColor.value;
      this.leftFlareMaterial.uniforms.uColor.value = healthColor;
      this.rightFlareMaterial.uniforms.uColor.value = healthColor;
    }
  }

  /**
   * 상태 리셋
   */
  reset(): this {
    this.currentHealth = 1;
    this.displayedHealth = 1;
    this.recoverableHealth = 1;
    this.healthDelayTimer = 0;

    this.currentStamina = 1;
    this.displayedStamina = 1;
    this.recoverableStamina = 1;
    this.staminaDelayTimer = 0;

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
    this.bar.geometry = new PlaneGeometry(width, height);

    // 플레어 위치 업데이트
    this.leftFlare.position.x = -width / 2;
    this.rightFlare.position.x = -width / 2 + width * this.currentHealth;

    // 플레어 크기 업데이트
    const flareSize = height * 2.5;
    this.leftFlare.geometry.dispose();
    this.rightFlare.geometry.dispose();
    this.leftFlare.geometry = new PlaneGeometry(flareSize, flareSize);
    this.rightFlare.geometry = new PlaneGeometry(flareSize, flareSize);

    return this;
  }

  /**
   * 현재 값 가져오기
   */
  getHealth(): number {
    return this.currentHealth;
  }

  getStamina(): number {
    return this.currentStamina;
  }

  dispose(): void {
    this.material.dispose();
    this.bar.geometry.dispose();

    // 플레어 리소스 정리
    this.leftFlareMaterial.dispose();
    this.rightFlareMaterial.dispose();
    this.leftFlare.geometry.dispose();
    this.rightFlare.geometry.dispose();
  }
}
