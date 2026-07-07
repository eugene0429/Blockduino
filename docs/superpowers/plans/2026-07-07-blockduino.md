# Blockduino 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한글 블록을 조립해 Arduino C++ 코드를 생성하고 버튼 하나로 Uno R3에 업로드하는 초중등용 윈도우 데스크톱 앱.

**Architecture:** Electron(메인 프로세스: 파일 I/O·arduino-cli 실행, 렌더러: Blockly 편집기·코드 미리보기·배선 안내)을 IPC로 연결. 블록→코드 변환은 Blockly `CodeGenerator`를 상속한 순수 JS 모듈로 만들어 Node에서 헤드리스 단위 테스트한다. arduino-cli 바이너리와 AVR 코어/라이브러리를 설치파일에 동봉해 완전 오프라인 동작.

**Tech Stack:** Electron ^31, Blockly ^11.2, arduino-cli 1.1.1(동봉), vitest ^1.6(테스트), electron-builder ^24(NSIS 설치파일)

## Global Constraints

- 지원 보드: Arduino Uno R3만 (`--fqbn arduino:avr:uno`)
- 모든 UI 문구·블록 라벨·오류 메시지는 한글 (스펙 7절 문구 그대로 사용)
- 완전 오프라인 동작: 런타임에 네트워크 접근 금지 (빌드 시 1회 다운로드만 허용)
- 프로젝트 파일 확장자 `.bdn`, 내용은 Blockly serialization JSON
- 핀 선택은 드롭다운으로 제한: 디지털 D0–D13, 아날로그 A0–A5, PWM은 3,5,6,9,10,11
- 렌더러는 `nodeIntegration: true, contextIsolation: false` (오프라인 로컬 앱이므로 번들러 없이 CJS `require` 공유를 우선)
- 소스 모듈은 CommonJS (렌더러와 vitest가 같은 파일을 그대로 사용)
- 커밋 메시지는 conventional commits (`feat:`, `test:`, `chore:` …)

## 파일 구조

```
package.json                      # 스크립트, 의존성, electron-builder 설정
src/main/main.js                  # Electron 엔트리, 창 생성
src/main/ipc.js                   # IPC 핸들러 (프로젝트 저장/열기, 포트, 업로드)
src/main/arduino.js               # arduino-cli 래퍼 (경로/env/compile/upload/board list)
src/main/messages.js              # cli 오류 → 학생용 한글 메시지 분류 (순수 함수)
src/shared/arduino-generator.js   # ArduinoGenerator 코어 (include/선언/setup 수집)
src/shared/blocks/basic.js        # 기본 블록 + 생성기
src/shared/blocks/logic.js        # 논리/반복/변수/수학/텍스트 생성기 (Blockly 내장 블록용)
src/shared/blocks/io.js           # 입출력 블록 + 생성기
src/shared/blocks/sensors.js      # 센서 블록 + 생성기 (초음파, DHT11, CDS)
src/shared/blocks/motor-lcd.js    # 서보/LCD 블록 + 생성기
src/shared/blocks/index.js        # 위 블록 모듈 전부 로드
src/shared/pins.js                # 핀 드롭다운 상수
src/renderer/index.html           # 3단 레이아웃 + 툴바 + 상태바
src/renderer/style.css
src/renderer/renderer.js          # Blockly 주입, 코드 미리보기, 업로드/저장 UI
src/renderer/toolbox.js           # 한글 카테고리 toolbox 정의
src/renderer/wiring.js            # 부품별 배선 데이터 + SVG 카드 렌더러
scripts/prepare-arduino.mjs       # 빌드 시 arduino-cli + 코어 + 라이브러리 준비
tests/generator-core.test.js
tests/blocks-basic.test.js
tests/blocks-logic.test.js
tests/blocks-io.test.js
tests/blocks-sensors.test.js
tests/blocks-motor-lcd.test.js
tests/arduino-parse.test.js       # board list 파싱, 오류 분류
vendor/arduino/                   # (git 제외) cli 바이너리 + data/user 디렉터리
```

---

### Task 1: Electron 앱 뼈대

**Files:**
- Create: `package.json`, `.gitignore`, `src/main/main.js`, `src/renderer/index.html`, `src/renderer/style.css`

**Interfaces:**
- Produces: `npm start`로 열리는 창. `index.html`에 이후 태스크가 쓰는 DOM id: `#blocklyDiv`, `#code-preview`, `#wiring-panel`, `#tab-code`, `#tab-wiring`, `#btn-open`, `#btn-save`, `#port-select`, `#btn-upload`, `#status-bar`, `#project-name`

- [x] **Step 1: package.json / .gitignore 작성**

```json
{
  "name": "blockduino",
  "version": "0.1.0",
  "description": "초중등 학생용 블록 코딩 아두이노 프로그램",
  "main": "src/main/main.js",
  "scripts": {
    "start": "electron .",
    "test": "vitest run",
    "prepare-arduino": "node scripts/prepare-arduino.mjs",
    "dist": "electron-builder --win nsis"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3",
    "vitest": "^1.6.0"
  },
  "dependencies": {
    "blockly": "^11.2.0"
  }
}
```

`.gitignore`는 이미 저장소 루트에 존재한다 (`node_modules/`, `dist/`, `vendor/`, `*.log`, `.claude/settings.local.json`). 새로 만들거나 덮어쓰지 말 것.

- [x] **Step 2: 메인 프로세스**

`src/main/main.js`:

```js
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Blockduino',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

module.exports = { createWindow };
```

- [x] **Step 3: 3단 레이아웃 HTML/CSS**

`src/renderer/index.html`:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>Blockduino</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header id="toolbar">
    <input id="project-name" value="새 프로젝트" />
    <button id="btn-open">열기</button>
    <button id="btn-save">저장</button>
    <span class="spacer"></span>
    <select id="port-select"><option value="">보드를 연결하세요</option></select>
    <button id="btn-upload">⬆ 업로드</button>
  </header>
  <main>
    <div id="blocklyDiv"></div>
    <aside id="side-panel">
      <nav>
        <button id="tab-code" class="active">코드</button>
        <button id="tab-wiring">배선</button>
      </nav>
      <pre id="code-preview"></pre>
      <div id="wiring-panel" hidden></div>
    </aside>
  </main>
  <footer id="status-bar">준비됨</footer>
  <script src="renderer.js"></script>
</body>
</html>
```

`src/renderer/style.css`:

```css
* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; }
body { display: flex; flex-direction: column; }
#toolbar { display: flex; gap: 8px; padding: 8px; background: #4c97ff; align-items: center; }
#toolbar .spacer { flex: 1; }
#project-name { border: none; border-radius: 4px; padding: 6px 10px; font-size: 15px; width: 200px; }
#toolbar button, #toolbar select { padding: 6px 14px; font-size: 15px; border: none; border-radius: 4px; cursor: pointer; }
#btn-upload { background: #ffab19; font-weight: bold; }
main { flex: 1; display: flex; min-height: 0; }
#blocklyDiv { flex: 1; min-width: 0; }
#side-panel { width: 360px; display: flex; flex-direction: column; border-left: 1px solid #ccc; }
#side-panel nav { display: flex; }
#side-panel nav button { flex: 1; padding: 8px; border: none; background: #eee; cursor: pointer; }
#side-panel nav button.active { background: #fff; font-weight: bold; }
#code-preview { flex: 1; overflow: auto; padding: 10px; font-size: 13px; background: #fafafa; }
#wiring-panel { flex: 1; overflow: auto; padding: 10px; }
#status-bar { padding: 6px 12px; background: #333; color: #fff; font-size: 13px; }
```

`src/renderer/renderer.js`는 이 태스크에서는 빈 파일로 생성한다 (Task 8에서 구현).

- [x] **Step 4: 실행 확인**

Run: `npm install && npm start`
Expected: "Blockduino" 창이 뜨고 툴바/좌측 빈 영역/우측 "코드·배선" 탭/하단 상태바가 보인다. 창을 닫아 종료.

- [x] **Step 5: Commit**

```bash
git add package.json .gitignore src
git commit -m "feat: Electron 앱 뼈대와 3단 레이아웃"
```

---

### Task 2: Arduino 코드 생성기 코어

**Files:**
- Create: `src/shared/arduino-generator.js`, `src/shared/pins.js`
- Test: `tests/generator-core.test.js`

**Interfaces:**
- Produces:
  - `arduinoGenerator` 싱글턴과 `Order` 상수 (`require('../src/shared/arduino-generator.js')` → `{ arduinoGenerator, ArduinoGenerator, Order }`)
  - 생성기 메서드: `addInclude(key, code)`, `addDeclaration(key, code)`, `addSetup(key, code)`, `addFunction(key, code)` — 같은 key는 1회만 출력
  - 블록 생성기가 쓰는 필드: `setupBody_`, `loopBody_` (statementToCode 결과를 그대로 대입)
  - `varName(variableModel)` — 한글 변수명을 C 식별자로 변환
  - `pins.js` → `{ DIGITAL_PINS, PWM_PINS, ANALOG_PINS }` (Blockly 드롭다운 `[label, value]` 배열)

- [x] **Step 1: 실패하는 테스트 작성**

`tests/generator-core.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import * as Blockly from 'blockly';

