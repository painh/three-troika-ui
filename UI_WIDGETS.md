# Three-Troika-UI 위젯 시스템

Three.js 기반 게임용 UI 컴포넌트 라이브러리

## 현재 구현된 위젯

### 기본 요소

| 위젯 | 상태 | 설명 |
|------|------|------|
| UIElement | ✅ 완료 | 모든 UI의 기본 클래스 |
| UIText | ✅ 완료 | Troika 기반 텍스트 렌더링 |
| UIBox | ✅ 완료 | 배경 박스 (둥근 모서리, 테두리, 호버) |
| UIImage | ✅ 완료 | 이미지/스프라이트 표시 |
| UIPanel | ✅ 완료 | Flex 레이아웃 컨테이너 |

### 고급 요소

| 위젯 | 상태 | 설명 |
|------|------|------|
| UIProgressBar | ✅ 완료 | 진행률 바 |
| UIFloatingText | ✅ 완료 | 떠다니는 텍스트 (데미지 표시) |
| UITooltip | ✅ 완료 | 자동 크기/위치 조절 툴팁 |
| UIButton | 🔨 작업중 | 클릭 가능한 버튼 |
| UIScrollView | 🔨 작업중 | 스텐실 마스킹 스크롤 뷰 |
| UISlider | 📋 예정 | 값 조절 슬라이더 |
| UICheckbox | 📋 예정 | 체크박스 |
| UIToggle | 📋 예정 | 토글 스위치 |

---

## UIButton

텍스트와 배경이 결합된 클릭 가능한 버튼

### 기능
- [x] 배경 색상/투명도
- [x] 둥근 모서리
- [x] 호버 색상 변경
- [x] 클릭 색상 변경
- [x] 텍스트 라벨
- [x] 아이콘 지원 (선택)
- [x] 비활성화 상태

### 사용법
```typescript
const button = new UIButton({
  text: 'Click Me',
  width: 2,
  height: 0.5,
  fontSize: 0.2,
  color: 0x3498db,
  hoverColor: 0x2980b9,
  pressColor: 0x1a5276,
  textColor: 0xffffff,
  borderRadius: 0.1,
  onClick: () => console.log('Clicked!'),
});
```

---

## UIScrollView

스텐실 버퍼를 사용한 콘텐츠 클리핑 스크롤 뷰

### 기능
- [x] 콘텐츠 클리핑 (스텐실 마스킹)
- [x] 수직 스크롤
- [x] 스크롤바 표시
- [x] 스크롤바 드래그
- [x] 마우스 휠 스크롤
- [ ] 수평 스크롤
- [ ] 스크롤 모멘텀

### 사용법
```typescript
const scrollView = new UIScrollView({
  width: 4,
  height: 3,
  contentHeight: 10,
  showScrollbar: true,
  scrollbarWidth: 0.15,
});

scrollView.addContent(someUIElement);
scrollView.scroll(0.5); // 50% 스크롤
```

---

## UISlider

값을 조절할 수 있는 슬라이더

### 기능
- [ ] 트랙 배경
- [ ] 드래그 가능한 핸들
- [ ] min/max 값 범위
- [ ] 현재 값 표시
- [ ] 수직/수평 방향
- [ ] 스텝 단위

### 사용법 (예정)
```typescript
const slider = new UISlider({
  width: 3,
  min: 0,
  max: 100,
  value: 50,
  step: 1,
  onChange: (value) => console.log(value),
});
```

---

## UICheckbox

체크 가능한 박스

### 기능
- [ ] 체크/해제 상태
- [ ] 체크 마크 표시
- [ ] 라벨 텍스트
- [ ] 클릭 토글

### 사용법 (예정)
```typescript
const checkbox = new UICheckbox({
  label: 'Enable Sound',
  checked: true,
  onChange: (checked) => console.log(checked),
});
```

---

## UIToggle

온/오프 토글 스위치

### 기능
- [ ] 토글 애니메이션
- [ ] 온/오프 색상
- [ ] 라벨 텍스트

### 사용법 (예정)
```typescript
const toggle = new UIToggle({
  label: 'Dark Mode',
  value: false,
  onColor: 0x2ecc71,
  offColor: 0x7f8c8d,
  onChange: (value) => console.log(value),
});
```

---

## 변경 이력

- 2024-01: UIButton, UIScrollView 작업 시작
- 2024-01: UITooltip 추가
- 2024-01: UIFloatingText 추가
- 2024-01: UIBox 호버 색상 지원 추가
