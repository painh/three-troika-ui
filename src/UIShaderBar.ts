/**
 * UIShaderBar - 쉐이더 기반 고급 프로그레스 바
 *
 * 기능:
 * - 메인 게이지 + 지연 게이지 (피격 시 노란색 잔상)
 * - 쉴드 게이지 + 쉴드 지연 게이지
 * - 쉴드 지연 증가 (천천히 차오름)
 * - 노이즈 엣지 효과
 * - 체력 낮을 때 맥동 효과
 * - 디졸브 효과
 */

import { PlaneGeometry, Mesh, ShaderMaterial, IUniform } from 'three';
import { UIElement } from './UIElement';

// 쉐이더 코드
const shaderBarVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shaderBarFragmentShader = `
  uniform float uValue;
  uniform float uDelayedValue;
  uniform float uShieldValue;
  uniform float uDelayedShieldValue;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uDissolve;

  uniform vec3 uBackgroundColor;
  uniform vec3 uFillColor;
  uniform vec3 uDelayColor;
  uniform vec3 uShieldColor;
  uniform vec3 uShieldDelayColor;
  uniform vec3 uLowHealthColor;
  uniform vec3 uDissolveEdgeColor;

  uniform float uLowHealthThreshold;
  uniform bool uEnableNoise;
  uniform bool uEnablePulse;
  uniform bool uEnableShine;
  uniform bool uEnableDissolve;

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
    float frequency = 1.0;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    // 디졸브 효과
    if (uEnableDissolve && uDissolve > 0.0) {
      float dissolveNoise = fbm(vUv * 8.0 + uTime * 2.0);
      float dissolveThreshold = uDissolve * 1.2;
      if (dissolveNoise < dissolveThreshold) {
        float edgeDist = dissolveThreshold - dissolveNoise;
        if (edgeDist < 0.1) {
          gl_FragColor = vec4(uDissolveEdgeColor, uOpacity * (1.0 - edgeDist * 10.0));
          return;
        }
        discard;
      }
    }

    vec3 bgColor = uBackgroundColor;
    float valueEdge = uValue;

    // 노이즈 엣지
    float edgeNoise = 0.0;
    float leftEdge = 0.0;
    if (uEnableNoise) {
      edgeNoise = noise(vec2(vUv.y * 30.0, uTime * 3.0)) * 0.02 - 0.01;
      leftEdge = noise(vec2(vUv.y * 30.0 + 100.0, uTime * 3.0)) * 0.02;
      valueEdge += edgeNoise;
    }

    // 메인 게이지 색상
    vec3 fillColor = uFillColor;

    // 낮은 값일 때 색상 변경
    if (uValue < uLowHealthThreshold) {
      fillColor = mix(uLowHealthColor, uFillColor, uValue / uLowHealthThreshold);
    }

    // 광택 효과
    if (uEnableShine) {
      float shine = smoothstep(0.4, 0.6, vUv.y) * 0.3;
      fillColor += shine;
    }

    // 맥동 효과
    if (uEnablePulse && uValue < uLowHealthThreshold) {
      float pulse = sin(uTime * 5.0) * 0.5 + 0.5;
      fillColor *= 0.8 + pulse * 0.4;
    }

    vec3 delayColor = uDelayColor;
    float delayEdge = uDelayedValue + edgeNoise;

    vec3 shieldColor = uShieldColor;
    if (uEnableShine) {
      float shine = smoothstep(0.4, 0.6, vUv.y) * 0.3;
      shieldColor += shine;
    }

    vec3 shieldDelayColor = uShieldDelayColor;
    float shieldEdge = uShieldValue + edgeNoise;
    float shieldDelayEdge = uDelayedShieldValue + edgeNoise;

    // 레이어링 (뒤에서 앞으로)
    vec3 finalColor = bgColor;

    // 1. 메인 지연 게이지
    if (vUv.x > leftEdge && vUv.x < delayEdge) {
      finalColor = delayColor;
    }
    // 2. 메인 게이지
    if (vUv.x > leftEdge && vUv.x < valueEdge) {
      finalColor = fillColor;
    }
    // 3. 쉴드 지연 게이지
    if (vUv.x > leftEdge && vUv.x < shieldDelayEdge) {
      finalColor = shieldDelayColor;
    }
    // 4. 쉴드 게이지
    if (vUv.x > leftEdge && vUv.x < shieldEdge) {
      finalColor = shieldColor;
    }

    // 디졸브 시 색상 변화
    if (uEnableDissolve && uDissolve > 0.0) {
      float redShift = uDissolve * 0.5;
      finalColor = mix(finalColor, uDissolveEdgeColor, redShift);
    }

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

export interface UIShaderBarConfig {
  width?: number;
  height?: number;

  // 초기값
  value?: number;
  shieldValue?: number;

  // 색상
  backgroundColor?: number;
  fillColor?: number;
  delayColor?: number;
  shieldColor?: number;
  shieldDelayColor?: number;
  lowHealthColor?: number;
  dissolveEdgeColor?: number;

  // 동작 설정
  lowHealthThreshold?: number;
  delayWait?: number;
  delaySpeed?: number;
  shieldFillSpeed?: number;

  // 효과 토글
  enableNoise?: boolean;
  enablePulse?: boolean;
  enableShine?: boolean;
  enableDissolve?: boolean;
}

export class UIShaderBar extends UIElement {
  private bar: Mesh;
  private material: ShaderMaterial;

  // 타이밍
  private globalTime: number = 0;

  // 메인 게이지 상태
  private currentValue: number = 1;
  private delayedValue: number = 1;
  private lastValue: number = -1;
  private delayTimer: number = 0;

  // 쉴드 게이지 상태
  private currentShieldValue: number = 0;
  private delayedShieldValue: number = 0;
  private lastShieldValue: number = -1;
  private shieldDelayTimer: number = 0;
  private lastMaxShield: number = 0;

  // 디졸브 상태
  private dissolveAmount: number = 0;
  private isDissolving: boolean = false;
  private dissolveSpeed: number = 1.5;

  // 설정값
  private delayWait: number;
  private delaySpeed: number;
  private shieldFillSpeed: number;

  constructor(config: UIShaderBarConfig = {}) {
    super();

    this._width = config.width ?? 2;
    this._height = config.height ?? 0.2;

    this.delayWait = config.delayWait ?? 0.3;
    this.delaySpeed = config.delaySpeed ?? 1.0;
    this.shieldFillSpeed = config.shieldFillSpeed ?? 0.3;

    // 색상을 vec3로 변환하는 헬퍼
    const toVec3 = (color: number): [number, number, number] => [
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
    ];

    this.material = new ShaderMaterial({
      vertexShader: shaderBarVertexShader,
      fragmentShader: shaderBarFragmentShader,
      transparent: true,
      uniforms: {
        uValue: { value: config.value ?? 1 } as IUniform<number>,
        uDelayedValue: { value: config.value ?? 1 } as IUniform<number>,
        uShieldValue: { value: config.shieldValue ?? 0 } as IUniform<number>,
        uDelayedShieldValue: { value: config.shieldValue ?? 0 } as IUniform<number>,
        uOpacity: { value: 1 } as IUniform<number>,
        uTime: { value: 0 } as IUniform<number>,
        uDissolve: { value: 0 } as IUniform<number>,

        uBackgroundColor: { value: toVec3(config.backgroundColor ?? 0x1a1a1e) },
        uFillColor: { value: toVec3(config.fillColor ?? 0xb31a1a) },
        uDelayColor: { value: toVec3(config.delayColor ?? 0xe6b319) },
        uShieldColor: { value: toVec3(config.shieldColor ?? 0x1a80e6) },
        uShieldDelayColor: { value: toVec3(config.shieldDelayColor ?? 0x99ccff) },
        uLowHealthColor: { value: toVec3(config.lowHealthColor ?? 0x660d0d) },
        uDissolveEdgeColor: { value: toVec3(config.dissolveEdgeColor ?? 0xff4d1a) },

        uLowHealthThreshold: { value: config.lowHealthThreshold ?? 0.3 },
        uEnableNoise: { value: config.enableNoise ?? true },
        uEnablePulse: { value: config.enablePulse ?? true },
        uEnableShine: { value: config.enableShine ?? true },
        uEnableDissolve: { value: config.enableDissolve ?? true },
      },
    });

    const geometry = new PlaneGeometry(this._width, this._height);
    this.bar = new Mesh(geometry, this.material);
    this.add(this.bar);

    // 초기값 설정
    this.currentValue = config.value ?? 1;
    this.delayedValue = this.currentValue;
    this.currentShieldValue = config.shieldValue ?? 0;
    this.delayedShieldValue = this.currentShieldValue;
  }

  /**
   * 메인 게이지 값 설정 (0~1)
   */
  setValue(value: number): this {
    const percent = Math.max(0, Math.min(1, value));
    this.currentValue = percent;
    this.material.uniforms.uValue.value = percent;

    if (this.lastValue < 0) {
      this.lastValue = percent;
      this.delayedValue = percent;
      this.material.uniforms.uDelayedValue.value = percent;
      return this;
    }

    const diff = percent - this.lastValue;

    if (diff < 0) {
      this.delayTimer = this.delayWait;
    } else if (diff > 0) {
      this.delayTimer = 0;
      this.delayedValue = percent;
      this.material.uniforms.uDelayedValue.value = percent;
    }

    this.lastValue = percent;
    return this;
  }

  /**
   * 쉴드 게이지 값 설정
   * @param value 현재 쉴드 값
   * @param max 최대 쉴드 값 (0이면 쉴드 없음, max가 바뀌면 새 페이즈로 인식)
   */
  setShield(value: number, max: number): this {
    if (max <= 0) {
      this.currentShieldValue = 0;
      this.delayedShieldValue = 0;
      this.lastShieldValue = 0;
      this.lastMaxShield = 0;
      this.material.uniforms.uShieldValue.value = 0;
      this.material.uniforms.uDelayedShieldValue.value = 0;
      return this;
    }

    const percent = Math.max(0, Math.min(1, value / max));

    // max가 바뀌면 새 쉴드 페이즈 - 0부터 천천히 차오름
    if (max !== this.lastMaxShield) {
      this.lastMaxShield = max;
      this.currentShieldValue = percent;
      this.delayedShieldValue = 0;
      this.lastShieldValue = 0;
      this.shieldDelayTimer = 0;
      this.material.uniforms.uShieldValue.value = 0;
      this.material.uniforms.uDelayedShieldValue.value = 0;
      return this;
    }

    const prevTarget = this.currentShieldValue;
    this.currentShieldValue = percent;

    if (this.lastShieldValue < 0) {
      this.lastShieldValue = percent;
      this.delayedShieldValue = percent;
      this.material.uniforms.uShieldValue.value = percent;
      this.material.uniforms.uDelayedShieldValue.value = percent;
      return this;
    }

    const shieldDiff = percent - prevTarget;
    const displayedShield = this.material.uniforms.uShieldValue.value as number;

    if (shieldDiff < 0) {
      if (percent < displayedShield) {
        this.material.uniforms.uShieldValue.value = percent;
        this.delayedShieldValue = displayedShield;
        this.material.uniforms.uDelayedShieldValue.value = displayedShield;
        this.shieldDelayTimer = this.delayWait;
      }
    }

    this.lastShieldValue = percent;
    return this;
  }

  /**
   * 디졸브 효과 시작
   */
  startDissolve(speed?: number): this {
    this.isDissolving = true;
    this.dissolveSpeed = speed ?? 1.5;
    return this;
  }

  /**
   * 디졸브 중인지 확인
   */
  isDissolveInProgress(): boolean {
    return this.isDissolving;
  }

  /**
   * 디졸브/상태 리셋
   */
  reset(): this {
    this.dissolveAmount = 0;
    this.isDissolving = false;
    this.material.uniforms.uDissolve.value = 0;

    this.currentValue = 1;
    this.delayedValue = 1;
    this.lastValue = -1;
    this.delayTimer = 0;
    this.material.uniforms.uValue.value = 1;
    this.material.uniforms.uDelayedValue.value = 1;

    this.currentShieldValue = 0;
    this.delayedShieldValue = 0;
    this.lastShieldValue = -1;
    this.shieldDelayTimer = 0;
    this.lastMaxShield = 0;
    this.material.uniforms.uShieldValue.value = 0;
    this.material.uniforms.uDelayedShieldValue.value = 0;

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
   * 색상 설정
   */
  setFillColor(color: number): this {
    this.material.uniforms.uFillColor.value = [
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
    ];
    return this;
  }

  setShieldColor(color: number): this {
    this.material.uniforms.uShieldColor.value = [
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
    ];
    return this;
  }

  /**
   * 매 프레임 호출 필요
   */
  update(deltaTime: number): void {
    this.globalTime += deltaTime;
    this.material.uniforms.uTime.value = this.globalTime;

    // 메인 지연 게이지 애니메이션
    if (this.delayTimer > 0) {
      this.delayTimer -= deltaTime;
    } else {
      if (this.delayedValue > this.currentValue) {
        this.delayedValue = Math.max(
          this.currentValue,
          this.delayedValue - this.delaySpeed * deltaTime
        );
        this.material.uniforms.uDelayedValue.value = this.delayedValue;
      }
    }

    // 쉴드 게이지 애니메이션
    const displayedShield = this.material.uniforms.uShieldValue.value as number;

    // 쉴드 증가 (천천히)
    if (displayedShield < this.currentShieldValue) {
      const newShield = Math.min(
        this.currentShieldValue,
        displayedShield + this.shieldFillSpeed * deltaTime
      );
      this.material.uniforms.uShieldValue.value = newShield;
    }

    // 쉴드 지연 게이지
    if (this.shieldDelayTimer > 0) {
      this.shieldDelayTimer -= deltaTime;
    } else {
      if (this.delayedShieldValue > this.currentShieldValue) {
        this.delayedShieldValue = Math.max(
          this.currentShieldValue,
          this.delayedShieldValue - this.delaySpeed * deltaTime
        );
        this.material.uniforms.uDelayedShieldValue.value = this.delayedShieldValue;
      } else if (this.delayedShieldValue < displayedShield) {
        this.delayedShieldValue = displayedShield;
        this.material.uniforms.uDelayedShieldValue.value = this.delayedShieldValue;
      }
    }

    // 디졸브 애니메이션
    if (this.isDissolving) {
      this.dissolveAmount += deltaTime * this.dissolveSpeed;
      this.material.uniforms.uDissolve.value = this.dissolveAmount;

      if (this.dissolveAmount >= 1) {
        this.visible = false;
        this.isDissolving = false;
      }
    }
  }

  /**
   * 크기 변경
   */
  override setSize(width: number, height: number): this {
    this._width = width;
    this._height = height;
    this.bar.geometry.dispose();
    this.bar.geometry = new PlaneGeometry(width, height);
    return this;
  }

  /**
   * 현재 값 가져오기
   */
  getValue(): number {
    return this.currentValue;
  }

  getShieldValue(): number {
    return this.currentShieldValue;
  }

  dispose(): void {
    this.material.dispose();
    this.bar.geometry.dispose();
  }
}