function emptyCode() {
  const ws = new Blockly.Workspace();
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('ArduinoGenerator 코어', () => {
  it('빈 워크스페이스 → 빈 setup/loop 스켈레톤', () => {
    expect(emptyCode()).toBe('void setup() {\n}\n\nvoid loop() {\n}\n');
  });

  it('include/선언/함수/셋업은 key당 1회, 순서대로 조립된다', () => {
    const ws = new Blockly.Workspace();
    g.init(ws);
    g.addInclude('servo', '#include <Servo.h>');
    g.addInclude('servo', '#include <Servo.h>');
    g.addDeclaration('servo_9', 'Servo servo_9;');
    g.addFunction('helper', 'int helper() {\n  return 1;\n}');
    g.addSetup('servo_9', 'servo_9.attach(9);');
    g.setupBody_ = '  digitalWrite(13, HIGH);\n';
    g.loopBody_ = '  delay(100);\n';
    const code = g.finish('');
    ws.dispose();
    expect(code).toBe(
      '#include <Servo.h>\n\n' +
      'Servo servo_9;\n\n' +
      'int helper() {\n  return 1;\n}\n\n' +
      'void setup() {\n  servo_9.attach(9);\n  digitalWrite(13, HIGH);\n}\n\n' +
      'void loop() {\n  delay(100);\n}\n'
    );
  });

  it('한글 변수는 C 식별자로 치환되고 float 전역으로 선언된다', () => {
    const ws = new Blockly.Workspace();
    ws.createVariable('속도');
    ws.createVariable('count');
    const code = g.workspaceToCode(ws);
    ws.dispose();
    expect(code).toContain('float var1 = 0;');   // '속도' → var1
    expect(code).toContain('float count = 0;');  // ASCII 이름은 유지
  });
});
```

- [x] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/generator-core.test.js`
Expected: FAIL — `Cannot find module '../src/shared/arduino-generator.js'`

- [x] **Step 3: 구현**

`src/shared/pins.js`:

```js
'use strict';
const DIGITAL_PINS = Array.from({ length: 14 }, (_, i) => [String(i), String(i)]);
const PWM_PINS = ['3', '5', '6', '9', '10', '11'].map((p) => [p, p]);
const ANALOG_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((p) => [p, p]);
module.exports = { DIGITAL_PINS, PWM_PINS, ANALOG_PINS };
```

`src/shared/arduino-generator.js`:

```js
'use strict';
const Blockly = require('blockly/core');

const Order = {
  ATOMIC: 0,
  UNARY: 2,
  MULTIPLICATIVE: 5,
  ADDITIVE: 6,
  RELATIONAL: 8,
  EQUALITY: 9,
  LOGICAL_AND: 13,
  LOGICAL_OR: 14,
  NONE: 99,
};

class ArduinoGenerator extends Blockly.CodeGenerator {
  constructor() {
    super('Arduino');
    this.INDENT = '  ';
    this.addReservedWords(
      'setup,loop,if,else,for,while,do,break,continue,return,' +
      'int,long,float,double,char,boolean,void,byte,word,String,' +
      'HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,true,false'
    );
  }

  init(workspace) {
    super.init(workspace);
    this.includes_ = new Map();
    this.declarations_ = new Map();
    this.setups_ = new Map();
    this.functions_ = new Map();
    this.setupBody_ = '';
    this.loopBody_ = '';
    this.varNames_ = new Map();
    let seq = 0;
    for (const v of workspace.getAllVariables()) {
      let name = v.name.replace(/[^A-Za-z0-9_]/g, '');
      if (!name || /^[0-9]/.test(name) || this.RESERVED_WORDS_.split(',').includes(name)) {
        seq += 1;
        name = `var${seq}`;
      }
      this.varNames_.set(v.getId(), name);
      this.addDeclaration(`var_${name}`, `float ${name} = 0;`);
    }
  }

  varName(idOrModel) {
    const id = typeof idOrModel === 'string' ? idOrModel : idOrModel.getId();
    return this.varNames_.get(id) || 'var0';
  }

  addInclude(key, code) { this.includes_.set(key, code); }
  addDeclaration(key, code) { this.declarations_.set(key, code); }
  addSetup(key, code) { this.setups_.set(key, code); }
  addFunction(key, code) { this.functions_.set(key, code); }

  buildFn_(name, indentedBody) {
    const body = indentedBody.replace(/\s+$/, '');
    return body ? `void ${name}() {\n${body}\n}` : `void ${name}() {\n}`;
  }

  finish(code) {
    const parts = [];
    if (this.includes_.size) parts.push([...this.includes_.values()].join('\n'));
    if (this.declarations_.size) parts.push([...this.declarations_.values()].join('\n'));
    if (this.functions_.size) parts.push([...this.functions_.values()].join('\n\n'));
    const setupCalls = [...this.setups_.values()]
      .map((line) => this.INDENT + line)
      .join('\n');
    const setupBody = [setupCalls, this.setupBody_.replace(/\s+$/, '')]
      .filter(Boolean).join('\n');
    parts.push(this.buildFn_('setup', setupBody));
    parts.push(this.buildFn_('loop', this.loopBody_));
    return parts.join('\n\n') + '\n';
  }

  scrub_(block, code, thisOnly) {
    const next = block.nextConnection && block.nextConnection.targetBlock();
    return code + (thisOnly ? '' : this.blockToCode(next));
  }
}

const arduinoGenerator = new ArduinoGenerator();
module.exports = { arduinoGenerator, ArduinoGenerator, Order };
```

- [x] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/generator-core.test.js`
Expected: PASS (3 tests)

- [x] **Step 5: Commit**

```bash
git add src/shared tests/generator-core.test.js
git commit -m "feat: Arduino 코드 생성기 코어 (include/선언/setup 수집, 한글 변수명 변환)"
```

---

### Task 3: 기본 카테고리 블록 (시작하면 / 계속 반복 / 기다리기)

**Files:**
- Create: `src/shared/blocks/basic.js`, `src/shared/blocks/index.js`
- Test: `tests/blocks-basic.test.js`

**Interfaces:**
- Consumes: `arduinoGenerator`, `Order` (Task 2)
- Produces: 블록 타입 `basic_setup`(statement input `BODY`), `basic_loop`(statement input `BODY`), `basic_delay`(value input `SECONDS`). `require('src/shared/blocks/index.js')` 한 줄로 전 카테고리 로드(이후 태스크가 이 index에 require를 추가).
- 테스트 헬퍼 패턴 `codeFrom(json)`은 이후 모든 블록 테스트가 동일하게 복사해 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/blocks-basic.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import '../src/shared/blocks/index.js';

export function codeFrom(blocksJson) {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: blocksJson } }, ws);
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('기본 블록', () => {
  it('시작하면/계속 반복 + 기다리기 → setup/loop에 배치', () => {
    const code = codeFrom([
      { type: 'basic_setup', inputs: { BODY: { block: {
        type: 'basic_delay',
        inputs: { SECONDS: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
      } } } },
      { type: 'basic_loop', x: 0, y: 200, inputs: { BODY: { block: {
        type: 'basic_delay',
        inputs: { SECONDS: { shadow: { type: 'math_number', fields: { NUM: 0.5 } } } },
      } } } },
    ]);
    expect(code).toBe(
      'void setup() {\n  delay((1) * 1000);\n}\n\nvoid loop() {\n  delay((0.5) * 1000);\n}\n'
    );
  });
});
```

(주: 숫자 셰도 블록이 쓰는 `math_number` 생성기는 Step 3에서 최소 구현하고, Task 4에서 `logic.js`로 옮긴다.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/blocks-basic.test.js`
Expected: FAIL — `Cannot find module '../src/shared/blocks/index.js'`

- [ ] **Step 3: 구현**

`src/shared/blocks/basic.js`:

```js
'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');

Blockly.defineBlocksWithJsonArray([
  {
    type: 'basic_setup',
    message0: '시작하면 %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'BODY' }],
    colour: 120,
    tooltip: '전원이 켜지거나 리셋될 때 한 번만 실행돼요.',
  },
  {
    type: 'basic_loop',
    message0: '계속 반복하기 %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'BODY' }],
    colour: 120,
    tooltip: '전원이 켜져 있는 동안 계속 반복 실행돼요.',
  },
  {
    type: 'basic_delay',
    message0: '%1 초 기다리기',
    args0: [{ type: 'input_value', name: 'SECONDS', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
    tooltip: '정해진 시간만큼 멈춰요.',
  },
]);

g.forBlock['basic_setup'] = function (block, gen) {
  gen.setupBody_ = gen.statementToCode(block, 'BODY');
  return '';
};

g.forBlock['basic_loop'] = function (block, gen) {
  gen.loopBody_ = gen.statementToCode(block, 'BODY');
  return '';
};

g.forBlock['basic_delay'] = function (block, gen) {
  const sec = gen.valueToCode(block, 'SECONDS', Order.NONE) || '0';
  return `delay((${sec}) * 1000);\n`;
};

// math_number 최소 구현 (Task 4에서 나머지 내장 블록과 함께 확장)
g.forBlock['math_number'] = function (block) {
  return [String(block.getFieldValue('NUM')), Order.ATOMIC];
};
```

`src/shared/blocks/index.js`:

```js
'use strict';
require('./basic.js');
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/blocks-basic.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/blocks tests/blocks-basic.test.js
git commit -m "feat: 기본 블록 (시작하면/계속 반복/기다리기)"
```

---

### Task 4: 논리·반복·변수 생성기 (Blockly 내장 블록의 C++ 출력)

**Files:**
- Create: `src/shared/blocks/logic.js`
- Modify: `src/shared/blocks/index.js` (require 한 줄 추가)
- Test: `tests/blocks-logic.test.js`

**Interfaces:**
- Consumes: `arduinoGenerator`, `Order`, `varName()` (Task 2)
- Produces: 다음 내장 블록 타입의 C++ 생성기 — `controls_if`, `logic_compare`, `logic_operation`, `logic_negate`, `logic_boolean`, `controls_repeat_ext`, `controls_whileUntil`, `math_number`(Task 3의 것을 이 파일로 이동), `math_arithmetic`, `variables_get`, `variables_set`, `math_change`, `text`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/blocks-logic.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import '../src/shared/blocks/index.js';

function loopCode(bodyBlock) {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [
    { type: 'basic_loop', inputs: { BODY: { block: bodyBlock } } },
  ] } }, ws);
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

const num = (n) => ({ type: 'math_number', fields: { NUM: n } });

describe('논리/반복/변수 생성기', () => {
  it('만약~라면 + 비교', () => {
    const code = loopCode({
      type: 'controls_if',
      inputs: {
        IF0: { block: { type: 'logic_compare', fields: { OP: 'GT' },
          inputs: { A: { block: num(1) }, B: { block: num(2) } } } },
        DO0: { block: { type: 'basic_delay',
          inputs: { SECONDS: { block: num(1) } } } },
      },
    });
    expect(code).toContain('if (1 > 2) {\n    delay((1) * 1000);\n  }');
  });

  it('N번 반복 → for문', () => {
    const code = loopCode({
      type: 'controls_repeat_ext',
      inputs: {
        TIMES: { block: num(3) },
        DO: { block: { type: 'basic_delay', inputs: { SECONDS: { block: num(1) } } } },
      },
    });
    expect(code).toContain('for (int i = 0; i < 3; i++) {');
  });

  it('변수 설정/읽기 → float 전역 + 대입', () => {
    const ws = new Blockly.Workspace();
    const v = ws.createVariable('점수');
    Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [
      { type: 'basic_loop', inputs: { BODY: { block: {
        type: 'variables_set', fields: { VAR: { id: v.getId() } },
        inputs: { VALUE: { block: num(10) } },
      } } } },
    ] } }, ws);
    const code = g.workspaceToCode(ws);
    ws.dispose();
    expect(code).toContain('float var1 = 0;');
    expect(code).toContain('var1 = 10;');
  });

  it('문자열 블록 → 큰따옴표 C 문자열', () => {
    const ws = new Blockly.Workspace();
    g.init(ws);
    const b = ws.newBlock('text');
    b.setFieldValue('안녕 "친구"', 'TEXT');
    const [expr] = g.forBlock['text'](b, g);
    ws.dispose();
    expect(expr).toBe('"안녕 \\"친구\\""');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/blocks-logic.test.js`
Expected: FAIL — `controls_if` 생성기 미정의 오류

- [ ] **Step 3: 구현**

`src/shared/blocks/logic.js`:

```js
'use strict';
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');

g.forBlock['math_number'] = function (block) {
  return [String(block.getFieldValue('NUM')), Order.ATOMIC];
};

g.forBlock['text'] = function (block) {
  const raw = String(block.getFieldValue('TEXT'));
  const escaped = raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return [`"${escaped}"`, Order.ATOMIC];
};

g.forBlock['logic_boolean'] = function (block) {
  return [block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', Order.ATOMIC];
};

g.forBlock['logic_compare'] = function (block, gen) {
  const ops = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
  const op = ops[block.getFieldValue('OP')];
  const order = op === '==' || op === '!=' ? Order.EQUALITY : Order.RELATIONAL;
  const a = gen.valueToCode(block, 'A', order) || '0';
  const b = gen.valueToCode(block, 'B', order) || '0';
  return [`${a} ${op} ${b}`, order];
};

g.forBlock['logic_operation'] = function (block, gen) {
  const and = block.getFieldValue('OP') === 'AND';
  const op = and ? '&&' : '||';
  const order = and ? Order.LOGICAL_AND : Order.LOGICAL_OR;
  const a = gen.valueToCode(block, 'A', order) || 'false';
  const b = gen.valueToCode(block, 'B', order) || 'false';
  return [`${a} ${op} ${b}`, order];
};

g.forBlock['logic_negate'] = function (block, gen) {
  const v = gen.valueToCode(block, 'BOOL', Order.UNARY) || 'false';
  return [`!${v}`, Order.UNARY];
};

g.forBlock['controls_if'] = function (block, gen) {
  let code = '';
  let n = 0;
  do {
    const cond = gen.valueToCode(block, 'IF' + n, Order.NONE) || 'false';
    const body = gen.statementToCode(block, 'DO' + n);
    code += (n === 0 ? '' : ' else ') + `if (${cond}) {\n${body}}`;
    n += 1;
  } while (block.getInput('IF' + n));
  if (block.getInput('ELSE')) {
    code += ` else {\n${gen.statementToCode(block, 'ELSE')}}`;
  }
  return code + '\n';
};

g.forBlock['controls_repeat_ext'] = function (block, gen) {
  const times = gen.valueToCode(block, 'TIMES', Order.NONE) || '0';
  const body = gen.statementToCode(block, 'DO');
  return `for (int i = 0; i < ${times}; i++) {\n${body}}\n`;
};

g.forBlock['controls_whileUntil'] = function (block, gen) {
  let cond = gen.valueToCode(block, 'BOOL', Order.NONE) || 'false';
  if (block.getFieldValue('MODE') === 'UNTIL') cond = `!(${cond})`;
  const body = gen.statementToCode(block, 'DO');
  return `while (${cond}) {\n${body}}\n`;
};

g.forBlock['math_arithmetic'] = function (block, gen) {
  const ops = { ADD: ['+', Order.ADDITIVE], MINUS: ['-', Order.ADDITIVE],
    MULTIPLY: ['*', Order.MULTIPLICATIVE], DIVIDE: ['/', Order.MULTIPLICATIVE] };
  const entry = ops[block.getFieldValue('OP')];
  if (!entry) { // POWER
    const a0 = gen.valueToCode(block, 'A', Order.NONE) || '0';
    const b0 = gen.valueToCode(block, 'B', Order.NONE) || '0';
    return [`pow(${a0}, ${b0})`, Order.ATOMIC];
  }
  const [op, order] = entry;
  const a = gen.valueToCode(block, 'A', order) || '0';
  const b = gen.valueToCode(block, 'B', order) || '0';
  return [`${a} ${op} ${b}`, order];
};

g.forBlock['variables_get'] = function (block, gen) {
  return [gen.varName(block.getFieldValue('VAR')), Order.ATOMIC];
};

g.forBlock['variables_set'] = function (block, gen) {
  const value = gen.valueToCode(block, 'VALUE', Order.NONE) || '0';
  return `${gen.varName(block.getFieldValue('VAR'))} = ${value};\n`;
};

g.forBlock['math_change'] = function (block, gen) {
  const delta = gen.valueToCode(block, 'DELTA', Order.NONE) || '0';
  return `${gen.varName(block.getFieldValue('VAR'))} += ${delta};\n`;
};
```

`src/shared/blocks/basic.js`에서 Task 3의 임시 `math_number` 생성기 3줄을 삭제하고, `src/shared/blocks/index.js`를 다음으로 갱신:

```js
'use strict';
require('./basic.js');
require('./logic.js');
```

(주: `variables_get`의 `getFieldValue('VAR')`는 변수 id를 반환하므로 `varName(id)`로 조회한다.)

- [ ] **Step 4: 전체 테스트 통과 확인**

Run: `npx vitest run`
Expected: PASS (generator-core, blocks-basic, blocks-logic 모두)

- [ ] **Step 5: Commit**

```bash
git add src/shared/blocks tests/blocks-logic.test.js
git commit -m "feat: 논리/반복/변수/텍스트 블록의 C++ 생성기"
```

---

### Task 5: 입출력 블록 (LED, 디지털/아날로그, 버튼, 부저)

**Files:**
- Create: `src/shared/blocks/io.js`
- Modify: `src/shared/blocks/index.js` (`require('./io.js');` 추가)
- Test: `tests/blocks-io.test.js`

**Interfaces:**
- Consumes: `arduinoGenerator`, `Order`, `pins.js`
- Produces: 블록 타입 `io_led`, `io_digital_write`, `io_digital_read`, `io_analog_write`, `io_analog_read`, `io_button`, `io_buzzer_tone`, `io_buzzer_off`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/blocks-io.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import '../src/shared/blocks/index.js';

function loopCode(bodyBlock) {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [
    { type: 'basic_loop', inputs: { BODY: { block: bodyBlock } } },
  ] } }, ws);
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('입출력 블록', () => {
  it('LED 켜기 → pinMode OUTPUT + digitalWrite HIGH', () => {
    const code = loopCode({ type: 'io_led', fields: { PIN: '13', STATE: 'HIGH' } });
    expect(code).toContain('pinMode(13, OUTPUT);');
    expect(code).toContain('digitalWrite(13, HIGH);');
  });

  it('버튼 → INPUT_PULLUP, 눌림은 LOW 비교', () => {
    const code = loopCode({
      type: 'controls_if',
      inputs: { IF0: { block: { type: 'io_button', fields: { PIN: '2' } } } },
    });
    expect(code).toContain('pinMode(2, INPUT_PULLUP);');
    expect(code).toContain('if (digitalRead(2) == LOW) {');
  });

  it('부저 → tone + delay + noTone', () => {
    const code = loopCode({ type: 'io_buzzer_tone', fields: { PIN: '8', NOTE: '262', BEAT: '1' } });
    expect(code).toContain('tone(8, 262);');
    expect(code).toContain('delay(500 * 1);');
    expect(code).toContain('noTone(8);');
  });

  it('아날로그 쓰기 → analogWrite', () => {
    const code = loopCode({
      type: 'io_analog_write', fields: { PIN: '9' },
      inputs: { VALUE: { block: { type: 'math_number', fields: { NUM: 128 } } } },
    });
    expect(code).toContain('analogWrite(9, 128);');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/blocks-io.test.js`
Expected: FAIL — `io_led` 블록 타입 미정의

- [ ] **Step 3: 구현**

`src/shared/blocks/io.js`:

```js
'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');
const { DIGITAL_PINS, PWM_PINS, ANALOG_PINS } = require('../pins.js');

const NOTES = [
  ['도', '262'], ['레', '294'], ['미', '330'], ['파', '349'],
  ['솔', '392'], ['라', '440'], ['시', '494'], ['높은 도', '523'],
];
const BEATS = [['1박', '1'], ['반박', '0.5'], ['2박', '2'], ['4박', '4']];

Blockly.defineBlocksWithJsonArray([
  { type: 'io_led',
    message0: 'LED %1 번 핀 %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'STATE', options: [['켜기', 'HIGH'], ['끄기', 'LOW']] },
    ],
    previousStatement: null, nextStatement: null, colour: 20,
    tooltip: 'LED를 켜거나 꺼요.' },
  { type: 'io_digital_write',
    message0: '디지털 %1 번 핀에 %2 신호 보내기',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'STATE', options: [['켜짐(HIGH)', 'HIGH'], ['꺼짐(LOW)', 'LOW']] },
    ],
    previousStatement: null, nextStatement: null, colour: 20 },
  { type: 'io_digital_read',
    message0: '디지털 %1 번 핀 신호',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
    output: 'Boolean', colour: 20 },
  { type: 'io_analog_write',
    message0: '핀 %1 에 밝기/세기 %2 만큼 출력 (0~255)',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: PWM_PINS },
      { type: 'input_value', name: 'VALUE', check: 'Number' },
    ],
    previousStatement: null, nextStatement: null, colour: 20 },
  { type: 'io_analog_read',
    message0: '아날로그 %1 핀 값 (0~1023)',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: ANALOG_PINS }],
    output: 'Number', colour: 20 },
  { type: 'io_button',
    message0: '%1 번 핀 버튼이 눌렸는가?',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
    output: 'Boolean', colour: 20,
    tooltip: '버튼은 핀과 GND 사이에 연결해요.' },
  { type: 'io_buzzer_tone',
    message0: '부저 %1 번 핀 %2 음 %3 연주',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'NOTE', options: NOTES },
      { type: 'field_dropdown', name: 'BEAT', options: BEATS },
    ],
    previousStatement: null, nextStatement: null, colour: 20 },
  { type: 'io_buzzer_off',
    message0: '부저 %1 번 핀 멈추기',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
    previousStatement: null, nextStatement: null, colour: 20 },
]);

