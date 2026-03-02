import type { UINodeDef, UISceneDef } from './UISceneTypes';

/**
 * UISceneDef ↔ JSON 직렬화/역직렬화 유틸리티
 *
 * 에디터에서 UINodeDef 트리를 상태로 관리하고,
 * 저장 시 serialize() → JSON 파일, 불러올 때 deserialize() → UINodeDef 트리.
 *
 * 런타임 UIElement 트리 생성은 UISceneLoader를 사용하세요.
 */
export class UISceneSerializer {
  /**
   * UISceneDef → JSON 문자열
   * @param def 직렬화할 씬 정의
   * @param pretty true면 들여쓰기 2칸 포함 (기본 true)
   */
  static serialize(def: UISceneDef, pretty = true): string {
    return JSON.stringify(def, null, pretty ? 2 : undefined);
  }

  /**
   * JSON 문자열 → UISceneDef
   * @throws JSON.parse 실패 또는 version 불일치 시 Error
   */
  static deserialize(json: string): UISceneDef {
    let def: UISceneDef;
    try {
      def = JSON.parse(json) as UISceneDef;
    } catch (e) {
      throw new Error(`UISceneSerializer: Invalid JSON - ${(e as Error).message}`);
    }
    if (def.version !== '1.0') {
      throw new Error(`UISceneSerializer: Unsupported version "${def.version}" (expected "1.0")`);
    }
    return def;
  }

  /**
   * 새 빈 씬 Def 생성
   */
  static createEmpty(name: string): UISceneDef {
    return {
      version: '1.0',
      name,
      root: {
        type: 'UIPanel',
        id: 'root',
        name: 'Root',
        props: { width: 10, height: 6, direction: 'vertical' },
        children: [],
      },
    };
  }

  /**
   * 씬 Def에서 모든 노드 id 목록을 평탄화하여 반환
   */
  static collectIds(def: UISceneDef): string[] {
    const ids: string[] = [];
    const visit = (node: UINodeDef) => {
      if (node.id) ids.push(node.id);
      if (node.children) node.children.forEach(visit);
    };
    visit(def.root);
    return ids;
  }

  /**
   * id로 노드 Def를 탐색하여 반환 (없으면 null)
   */
  static findById(def: UISceneDef, id: string): UINodeDef | null {
    const visit = (node: UINodeDef): UINodeDef | null => {
      if (node.id === id) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = visit(child);
          if (found) return found;
        }
      }
      return null;
    };
    return visit(def.root);
  }

  /**
   * 특정 노드의 부모 노드 반환 (없으면 null)
   */
  static findParent(def: UISceneDef, targetId: string): UINodeDef | null {
    const visit = (node: UINodeDef): UINodeDef | null => {
      if (node.children) {
        for (const child of node.children) {
          if (child.id === targetId) return node;
          const found = visit(child);
          if (found) return found;
        }
      }
      return null;
    };
    return visit(def.root);
  }
}
