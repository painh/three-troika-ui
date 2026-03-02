import { UIElement } from './UIElement';
import { UIBox } from './UIBox';
import { UIText } from './UIText';
import { UIImage } from './UIImage';
import { UI9Slice } from './UI9Slice';
import { UIPanel } from './UIPanel';
import { UIButton } from './UIButton';
import { UIProgressBar } from './UIProgressBar';
import { UIShaderBar } from './UIShaderBar';
import { UIHeartbeatBar } from './UIHeartbeatBar';
import { UICircularGauge } from './UICircularGauge';
import { UIFloatingText } from './UIFloatingText';
import { UITooltip } from './UITooltip';
import { UIScrollView } from './UIScrollView';
import { UISlider } from './UISlider';
import { UICheckbox } from './UICheckbox';
import { UIToggle } from './UIToggle';
import type { UINodeDef, UISceneDef } from './UISceneTypes';

/** UISceneLoader.load()의 반환 결과 */
export interface UISceneLoadResult {
  /** 씬 루트 엘리먼트 (Three.js 씬에 add 가능) */
  root: UIElement;
  /**
   * id → UIElement 매핑
   * 런타임 데이터 바인딩에 사용:
   * @example
   * const { root, ids } = await UISceneLoader.load('/ui-scenes/hud.json');
   * (ids.get('score') as UIText)?.setText('1000');
   */
  ids: Map<string, UIElement>;
}

/**
 * JSON 씬 파일을 로드하여 UIElement 트리를 생성합니다.
 *
 * @example
 * const { root, ids } = await UISceneLoader.load('/ui-scenes/hud/main.json');
 * threeScene.add(root);
 *
 * // 런타임 데이터 바인딩 (id 지정된 위젯에 직접 접근)
 * (ids.get('hp_bar') as UIShaderBar)?.setValue(hp / maxHp);
 */
export class UISceneLoader {
  /**
   * URL에서 씬 JSON을 fetch하여 UIElement 트리 생성
   * @param url 씬 JSON 파일 URL (절대 또는 상대)
   * @param basePath 씬 내 상대 경로 해결 기준 (미지정 시 url에서 자동 추론)
   */
  static async load(url: string, basePath?: string): Promise<UISceneLoadResult> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`UISceneLoader: Failed to fetch "${url}" (HTTP ${response.status})`);
    }
    const def = (await response.json()) as UISceneDef;
    const base = basePath ?? url.substring(0, url.lastIndexOf('/') + 1);
    return UISceneLoader.loadFromDef(def, base);
  }

  /**
   * UISceneDef 객체(이미 파싱된 JSON)에서 UIElement 트리 생성
   * @param def 씬 정의 객체
   * @param basePath UISceneRef 상대 경로 해결 기준
   */
  static async loadFromDef(def: UISceneDef, basePath: string = ''): Promise<UISceneLoadResult> {
    const ids = new Map<string, UIElement>();
    const root = await UISceneLoader._createNode(def.root, basePath, ids);
    return { root, ids };
  }

  // ────────────────────────────────────────────────
  // 내부 구현
  // ────────────────────────────────────────────────

  private static async _createNode(
    nodeDef: UINodeDef,
    basePath: string,
    ids: Map<string, UIElement>,
  ): Promise<UIElement> {
    let element: UIElement;

    if (nodeDef.type === 'UISceneRef') {
      // 다른 씬 파일 참조 (프리팹)
      const url = nodeDef.src.startsWith('/') ? nodeDef.src : basePath + nodeDef.src;
      const result = await UISceneLoader.load(url);
      // 참조된 씬의 id 맵 병합
      result.ids.forEach((el, id) => ids.set(id, el));
      element = result.root;
    } else {
      element = UISceneLoader._instantiate(nodeDef);
    }

    // ID 등록
    if (nodeDef.id) ids.set(nodeDef.id, element);

    // Transform 적용
    if (nodeDef.position) element.position.set(...nodeDef.position);
    if (nodeDef.rotation) element.rotation.set(...nodeDef.rotation);
    if (nodeDef.scale) element.scale.set(...nodeDef.scale);
    if (nodeDef.visible !== undefined) element.visible = nodeDef.visible;

    // 자식 노드 처리
    if (nodeDef.children?.length) {
      for (const childDef of nodeDef.children) {
        const child = await UISceneLoader._createNode(childDef, basePath, ids);
        if (element instanceof UIPanel) {
          // position이 명시된 자식은 절대 위치 플래그 설정 (layout에서 제외)
          if (childDef.position) child.userData.absolutePosition = true;
          element.addChild(child);
        } else {
          element.add(child);
        }
      }
    }

    return element;
  }

  /** UINodeDef 타입에 따라 위젯 인스턴스 생성 */
  private static _instantiate(nodeDef: Exclude<UINodeDef, { type: 'UISceneRef' }>): UIElement {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = (nodeDef as any).props ?? {};

    switch (nodeDef.type) {
      case 'UIBox':           return new UIBox(p);
      case 'UIText':          return new UIText(p);
      case 'UIImage':         return new UIImage(p);
      case 'UI9Slice':        return new UI9Slice(p);
      case 'UIPanel':         return new UIPanel(p);
      case 'UIButton':        return new UIButton(p);
      case 'UIProgressBar':   return new UIProgressBar(p);
      case 'UIShaderBar':     return new UIShaderBar(p);
      case 'UIHeartbeatBar':  return new UIHeartbeatBar(p);
      // UICircularGauge는 Group 상속 (UIElement 아님) → 캐스팅
      case 'UICircularGauge': return new UICircularGauge(p) as unknown as UIElement;
      case 'UIFloatingText':  return new UIFloatingText(p);
      case 'UITooltip': {
        const tooltip = new UITooltip(p);
        if (nodeDef.lines?.length) tooltip.setContent(nodeDef.lines);
        return tooltip;
      }
      case 'UIScrollView':    return new UIScrollView(p);
      case 'UISlider':        return new UISlider(p);
      case 'UICheckbox':      return new UICheckbox(p);
      case 'UIToggle':        return new UIToggle(p);
      default:
        throw new Error(`UISceneLoader: Unknown node type "${(nodeDef as UINodeDef).type}"`);
    }
  }
}