g.forBlock['io_led'] = g.forBlock['io_digital_write'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  gen.addSetup(`pinMode_out_${pin}`, `pinMode(${pin}, OUTPUT);`);
  return `digitalWrite(${pin}, ${block.getFieldValue('STATE')});\n`;
};

g.forBlock['io_digital_read'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  gen.addSetup(`pinMode_in_${pin}`, `pinMode(${pin}, INPUT);`);
  return [`digitalRead(${pin}) == HIGH`, Order.EQUALITY];
};

g.forBlock['io_analog_write'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  const value = gen.valueToCode(block, 'VALUE', Order.NONE) || '0';
  gen.addSetup(`pinMode_out_${pin}`, `pinMode(${pin}, OUTPUT);`);
  return `analogWrite(${pin}, ${value});\n`;
};

g.forBlock['io_analog_read'] = function (block) {
  return [`analogRead(${block.getFieldValue('PIN')})`, Order.ATOMIC];
};

g.forBlock['io_button'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  gen.addSetup(`pinMode_pullup_${pin}`, `pinMode(${pin}, INPUT_PULLUP);`);
  return [`digitalRead(${pin}) == LOW`, Order.EQUALITY];
};

g.forBlock['io_buzzer_tone'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  const note = block.getFieldValue('NOTE');
  const beat = block.getFieldValue('BEAT');
  return `tone(${pin}, ${note});\ndelay(500 * ${beat});\nnoTone(${pin});\n`;
};

