import type * as THREE from 'three';
import type { UIBoxConfig } from './UIBox';
import type { UITextConfig } from './UIText';
import type { UIImageConfig } from './UIImage';
import type { UI9SliceConfig } from './UI9Slice';
import type { UIPanelConfig } from './UIPanel';
import type { UIButtonConfig } from './UIButton';
import type { UIProgressBarConfig } from './UIProgressBar';
import type { UIShaderBarConfig } from './UIShaderBar';
import type { UIHeartbeatBarConfig } from './UIHeartbeatBar';
import type { UICircularGaugeConfig } from './UICircularGauge';
import type { UIFloatingTextConfig } from './UIFloatingText';
import type { UITooltipConfig, TooltipLine } from './UITooltip';
import type { UIScrollViewConfig } from './UIScrollView';
import type { UISliderConfig } from './UISlider';
import type { UICheckboxConfig } from './UICheckbox';
import type { UIToggleConfig } from './UIToggle';

// THREE.Texture는 JSON 직렬화 불가 → void로 치환 후 제거
type _Texture = THREE.Texture;

/** 함수(콜백) 및 THREE.Texture 필드 자동 제거 */
type OmitNonSerializable<T> = Omit<T, {
  [K in keyof T]-?: NonNullable<T[K]> extends ((...args: any[]) => any) | _Texture ? K : never
}[keyof T]>;

// ────────────────────────────────────────────────
// 공통 기반 타입
// ────────────────────────────────────────────────

/**
 * 모든 UI 노드의 공통 기반 속성
 */
export interface UINodeDefBase {
  /** 고유 ID (런타임에서 getById() 접근 및 데이터 바인딩 용도) */
  id?: string;
  /** 에디터에서 표시되는 이름 */
  name?: string;
  /** 로컬 위치 [x, y, z] */
  position?: [number, number, number];
  /** 로컬 회전 (Euler 라디안) [x, y, z] */
  rotation?: [number, number, number];
  /** 로컬 스케일 [x, y, z] */
  scale?: [number, number, number];
  /** 가시성 */
  visible?: boolean;
  /**
   * 자식 노드
   * - UIPanel: addChild()로 레이아웃 관리
   * - 그 외 노드: Three.js add()로 추가 (수동 위치 지정 필요)
   */
  children?: UINodeDef[];
}

// ────────────────────────────────────────────────
// 위젯별 노드 Def
// ────────────────────────────────────────────────

export interface UIBoxDef extends UINodeDefBase {
  type: 'UIBox';
  props?: UIBoxConfig;
}

export interface UITextDef extends UINodeDefBase {
  type: 'UIText';
  props?: UITextConfig;
}

/** texture는 JSON에서 string(URL/경로)만 허용 */
export interface UIImageDef extends UINodeDefBase {
  type: 'UIImage';
  props?: Omit<UIImageConfig, 'texture'> & { texture?: string };
}

/** texture는 JSON에서 string(URL/경로)만 허용 */
export interface UI9SliceDef extends UINodeDefBase {
  type: 'UI9Slice';
  props?: Omit<UI9SliceConfig, 'texture'> & { texture?: string };
}

export interface UIPanelDef extends UINodeDefBase {
  type: 'UIPanel';
  props?: UIPanelConfig;
}

/** onClick은 JSON 직렬화 불가 → 런타임에서 별도 바인딩 필요 */
export interface UIButtonDef extends UINodeDefBase {
  type: 'UIButton';
  props?: OmitNonSerializable<UIButtonConfig>;
}

export interface UIProgressBarDef extends UINodeDefBase {
  type: 'UIProgressBar';
  props?: UIProgressBarConfig;
}

export interface UIShaderBarDef extends UINodeDefBase {
  type: 'UIShaderBar';
  props?: UIShaderBarConfig;
}

export interface UIHeartbeatBarDef extends UINodeDefBase {
  type: 'UIHeartbeatBar';
  props?: UIHeartbeatBarConfig;
}

export interface UICircularGaugeDef extends UINodeDefBase {
  type: 'UICircularGauge';
  props?: Partial<UICircularGaugeConfig>;
}

/** onComplete는 JSON 직렬화 불가 → 런타임에서 별도 바인딩 필요 */
export interface UIFloatingTextDef extends UINodeDefBase {
  type: 'UIFloatingText';
  props?: OmitNonSerializable<UIFloatingTextConfig>;
}

export interface UITooltipDef extends UINodeDefBase {
  type: 'UITooltip';
  props?: UITooltipConfig;
  /** 툴팁에 표시할 라인 목록 (setContent에 전달됨) */
  lines?: TooltipLine[];
}

export interface UIScrollViewDef extends UINodeDefBase {
  type: 'UIScrollView';
  props?: UIScrollViewConfig;
}

/** onChange, valueFormat은 JSON 직렬화 불가 → 런타임에서 별도 바인딩 필요 */
export interface UISliderDef extends UINodeDefBase {
  type: 'UISlider';
  props?: OmitNonSerializable<UISliderConfig>;
}

/** onChange는 JSON 직렬화 불가 → 런타임에서 별도 바인딩 필요 */
export interface UICheckboxDef extends UINodeDefBase {
  type: 'UICheckbox';
  props?: OmitNonSerializable<UICheckboxConfig>;
}

/** onChange는 JSON 직렬화 불가 → 런타임에서 별도 바인딩 필요 */
export interface UIToggleDef extends UINodeDefBase {
  type: 'UIToggle';
  props?: OmitNonSerializable<UIToggleConfig>;
}

/**
 * 다른 씬 파일 참조 (프리팹 효과)
 *
 * @example
 * { type: 'UISceneRef', src: 'hud/healthbar.json', id: 'hp_bar' }
 */
export interface UISceneRefDef extends UINodeDefBase {
  type: 'UISceneRef';
  /** 참조할 씬 파일 경로 (절대: '/ui-scenes/foo.json', 상대: 'hud/bar.json') */
  src: string;
}

/** 모든 노드 Def의 유니온 타입 */
export type UINodeDef =
  | UIBoxDef
  | UITextDef
  | UIImageDef
  | UI9SliceDef
  | UIPanelDef
  | UIButtonDef
  | UIProgressBarDef
  | UIShaderBarDef
  | UIHeartbeatBarDef
  | UICircularGaugeDef
  | UIFloatingTextDef
  | UITooltipDef
  | UIScrollViewDef
  | UISliderDef
  | UICheckboxDef
  | UIToggleDef
  | UISceneRefDef;

/** 씬 파일(.json)의 루트 타입 */
export interface UISceneDef {
  /** 스키마 버전 */
  version: '1.0';
  /** 씬 이름 */
  name: string;
  /** 루트 노드 */
  root: UINodeDef;
}