g.forBlock['io_buzzer_off'] = function (block) {
  return `noTone(${block.getFieldValue('PIN')});\n`;
};
```

`src/shared/blocks/index.js`에 `require('./io.js');` 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run`
Expected: PASS (전체)

- [ ] **Step 5: Commit**

```bash
git add src/shared/blocks tests/blocks-io.test.js
git commit -m "feat: 입출력 블록 (LED/디지털/아날로그/버튼/부저)"
```

---

### Task 6: 센서 블록 (초음파, 온습도 DHT11, 조도 CDS)

**Files:**
- Create: `src/shared/blocks/sensors.js`
- Modify: `src/shared/blocks/index.js` (`require('./sensors.js');` 추가)
- Test: `tests/blocks-sensors.test.js`

**Interfaces:**
- Consumes: `arduinoGenerator`, `Order`, `pins.js`
- Produces: 값 블록 `sensor_ultrasonic`(필드 `TRIG`, `ECHO`), `sensor_dht`(필드 `PIN`, `MODE`=TEMP|HUM), `sensor_cds`(필드 `PIN`=A0–A5)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/blocks-sensors.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import '../src/shared/blocks/index.js';

function loopWithSet(valueBlock) {
  const ws = new Blockly.Workspace();
  const v = ws.createVariable('x');
  Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [
    { type: 'basic_loop', inputs: { BODY: { block: {
      type: 'variables_set', fields: { VAR: { id: v.getId() } },
      inputs: { VALUE: { block: valueBlock } },
    } } } },
  ] } }, ws);
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('센서 블록', () => {
  it('초음파 → 헬퍼 함수 1회 정의 + 호출', () => {
    const code = loopWithSet({ type: 'sensor_ultrasonic', fields: { TRIG: '7', ECHO: '6' } });
    expect(code).toContain('float readUltrasonic(int trigPin, int echoPin)');
    expect(code).toContain('x = readUltrasonic(7, 6);');
  });

  it('DHT11 온도 → include/객체/begin/readTemperature', () => {
    const code = loopWithSet({ type: 'sensor_dht', fields: { PIN: '4', MODE: 'TEMP' } });
    expect(code).toContain('#include <DHT.h>');
    expect(code).toContain('DHT dht_4(4, DHT11);');
    expect(code).toContain('dht_4.begin();');
    expect(code).toContain('x = dht_4.readTemperature();');
  });

  it('조도 센서 → analogRead', () => {
    const code = loopWithSet({ type: 'sensor_cds', fields: { PIN: 'A0' } });
    expect(code).toContain('x = analogRead(A0);');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/blocks-sensors.test.js`
Expected: FAIL — `sensor_ultrasonic` 블록 타입 미정의

- [ ] **Step 3: 구현**

`src/shared/blocks/sensors.js`:

```js
'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');
const { DIGITAL_PINS, ANALOG_PINS } = require('../pins.js');

Blockly.defineBlocksWithJsonArray([
  { type: 'sensor_ultrasonic',
    message0: '초음파 거리(cm) 트리거 %1 에코 %2',
    args0: [
      { type: 'field_dropdown', name: 'TRIG', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'ECHO', options: DIGITAL_PINS },
    ],
    output: 'Number', colour: 190,
    tooltip: 'HC-SR04 초음파 센서로 잰 거리(센티미터)예요.' },
  { type: 'sensor_dht',
    message0: '온습도 센서 %1 번 핀의 %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'MODE',
        options: [['온도(℃)', 'TEMP'], ['습도(%)', 'HUM']] },
    ],
    output: 'Number', colour: 190,
    tooltip: 'DHT11 센서의 온도 또는 습도 값이에요.' },
  { type: 'sensor_cds',
    message0: '조도 센서 %1 핀 밝기 (0~1023)',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: ANALOG_PINS }],
    output: 'Number', colour: 190,
    tooltip: 'CDS 조도 센서 값이에요. 밝을수록 값이 커져요.' },
]);

g.forBlock['sensor_ultrasonic'] = function (block, gen) {
  const trig = block.getFieldValue('TRIG');
  const echo = block.getFieldValue('ECHO');
  gen.addFunction('readUltrasonic',
    'float readUltrasonic(int trigPin, int echoPin) {\n' +
    '  pinMode(trigPin, OUTPUT);\n' +
    '  pinMode(echoPin, INPUT);\n' +
    '  digitalWrite(trigPin, LOW);\n' +
    '  delayMicroseconds(2);\n' +
    '  digitalWrite(trigPin, HIGH);\n' +
    '  delayMicroseconds(10);\n' +
    '  digitalWrite(trigPin, LOW);\n' +
    '  long duration = pulseIn(echoPin, HIGH, 30000);\n' +
    '  return duration * 0.0343 / 2.0;\n' +
    '}');
  return [`readUltrasonic(${trig}, ${echo})`, Order.ATOMIC];
};

g.forBlock['sensor_dht'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  const method = block.getFieldValue('MODE') === 'TEMP' ? 'readTemperature' : 'readHumidity';
  gen.addInclude('dht', '#include <DHT.h>');
  gen.addDeclaration(`dht_${pin}`, `DHT dht_${pin}(${pin}, DHT11);`);
  gen.addSetup(`dht_${pin}`, `dht_${pin}.begin();`);
  return [`dht_${pin}.${method}()`, Order.ATOMIC];
};

g.forBlock['sensor_cds'] = function (block) {
  return [`analogRead(${block.getFieldValue('PIN')})`, Order.ATOMIC];
};
```

`src/shared/blocks/index.js`에 `require('./sensors.js');` 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run`
Expected: PASS (전체)

- [ ] **Step 5: Commit**

```bash
git add src/shared/blocks tests/blocks-sensors.test.js
git commit -m "feat: 센서 블록 (초음파/DHT11/조도 CDS)"
```

---

### Task 7: 서보모터 / LCD 블록

**Files:**
- Create: `src/shared/blocks/motor-lcd.js`
- Modify: `src/shared/blocks/index.js` (`require('./motor-lcd.js');` 추가)
- Test: `tests/blocks-motor-lcd.test.js`

**Interfaces:**
- Consumes: `arduinoGenerator`, `Order`, `pins.js`
- Produces: 블록 타입 `motor_servo`(필드 `PIN`, 값 입력 `ANGLE`), `lcd_print`(필드 `ROW`, 값 입력 `TEXT`), `lcd_clear`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/blocks-motor-lcd.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import '../src/shared/blocks/index.js';

function loopCode(bodyBlock) {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [
    { type: 'basic_loop', inputs: { BODY: { block: bodyBlock } } },
  ] } }, ws);
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('서보/LCD 블록', () => {
  it('서보 → include/객체/attach/write', () => {
    const code = loopCode({
      type: 'motor_servo', fields: { PIN: '9' },
      inputs: { ANGLE: { block: { type: 'math_number', fields: { NUM: 90 } } } },
    });
    expect(code).toContain('#include <Servo.h>');
    expect(code).toContain('Servo servo_9;');
    expect(code).toContain('servo_9.attach(9);');
    expect(code).toContain('servo_9.write(90);');
  });

  it('LCD 출력 → include/init/setCursor/print', () => {
    const code = loopCode({
      type: 'lcd_print', fields: { ROW: '1' },
      inputs: { TEXT: { block: { type: 'text', fields: { TEXT: 'hi' } } } },
    });
    expect(code).toContain('#include <LiquidCrystal_I2C.h>');
    expect(code).toContain('LiquidCrystal_I2C lcd(0x27, 16, 2);');
    expect(code).toContain('lcd.init();');
    expect(code).toContain('lcd.setCursor(0, 1);');
    expect(code).toContain('lcd.print("hi");');
  });

  it('LCD 지우기', () => {
    const code = loopCode({ type: 'lcd_clear' });
    expect(code).toContain('lcd.clear();');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/blocks-motor-lcd.test.js`
Expected: FAIL — `motor_servo` 블록 타입 미정의

- [ ] **Step 3: 구현**

`src/shared/blocks/motor-lcd.js`:

```js
'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');
const { PWM_PINS } = require('../pins.js');

Blockly.defineBlocksWithJsonArray([
  { type: 'motor_servo',
    message0: '서보모터 %1 번 핀을 %2 도로 회전 (0~180)',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: PWM_PINS },
      { type: 'input_value', name: 'ANGLE', check: 'Number' },
    ],
    previousStatement: null, nextStatement: null, colour: 290 },
  { type: 'lcd_print',
    message0: 'LCD %1 번째 줄에 %2 표시',
    args0: [
      { type: 'field_dropdown', name: 'ROW', options: [['1', '0'], ['2', '1']] },
      { type: 'input_value', name: 'TEXT' },
    ],
    previousStatement: null, nextStatement: null, colour: 290,
    tooltip: 'I2C LCD(주소 0x27, 16x2)에 글자를 보여줘요.' },
  { type: 'lcd_clear',
    message0: 'LCD 화면 지우기',
    previousStatement: null, nextStatement: null, colour: 290 },
]);

function ensureLcd(gen) {
  gen.addInclude('wire', '#include <Wire.h>');
  gen.addInclude('lcd', '#include <LiquidCrystal_I2C.h>');
  gen.addDeclaration('lcd', 'LiquidCrystal_I2C lcd(0x27, 16, 2);');
  gen.addSetup('lcd', 'lcd.init();\n  lcd.backlight();');
}

g.forBlock['motor_servo'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  const angle = gen.valueToCode(block, 'ANGLE', Order.NONE) || '0';
  gen.addInclude('servo', '#include <Servo.h>');
  gen.addDeclaration(`servo_${pin}`, `Servo servo_${pin};`);
  gen.addSetup(`servo_${pin}`, `servo_${pin}.attach(${pin});`);
  return `servo_${pin}.write(${angle});\n`;
};

g.forBlock['lcd_print'] = function (block, gen) {
  const row = block.getFieldValue('ROW');
  const text = gen.valueToCode(block, 'TEXT', Order.NONE) || '""';
  ensureLcd(gen);
  return `lcd.setCursor(0, ${row});\nlcd.print(${text});\n`;
};

g.forBlock['lcd_clear'] = function (block, gen) {
  ensureLcd(gen);
  return 'lcd.clear();\n';
};
```

`src/shared/blocks/index.js` 최종본:

```js
'use strict';
require('./basic.js');
require('./logic.js');
require('./io.js');
require('./sensors.js');
require('./motor-lcd.js');
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run`
Expected: PASS (전체)

- [ ] **Step 5: Commit**

```bash
git add src/shared/blocks tests/blocks-motor-lcd.test.js
git commit -m "feat: 서보모터/LCD 블록"
```

---

### Task 8: 렌더러 통합 — 블록 편집기와 실시간 코드 미리보기

**Files:**
- Create: `src/renderer/toolbox.js`
- Modify: `src/renderer/renderer.js`

**Interfaces:**
- Consumes: Task 1 DOM id, `src/shared/blocks/index.js`, `arduinoGenerator`
- Produces: 전역 앱 상태 객체 `window.appState = { workspace, currentFilePath, dirty }` (Task 9, 11, 12가 사용). `refreshCode()` 함수 — 코드 미리보기 갱신 후 `document.dispatchEvent(new CustomEvent('blockduino:code-updated'))` 발행(Task 12의 배선 탭이 구독).

- [ ] **Step 1: toolbox 정의**

`src/renderer/toolbox.js`:

```js
'use strict';
const shadowNum = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });

module.exports = {
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: '기본', colour: '120', contents: [
      { kind: 'block', type: 'basic_setup' },
      { kind: 'block', type: 'basic_loop' },
      { kind: 'block', type: 'basic_delay', inputs: { SECONDS: shadowNum(1) } },
    ] },
    { kind: 'category', name: '입출력', colour: '20', contents: [
      { kind: 'block', type: 'io_led' },
      { kind: 'block', type: 'io_digital_write' },
      { kind: 'block', type: 'io_digital_read' },
      { kind: 'block', type: 'io_analog_write', inputs: { VALUE: shadowNum(255) } },
      { kind: 'block', type: 'io_analog_read' },
      { kind: 'block', type: 'io_button' },
      { kind: 'block', type: 'io_buzzer_tone' },
      { kind: 'block', type: 'io_buzzer_off' },
    ] },
    { kind: 'category', name: '센서', colour: '190', contents: [
      { kind: 'block', type: 'sensor_ultrasonic' },
      { kind: 'block', type: 'sensor_dht' },
      { kind: 'block', type: 'sensor_cds' },
    ] },
    { kind: 'category', name: '모터/화면', colour: '290', contents: [
      { kind: 'block', type: 'motor_servo', inputs: { ANGLE: shadowNum(90) } },
      { kind: 'block', type: 'lcd_print', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '안녕' } } } } },
      { kind: 'block', type: 'lcd_clear' },
    ] },
    { kind: 'category', name: '논리', colour: '210', contents: [
      { kind: 'block', type: 'controls_if' },
      { kind: 'block', type: 'logic_compare', inputs: { A: shadowNum(0), B: shadowNum(0) } },
      { kind: 'block', type: 'logic_operation' },
      { kind: 'block', type: 'logic_negate' },
      { kind: 'block', type: 'logic_boolean' },
    ] },
    { kind: 'category', name: '반복', colour: '120', contents: [
      { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadowNum(10) } },
      { kind: 'block', type: 'controls_whileUntil' },
    ] },
    { kind: 'category', name: '수학', colour: '230', contents: [
      { kind: 'block', type: 'math_number' },
      { kind: 'block', type: 'math_arithmetic', inputs: { A: shadowNum(1), B: shadowNum(1) } },
      { kind: 'block', type: 'text' },
    ] },
    { kind: 'category', name: '변수', colour: '330', custom: 'VARIABLE' },
  ],
};
```

- [ ] **Step 2: renderer.js 구현**

`src/renderer/renderer.js`:

```js
'use strict';
const Blockly = require('blockly');
const ko = require('blockly/msg/ko');
require('../shared/blocks/index.js');
const { arduinoGenerator } = require('../shared/arduino-generator.js');
const toolbox = require('./toolbox.js');

Blockly.setLocale(ko);

const workspace = Blockly.inject('blocklyDiv', {
  toolbox,
  grid: { spacing: 24, length: 2, colour: '#eee', snap: true },
  zoom: { controls: true, wheel: true, startScale: 0.9 },
  trashcan: true,
});

window.appState = { workspace, currentFilePath: null, dirty: false };

// 새 프로젝트 기본 블록: 시작하면 + 계속 반복하기
Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [
  { type: 'basic_setup', x: 40, y: 40 },
  { type: 'basic_loop', x: 40, y: 220 },
] } }, workspace);

function refreshCode() {
  const code = arduinoGenerator.workspaceToCode(workspace);
  document.getElementById('code-preview').textContent = code;
  document.dispatchEvent(new CustomEvent('blockduino:code-updated'));
}

workspace.addChangeListener((e) => {
  if (e.isUiEvent) return;
  window.appState.dirty = true;
  refreshCode();
});
refreshCode();
window.appState.dirty = false;

// 코드/배선 탭 전환
const tabCode = document.getElementById('tab-code');
const tabWiring = document.getElementById('tab-wiring');
function selectTab(showCode) {
  tabCode.classList.toggle('active', showCode);
  tabWiring.classList.toggle('active', !showCode);
  document.getElementById('code-preview').hidden = !showCode;
  document.getElementById('wiring-panel').hidden = showCode;
}
tabCode.addEventListener('click', () => selectTab(true));
tabWiring.addEventListener('click', () => selectTab(false));

window.blockduino = { refreshCode, selectTab };
```

- [ ] **Step 3: 수동 확인**

Run: `npm start`
Expected:
1. 좌측 팔레트에 기본/입출력/센서/모터·화면/논리/반복/수학/변수 카테고리가 한글로 표시
2. 작업 공간에 "시작하면", "계속 반복하기" 블록이 미리 놓여 있음
3. "계속 반복하기" 안에 "LED 13번 핀 켜기"를 끼우면 우측 코드 미리보기에 `pinMode(13, OUTPUT);`와 `digitalWrite(13, HIGH);`가 즉시 나타남
4. "배선" 탭 클릭 시 빈 패널로 전환 (Task 12에서 채움)

- [ ] **Step 4: 자동 테스트 회귀 확인**

Run: `npx vitest run`
Expected: PASS (전체)

- [ ] **Step 5: Commit**

```bash
git add src/renderer
git commit -m "feat: Blockly 편집기 주입, 한글 toolbox, 실시간 코드 미리보기"
```

---

### Task 9: 프로젝트 저장/열기 (.bdn)

**Files:**
- Create: `src/main/ipc.js`
- Modify: `src/main/main.js` (ipc 등록), `src/renderer/renderer.js` (버튼 연결)

**Interfaces:**
- Consumes: `window.appState` (Task 8)
- Produces: IPC 채널 — `invoke('project:save', {json, filePath})` → `저장된 filePath | null(취소)`, `invoke('project:open')` → `{filePath, json} | null(취소)`, `invoke('confirm-discard')` → `boolean`. Task 11이 같은 파일(`ipc.js`)에 채널을 추가한다.

- [ ] **Step 1: 메인 프로세스 IPC 핸들러**

`src/main/ipc.js`:

```js
'use strict';
const { ipcMain, dialog } = require('electron');
const fs = require('fs/promises');

const BDN_FILTER = [{ name: 'Blockduino 프로젝트', extensions: ['bdn'] }];

function registerIpc(getWindow) {
  ipcMain.handle('project:save', async (_e, { json, filePath }) => {
    let target = filePath;
    if (!target) {
      const r = await dialog.showSaveDialog(getWindow(), {
        title: '프로젝트 저장', defaultPath: '새 프로젝트.bdn', filters: BDN_FILTER,
      });
      if (r.canceled) return null;
      target = r.filePath;
    }
    await fs.writeFile(target, JSON.stringify(json, null, 2), 'utf8');
    return target;
  });

  ipcMain.handle('project:open', async () => {
    const r = await dialog.showOpenDialog(getWindow(), {
      title: '프로젝트 열기', filters: BDN_FILTER, properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const text = await fs.readFile(r.filePaths[0], 'utf8');
    return { filePath: r.filePaths[0], json: JSON.parse(text) };
  });

  ipcMain.handle('confirm-discard', async () => {
    const r = await dialog.showMessageBox(getWindow(), {
      type: 'question', buttons: ['계속하기', '취소'], defaultId: 1, cancelId: 1,
      message: '저장하지 않은 변경이 있어요. 저장하지 않고 계속할까요?',
    });
    return r.response === 0;
  });
}

module.exports = { registerIpc };
```

`src/main/main.js`의 `app.whenReady()` 부분을 다음으로 교체:

```js
const { registerIpc } = require('./ipc.js');

let mainWindow = null;
app.whenReady().then(() => {
  mainWindow = createWindow();
  registerIpc(() => mainWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});
```

- [ ] **Step 2: 렌더러 버튼 연결**

`src/renderer/renderer.js` 하단에 추가:

```js
const { ipcRenderer } = require('electron');
const path = require('path');

async function saveProject() {
  const json = Blockly.serialization.workspaces.save(workspace);
  const saved = await ipcRenderer.invoke('project:save', {
    json, filePath: window.appState.currentFilePath,
  });
  if (saved) {
    window.appState.currentFilePath = saved;
    window.appState.dirty = false;
    document.getElementById('project-name').value = path.basename(saved, '.bdn');
    setStatus('저장 완료 ✓');
  }
}

async function openProject() {
  if (window.appState.dirty &&
      !(await ipcRenderer.invoke('confirm-discard'))) return;
  const result = await ipcRenderer.invoke('project:open');
  if (!result) return;
  Blockly.serialization.workspaces.load(result.json, workspace);
  window.appState.currentFilePath = result.filePath;
  window.appState.dirty = false;
  document.getElementById('project-name').value = path.basename(result.filePath, '.bdn');
  refreshCode();
  setStatus('프로젝트를 열었어요');
}

function setStatus(msg) {
  document.getElementById('status-bar').textContent = msg;
}

document.getElementById('btn-save').addEventListener('click', saveProject);
document.getElementById('btn-open').addEventListener('click', openProject);
window.blockduino.setStatus = setStatus;
```

- [ ] **Step 3: 수동 확인**

Run: `npm start`
Expected:
1. 블록 몇 개 배치 → [저장] → 파일 대화상자 → `테스트.bdn` 저장 → 상태바 "저장 완료 ✓", 프로젝트명이 "테스트"로 변경
2. 블록을 지우고 [열기] → "저장하지 않은 변경이 있어요…" 확인 대화상자 → 계속하기 → `테스트.bdn` 선택 → 블록 복원
3. 저장된 `.bdn` 파일을 텍스트 에디터로 열면 Blockly JSON

- [ ] **Step 4: Commit**

```bash
git add src/main src/renderer/renderer.js
git commit -m "feat: .bdn 프로젝트 저장/열기와 미저장 변경 확인"
```

---

### Task 10: arduino-cli 래퍼 (포트 감지, 컴파일/업로드, 오류 분류)

**Files:**
- Create: `src/main/arduino.js`, `src/main/messages.js`
- Test: `tests/arduino-parse.test.js`

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces:
  - `arduino.js` → `{ listPorts(): Promise<{port, label, isUno}[]>, compileAndUpload(code, port, onStage): Promise<{ok, stage?, output?}>, parseBoardList(stdout) }` — `onStage('compile'|'upload')`는 단계 시작 시 호출
  - `messages.js` → `{ friendlyError(stage, output): { message, detail } }` — stage는 `'no-port' | 'compile' | 'upload'`
  - 순수 함수 `parseBoardList`, `friendlyError`는 단위 테스트 대상

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/arduino-parse.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseBoardList } from '../src/main/arduino.js';
import { friendlyError } from '../src/main/messages.js';

describe('parseBoardList', () => {
  it('시리얼 포트만 추려 Uno 여부와 함께 반환', () => {
    const stdout = JSON.stringify({ detected_ports: [
      { port: { address: 'COM3', protocol: 'serial', label: 'COM3' },
        matching_boards: [{ name: 'Arduino Uno', fqbn: 'arduino:avr:uno' }] },
      { port: { address: 'COM4', protocol: 'serial', label: 'COM4' } },
      { port: { address: '192.168.0.2', protocol: 'network', label: 'net' } },
    ] });
    expect(parseBoardList(stdout)).toEqual([
      { port: 'COM3', label: 'COM3 (Arduino Uno)', isUno: true },
      { port: 'COM4', label: 'COM4', isUno: false },
    ]);
  });

  it('빈 출력/깨진 JSON → 빈 배열', () => {
    expect(parseBoardList('')).toEqual([]);
    expect(parseBoardList('not json')).toEqual([]);
  });
});

describe('friendlyError', () => {
  it('포트 없음', () => {
    expect(friendlyError('no-port', '').message)
      .toBe('아두이노가 연결되어 있는지 확인해 주세요');
  });
  it('업로드 통신 실패 (avrdude stk500)', () => {
    const r = friendlyError('upload', 'avrdude: stk500_recv(): programmer is not responding');
    expect(r.message).toBe('USB 케이블을 다시 연결하고 시도해 주세요');
    expect(r.detail).toContain('stk500_recv');
  });
  it('포트 접근 거부', () => {
    const r = friendlyError('upload', "can't open device \"COM3\": Access is denied");
    expect(r.message).toBe('다른 프로그램이 보드를 사용 중이에요. 시리얼 모니터 등을 닫고 다시 시도해 주세요');
  });
  it('컴파일 실패 → 원문 로그를 detail로', () => {
    const r = friendlyError('compile', 'error: expected ; before }');
    expect(r.message).toBe('코드를 만드는 중 문제가 생겼어요. [자세히 보기]를 눌러 확인해 주세요');
    expect(r.detail).toContain('expected ;');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/arduino-parse.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/main/messages.js`:

```js
'use strict';

function friendlyError(stage, output) {
  const detail = output || '';
  if (stage === 'no-port') {
    return { message: '아두이노가 연결되어 있는지 확인해 주세요', detail };
  }
  if (/access is denied|permission denied|resource busy/i.test(detail)) {
    return { message: '다른 프로그램이 보드를 사용 중이에요. 시리얼 모니터 등을 닫고 다시 시도해 주세요', detail };
  }
  if (/stk500|programmer is not responding|can't open device|no device found/i.test(detail)) {
    return { message: 'USB 케이블을 다시 연결하고 시도해 주세요', detail };
  }
  if (stage === 'compile') {
    return { message: '코드를 만드는 중 문제가 생겼어요. [자세히 보기]를 눌러 확인해 주세요', detail };
  }
  return { message: '업로드에 실패했어요. 보드와 케이블을 확인하고 다시 시도해 주세요', detail };
}

module.exports = { friendlyError };
```

`src/main/arduino.js`:

```js
'use strict';
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');

const FQBN = 'arduino:avr:uno';

function baseDir() {
  if (process.env.BLOCKDUINO_ARDUINO_DIR) return process.env.BLOCKDUINO_ARDUINO_DIR;
  if (process.resourcesPath && !process.defaultApp) {
    return path.join(process.resourcesPath, 'arduino'); // 패키징된 앱
  }
  return path.join(__dirname, '../../vendor/arduino', process.platform); // 개발 모드
}

function cliBin() {
  return path.join(baseDir(), process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');
}

function cliEnv() {
  return {
    ...process.env,
    ARDUINO_DIRECTORIES_DATA: path.join(baseDir(), 'data'),
    ARDUINO_DIRECTORIES_DOWNLOADS: path.join(baseDir(), 'downloads'),
    ARDUINO_DIRECTORIES_USER: path.join(baseDir(), 'user'),
    ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false',
  };
}

function runCli(args) {
  return new Promise((resolve) => {
    execFile(cliBin(), args, { env: cliEnv(), timeout: 180000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

function parseBoardList(stdout) {
  let data;
  try { data = JSON.parse(stdout); } catch { return []; }
  return (data.detected_ports || [])
    .filter((p) => p.port && p.port.protocol === 'serial')
    .map((p) => {
      const board = (p.matching_boards || [])[0];
      return {
        port: p.port.address,
        label: board ? `${p.port.address} (${board.name})` : p.port.address,
        isUno: !!board && board.fqbn === FQBN,
      };
    });
}

async function listPorts() {
  const r = await runCli(['board', 'list', '--json']);
  return r.ok ? parseBoardList(r.stdout) : [];
}

async function compileAndUpload(code, port, onStage) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blockduino-'));
  const sketchDir = path.join(dir, 'sketch');
  await fs.mkdir(sketchDir);
  await fs.writeFile(path.join(sketchDir, 'sketch.ino'), code, 'utf8');
  try {
    onStage && onStage('compile');
    const c = await runCli(['compile', '--fqbn', FQBN, sketchDir]);
    if (!c.ok) return { ok: false, stage: 'compile', output: c.stderr || c.stdout };
    onStage && onStage('upload');
    const u = await runCli(['upload', '-p', port, '--fqbn', FQBN, sketchDir]);
    if (!u.ok) return { ok: false, stage: 'upload', output: u.stderr || u.stdout };
    return { ok: true };
  } finally {
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { parseBoardList, listPorts, compileAndUpload, FQBN };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run`
Expected: PASS (전체)

- [ ] **Step 5: Commit**

```bash
git add src/main/arduino.js src/main/messages.js tests/arduino-parse.test.js
git commit -m "feat: arduino-cli 래퍼 (포트 파싱, 컴파일/업로드, 한글 오류 분류)"
```

---

### Task 11: 업로드 UI 연동 (포트 드롭다운, 상태바, CH340 안내)

**Files:**
- Modify: `src/main/ipc.js`, `src/renderer/renderer.js`, `src/renderer/index.html`, `src/renderer/style.css`

**Interfaces:**
- Consumes: `arduino.js`, `messages.js` (Task 10), `setStatus` (Task 9)
- Produces: IPC — `invoke('ports:list')` → `{port, label, isUno}[]`, `invoke('sketch:upload', {code, port})` → `{ok, message?, detail?}`; 진행 이벤트 `webContents.send('upload:stage', 'compile'|'upload')`

- [ ] **Step 1: 메인 프로세스 채널 추가**

`src/main/ipc.js` 상단에 require 추가 후 `registerIpc` 안에 핸들러 추가:

```js
const arduino = require('./arduino.js');
const { friendlyError } = require('./messages.js');

  // registerIpc(getWindow) 내부에 추가
  ipcMain.handle('ports:list', () => arduino.listPorts());

  ipcMain.handle('sketch:upload', async (_e, { code, port }) => {
    if (!port) {
      const fe = friendlyError('no-port', '');
      return { ok: false, ...fe };
    }
    const result = await arduino.compileAndUpload(code, port, (stage) => {
      getWindow().webContents.send('upload:stage', stage);
    });
    if (result.ok) return { ok: true };
    const fe = friendlyError(result.stage, result.output);
    return { ok: false, ...fe };
  });
```

- [ ] **Step 2: 오류 상세 보기 UI 추가**

`src/renderer/index.html`의 `<footer id="status-bar">준비됨</footer>`를 다음으로 교체:

```html
  <footer id="status-bar">준비됨</footer>
  <dialog id="error-dialog">
    <h3 id="error-message"></h3>
    <p id="ch340-hint" hidden>
      포트가 보이지 않으면 CH340 드라이버가 필요할 수 있어요.<br />
      선생님과 함께 "CH340 드라이버"를 검색해 설치한 뒤 다시 연결해 보세요.
    </p>
    <details><summary>자세히 보기</summary><pre id="error-detail"></pre></details>
    <button id="error-close">닫기</button>
  </dialog>
```

`src/renderer/style.css`에 추가:

```css
#error-dialog { border: none; border-radius: 8px; padding: 20px; max-width: 480px; }
#error-dialog pre { max-height: 200px; overflow: auto; background: #f5f5f5; padding: 8px; font-size: 12px; }
#error-close { margin-top: 12px; padding: 6px 16px; }
#status-bar.busy { background: #b26a00; }
#status-bar.error { background: #b00020; }
#status-bar.ok { background: #1b5e20; }
```

- [ ] **Step 3: 렌더러 로직**

`src/renderer/renderer.js` 하단에 추가:

```js
// ── 포트 감지 & 업로드 ──────────────────────────────
const portSelect = document.getElementById('port-select');
let knownPorts = [];

async function refreshPorts() {
  const ports = await ipcRenderer.invoke('ports:list');
  if (JSON.stringify(ports) === JSON.stringify(knownPorts)) return;
  knownPorts = ports;
  const prev = portSelect.value;
  portSelect.innerHTML = '';
  if (ports.length === 0) {
    portSelect.add(new Option('보드를 연결하세요', ''));
  } else {
    for (const p of ports) portSelect.add(new Option(p.label, p.port));
    const uno = ports.find((p) => p.isUno);
    portSelect.value = ports.some((p) => p.port === prev) ? prev
      : (uno ? uno.port : ports[0].port);
  }
}
refreshPorts();
setInterval(refreshPorts, 3000);

function setStatusClass(cls) {
  document.getElementById('status-bar').className = cls;
}

function showError(message, detail, showCh340Hint) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('error-detail').textContent = detail || '(추가 정보 없음)';
  document.getElementById('ch340-hint').hidden = !showCh340Hint;
  document.getElementById('error-dialog').showModal();
}
document.getElementById('error-close').addEventListener('click', () =>
  document.getElementById('error-dialog').close());

ipcRenderer.on('upload:stage', (_e, stage) => {
  setStatus(stage === 'compile' ? '컴파일 중...' : '보드에 업로드 중...');
});

const btnUpload = document.getElementById('btn-upload');
btnUpload.addEventListener('click', async () => {
  const code = arduinoGenerator.workspaceToCode(workspace);
  btnUpload.disabled = true;
  setStatusClass('busy');
  setStatus('컴파일 중...');
  const r = await ipcRenderer.invoke('sketch:upload', {
    code, port: portSelect.value,
  });
  btnUpload.disabled = false;
  if (r.ok) {
    setStatusClass('ok');
    setStatus('업로드 완료! ✓');
  } else {
    setStatusClass('error');
    setStatus('업로드 실패');
    // 윈도우에서 포트가 하나도 안 잡히면 CH340 드라이버 안내 표시
    const noPorts = knownPorts.length === 0 && process.platform === 'win32';
    showError(r.message, r.detail, noPorts);
  }
});
```

- [ ] **Step 4: 수동 확인 (실기기)**

전제: Task 13의 `npm run prepare-arduino`가 아직 없으므로, 임시로 로컬에 설치된 arduino-cli가 있다면 `BLOCKDUINO_ARDUINO_DIR`로 지정해 확인하거나, 이 Step을 Task 13 이후로 미룬다.

Run: `npm start` (Uno R3 연결 상태)
Expected:
1. 3초 내 포트 드롭다운에 "COMx (Arduino Uno)" 자동 표시·자동 선택
2. LED 깜빡이기 블록 구성 → [⬆ 업로드] → 상태바 "컴파일 중..." → "보드에 업로드 중..." → "업로드 완료! ✓" (초록)
3. 보드의 13번 LED가 깜빡임
4. 보드를 뽑고 업로드 → 오류 대화상자에 "아두이노가 연결되어 있는지 확인해 주세요" + (윈도우) CH340 안내

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.js src/renderer
git commit -m "feat: 포트 자동 감지, 원클릭 업로드, 한글 오류 안내 UI"
```

---

### Task 12: 배선 안내 탭

스펙 5절의 "정적 SVG"를 데이터 기반 SVG 렌더링으로 구체화한다: 부품별 연결 정보(데이터)로 카드형 SVG를 그려, 블록에서 고른 핀 번호가 라벨에 자동 반영되게 한다 (UX는 스펙과 동일, 핀 라벨 요구를 더 정확히 충족).

**Files:**
- Create: `src/renderer/wiring.js`
- Modify: `src/renderer/renderer.js` (이벤트 구독 1줄 + require)

**Interfaces:**
- Consumes: `window.appState.workspace`, `blockduino:code-updated` 이벤트 (Task 8)
- Produces: `renderWiringPanel(workspace, panelEl)` — 워크스페이스에서 사용 중인 부품 블록을 찾아 부품당 1장의 연결 카드(SVG) 표시

- [ ] **Step 1: 배선 데이터와 렌더러 구현**

`src/renderer/wiring.js`:

```js
'use strict';

// 부품별 배선 정보: pins(block) → [{ boardPin, partPin, color }]
const WIRING = {
  io_led: {
    title: 'LED',
    pins: (b) => [
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '저항 220Ω → 긴 다리(+)', color: '#e53935' },
      { boardPin: 'GND', partPin: '짧은 다리(−)', color: '#424242' },
    ],
  },
  io_button: {
    title: '버튼',
    pins: (b) => [
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '버튼 한쪽 다리', color: '#fb8c00' },
      { boardPin: 'GND', partPin: '반대쪽 다리', color: '#424242' },
    ],
  },
  io_buzzer_tone: {
    title: '부저',
    pins: (b) => [
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '+ (긴 다리)', color: '#fb8c00' },
      { boardPin: 'GND', partPin: '− (짧은 다리)', color: '#424242' },
    ],
  },
  sensor_ultrasonic: {
    title: '초음파 센서 (HC-SR04)',
    pins: (b) => [
      { boardPin: '5V', partPin: 'VCC', color: '#e53935' },
      { boardPin: `D${b.getFieldValue('TRIG')}`, partPin: 'Trig', color: '#fb8c00' },
      { boardPin: `D${b.getFieldValue('ECHO')}`, partPin: 'Echo', color: '#1e88e5' },
      { boardPin: 'GND', partPin: 'GND', color: '#424242' },
    ],
  },
  sensor_dht: {
    title: '온습도 센서 (DHT11)',
    pins: (b) => [
      { boardPin: '5V', partPin: 'VCC(+)', color: '#e53935' },
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: 'DATA(out)', color: '#fb8c00' },
      { boardPin: 'GND', partPin: 'GND(−)', color: '#424242' },
    ],
  },
  sensor_cds: {
    title: '조도 센서 (CDS)',
    pins: (b) => [
      { boardPin: '5V', partPin: 'CDS 한쪽 다리', color: '#e53935' },
      { boardPin: b.getFieldValue('PIN'), partPin: 'CDS 반대쪽 다리 + 저항 10kΩ', color: '#fb8c00' },
      { boardPin: 'GND', partPin: '저항 10kΩ 반대쪽', color: '#424242' },
    ],
  },
  motor_servo: {
    title: '서보모터 (SG90)',
    pins: (b) => [
      { boardPin: '5V', partPin: '빨간 선', color: '#e53935' },
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '주황(신호) 선', color: '#fb8c00' },
      { boardPin: 'GND', partPin: '갈색 선', color: '#424242' },
    ],
  },
  lcd_print: {
    title: 'LCD (I2C 16x2)',
    pins: () => [
      { boardPin: '5V', partPin: 'VCC', color: '#e53935' },
      { boardPin: 'A4', partPin: 'SDA', color: '#1e88e5' },
      { boardPin: 'A5', partPin: 'SCL', color: '#43a047' },
      { boardPin: 'GND', partPin: 'GND', color: '#424242' },
    ],
  },
};
WIRING.lcd_clear = WIRING.lcd_print;
WIRING.io_buzzer_off = WIRING.io_buzzer_tone;
WIRING.io_digital_write = { title: '디지털 출력 부품',
  pins: WIRING.io_led.pins };

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text) el.textContent = text;
  return el;
}

// 카드 1장: 왼쪽 아두이노 핀 열, 오른쪽 부품 핀 열, 색선으로 연결
function renderCard(entry, block) {
  const pins = entry.pins(block);
  const h = 40 + pins.length * 34;
  const svg = svgEl('svg', { viewBox: `0 0 320 ${h}`, width: '100%' });
  svg.appendChild(svgEl('rect', { x: 4, y: 30, width: 90, height: h - 38, rx: 8, fill: '#2e7d32' }));
  svg.appendChild(svgEl('rect', { x: 226, y: 30, width: 90, height: h - 38, rx: 8, fill: '#eceff1', stroke: '#90a4ae' }));
  svg.appendChild(svgEl('text', { x: 49, y: 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 'bold' }, '아두이노 우노'));
  svg.appendChild(svgEl('text', { x: 271, y: 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 'bold' }, entry.title));
  pins.forEach((p, i) => {
    const y = 56 + i * 34;
    svg.appendChild(svgEl('text', { x: 49, y: y + 4, 'text-anchor': 'middle', 'font-size': 13, fill: '#fff', 'font-weight': 'bold' }, p.boardPin));
    svg.appendChild(svgEl('line', { x1: 94, y1: y, x2: 226, y2: y, stroke: p.color, 'stroke-width': 3 }));
    svg.appendChild(svgEl('text', { x: 271, y: y + 4, 'text-anchor': 'middle', 'font-size': 11 }, p.partPin));
  });
  return svg;
}

function renderWiringPanel(workspace, panelEl) {
  panelEl.innerHTML = '';
  const seen = new Set();
  const blocks = workspace.getAllBlocks(false).filter((b) => WIRING[b.type]);
  if (blocks.length === 0) {
    panelEl.textContent = '부품 블록을 사용하면 여기에 연결 방법이 나와요.';
    return;
  }
  for (const block of blocks) {
    const entry = WIRING[block.type];
    // 같은 부품+같은 핀 조합은 카드 1장만
    const key = entry.title + JSON.stringify(entry.pins(block));
    if (seen.has(key)) continue;
    seen.add(key);
    const card = document.createElement('div');
    card.style.marginBottom = '16px';
    card.appendChild(renderCard(entry, block));
    panelEl.appendChild(card);
  }
}

module.exports = { renderWiringPanel, WIRING };
```

- [ ] **Step 2: renderer.js에 연결**

`src/renderer/renderer.js`에 추가:

```js
const { renderWiringPanel } = require('./wiring.js');
document.addEventListener('blockduino:code-updated', () =>
  renderWiringPanel(workspace, document.getElementById('wiring-panel')));
```

- [ ] **Step 3: 수동 확인**

Run: `npm start`
Expected:
1. "배선" 탭: 부품 블록이 없을 때 안내 문구 표시
2. "서보모터 9번 핀…" 블록 추가 → 배선 탭에 서보 카드: 5V–빨간 선, D9–주황(신호) 선, GND–갈색 선
3. 블록의 핀을 9 → 10으로 바꾸면 카드 라벨이 D10으로 즉시 갱신
4. 같은 핀의 같은 부품 블록을 여러 개 써도 카드는 1장

- [ ] **Step 4: Commit**

```bash
git add src/renderer/wiring.js src/renderer/renderer.js
git commit -m "feat: 부품별 배선 안내 카드 (핀 라벨 자동 반영)"
```

---

### Task 13: arduino-cli 동봉과 윈도우 설치파일 패키징

**Files:**
- Create: `scripts/prepare-arduino.mjs`
- Modify: `package.json` (build 설정 추가)

**Interfaces:**
- Consumes: `arduino.js`의 `baseDir()` 규약 — 개발 모드 `vendor/arduino/<platform>/`, 패키징 후 `<resources>/arduino/` 아래에 `arduino-cli(.exe)`, `data/`, `user/`
- Produces: `npm run prepare-arduino`(빌드 머신에서 1회, 인터넷 필요), `npm run dist` → `dist/Blockduino Setup 0.1.0.exe`

- [ ] **Step 1: 준비 스크립트 작성**

`scripts/prepare-arduino.mjs` (현재 OS용 cli를 받아 코어/라이브러리까지 설치):

```js
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const VERSION = '1.1.1';
const PLATFORM = process.platform; // 'win32' | 'darwin'
const ARCHIVES = {
  win32: `arduino-cli_${VERSION}_Windows_64bit.zip`,
  darwin: `arduino-cli_${VERSION}_macOS_ARM64.tar.gz`,
};
const archive = ARCHIVES[PLATFORM];
if (!archive) throw new Error(`지원하지 않는 플랫폼: ${PLATFORM}`);

const destDir = path.resolve('vendor/arduino', PLATFORM);
const bin = path.join(destDir, PLATFORM === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');
mkdirSync(destDir, { recursive: true });

if (!existsSync(bin)) {
  const url = `https://downloads.arduino.cc/arduino-cli/${archive}`;
  console.log('다운로드:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패: HTTP ${res.status}`);
  const archivePath = path.join(destDir, archive);
  await pipeline(res.body, createWriteStream(archivePath));
  if (archive.endsWith('.zip')) {
    execFileSync('tar', ['-xf', archivePath, '-C', destDir]); // Win10+ 기본 tar가 zip 해제 지원
  } else {
    execFileSync('tar', ['-xzf', archivePath, '-C', destDir]);
  }
}

const env = {
  ...process.env,
  ARDUINO_DIRECTORIES_DATA: path.join(destDir, 'data'),
  ARDUINO_DIRECTORIES_DOWNLOADS: path.join(destDir, 'downloads'),
  ARDUINO_DIRECTORIES_USER: path.join(destDir, 'user'),
};
const cli = (args) => execFileSync(bin, args, { env, stdio: 'inherit' });

cli(['core', 'update-index']);
cli(['core', 'install', 'arduino:avr']);
cli(['lib', 'install', 'Servo']);
cli(['lib', 'install', 'DHT sensor library']); // Adafruit, 의존성 자동 설치
cli(['lib', 'install', 'LiquidCrystal I2C']);
console.log('완료:', destDir);
```

- [ ] **Step 2: electron-builder 설정**

`package.json`에 `"build"` 필드 추가:

```json
"build": {
  "appId": "kr.blockduino.app",
  "productName": "Blockduino",
  "files": ["src/**/*", "package.json"],
  "extraResources": [
    { "from": "vendor/arduino/win32", "to": "arduino" }
  ],
  "win": { "target": "nsis" },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "installerLanguages": ["ko_KR"]
  }
}
```

(주: macOS에서 개발 확인용으로 빌드할 때는 `--win` 대신 `--mac dir`을 쓰고 `extraResources.from`을 `vendor/arduino/darwin`으로 바꾼 별도 명령을 쓰지 않는다 — 개발 모드에서는 패키징 없이 `vendor/arduino/darwin`을 직접 읽으므로 불필요.)

- [ ] **Step 3: 개발 모드 E2E 확인**

Run: `npm run prepare-arduino && npm start` (Uno R3 연결)
Expected: Task 11 Step 4의 실기기 시나리오가 처음부터 끝까지 동작 (컴파일 → 업로드 → LED 깜빡임)

- [ ] **Step 4: 윈도우 설치파일 빌드 (윈도우 머신 또는 CI에서)**

Run (윈도우에서): `npm ci && npm run prepare-arduino && npm run dist`
Expected: `dist/Blockduino Setup 0.1.0.exe` 생성. 설치 후:
1. 인터넷을 끊은 상태에서 실행 → 블록 편집/코드 생성 정상
2. Uno 연결 → 포트 자동 감지 → 업로드 성공
3. 오프라인 상태에서도 컴파일/업로드 동작 (동봉 코어/라이브러리 사용 확인)

- [ ] **Step 5: Commit**

```bash
git add scripts/prepare-arduino.mjs package.json
git commit -m "chore: arduino-cli 동봉 스크립트와 윈도우 NSIS 패키징 설정"
```

---

## 스펙 대비 커버리지

| 스펙 절 | 태스크 |
|---------|--------|
| 2 화면 구성 | Task 1, 8, 11 |
| 3 블록 구성 | Task 3–7 (조도 센서 포함: Task 6) |
| 4 기술 구조 (생성기/cli/포트/CH340/IPC) | Task 2, 10, 11, 13 |
| 5 배선 안내 그림 | Task 12 |
| 6 프로젝트 저장 (.bdn) | Task 9 |
| 7 오류 처리 (한글 메시지) | Task 10, 11 |
| 8 테스트 | 각 태스크의 vitest + Task 11/13 실기기 체크리스트 |




