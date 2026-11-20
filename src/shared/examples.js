'use strict';
const { locale, LOCALES } = require('./i18n.js');

// 미리 만들어진 예제 데모: 블록이 일부 연결된 상태의 워크스페이스 JSON.
// 배선 카드는 배선 탭이 사용 중인 부품 블록에서 자동으로 그려준다 (wiring.js).

const num = (n) => ({ type: 'math_number', fields: { NUM: n } });
const led = (pin, state, next) => ({
  type: 'io_led', fields: { PIN: pin, STATE: state },
  ...(next ? { next: { block: next } } : {}),
});

// 고급(2번) 예제들이 쓰는 변수의 고정 id
const BRIGHT_VAR = 'bright-var-id'; // 밝기 (센서등 2)
const DIST_VAR = 'dist-var-id';     // 거리 (자동문 2)
const TEMP_VAR = 'temp-var-id';     // 온도 (화재 경보기 2)

// 변수 id → 로케일의 variables 키. 예제 JSON에는 기본(영어) 이름이 들어가고,
// 로드할 때 localizeWorkspace()가 현재 언어 이름으로 바꿔 준다.
const EXAMPLE_VARIABLES = {
  [BRIGHT_VAR]: 'brightness',
  [DIST_VAR]: 'distance',
  [TEMP_VAR]: 'temperature',
};
const varName = (id) => LOCALES.en.variables[EXAMPLE_VARIABLES[id]];


const EXAMPLES = [
  {
    id: 'light',
    workspace: { blocks: { languageVersion: 0, blocks: [
      { type: 'basic_setup', x: 40, y: 40 },
      { type: 'basic_loop', x: 40, y: 180, inputs: { BODY: { block: {
        type: 'controls_if', extraState: { hasElse: true },
        inputs: {
          IF0: { block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: {
            A: { block: { type: 'sensor_cds', fields: { PIN: 'A0' } } },
            B: { block: num(300) },
          } } },
          DO0: { block: { type: 'io_led', fields: { PIN: '13', STATE: 'HIGH' } } },
          ELSE: { block: { type: 'io_led', fields: { PIN: '13', STATE: 'LOW' } } },
        },
      } } } },
    ] } },
  },
  {
    id: 'light2',
    workspace: {
      variables: [{ name: varName(BRIGHT_VAR), id: BRIGHT_VAR }],
      blocks: { languageVersion: 0, blocks: [
        { type: 'basic_setup', x: 40, y: 40 },
        { type: 'basic_loop', x: 40, y: 180, inputs: { BODY: { block: {
          // 밝기 = 조도 센서 값
          type: 'variables_set', fields: { VAR: { id: BRIGHT_VAR } },
          inputs: { VALUE: { block: { type: 'sensor_cds', fields: { PIN: 'A0' } } } },
          next: { block: {
            type: 'controls_if', extraState: { elseIfCount: 1, hasElse: true },
            inputs: {
              // 어두우면(200 미만) 빨강
              IF0: { block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: {
                A: { block: { type: 'variables_get', fields: { VAR: { id: BRIGHT_VAR } } } },
                B: { block: num(200) },
              } } },
              DO0: { block: led('11', 'HIGH', led('12', 'LOW', led('13', 'LOW'))) },
              // 조금 어두우면(600 미만) 노랑
              IF1: { block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: {
                A: { block: { type: 'variables_get', fields: { VAR: { id: BRIGHT_VAR } } } },
                B: { block: num(600) },
              } } },
              DO1: { block: led('12', 'HIGH', led('11', 'LOW', led('13', 'LOW'))) },
              // 밝으면 초록
              ELSE: { block: led('13', 'HIGH', led('11', 'LOW', led('12', 'LOW'))) },
            },
            next: { block: { type: 'basic_delay',
              inputs: { SECONDS: { block: num(0.2) } } } },
          } },
        } } } },
      ] },
    },
  },
  {
    id: 'door',
    workspace: { blocks: { languageVersion: 0, blocks: [
      { type: 'basic_setup', x: 40, y: 40 },
      { type: 'basic_loop', x: 40, y: 180, inputs: { BODY: { block: {
        type: 'controls_if', extraState: { hasElse: true },
        inputs: {
          IF0: { block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: {
            A: { block: { type: 'sensor_ultrasonic', fields: { TRIG: '7', ECHO: '6' } } },
            B: { block: num(10) },
          } } },
          DO0: { block: {
            type: 'motor_servo', fields: { PIN: '9' },
            inputs: { ANGLE: { block: num(90) } },
            next: { block: { type: 'basic_delay',
              inputs: { SECONDS: { block: num(1) } } } },
          } },
          ELSE: { block: {
            type: 'motor_servo', fields: { PIN: '9' },
            inputs: { ANGLE: { block: num(0) } },
          } },
        },
      } } } },
    ] } },
  },
  {
    id: 'door2',
    workspace: {
      variables: [{ name: varName(DIST_VAR), id: DIST_VAR }],
      blocks: { languageVersion: 0, blocks: [
        { type: 'basic_setup', x: 40, y: 40 },
        { type: 'basic_loop', x: 40, y: 180, inputs: { BODY: { block: {
          // 거리 = 초음파 센서 값
          type: 'variables_set', fields: { VAR: { id: DIST_VAR } },
          inputs: { VALUE: { block: { type: 'sensor_ultrasonic', fields: { TRIG: '7', ECHO: '6' } } } },
          next: { block: {
            type: 'controls_if', extraState: { elseIfCount: 1, hasElse: true },
            inputs: {
              // 아주 가까우면(5cm 미만) 활짝
              IF0: { block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: {
                A: { block: { type: 'variables_get', fields: { VAR: { id: DIST_VAR } } } },
                B: { block: num(5) },
              } } },
              DO0: { block: { type: 'motor_servo', fields: { PIN: '9' },
                inputs: { ANGLE: { block: num(180) } } } },
              // 가까우면(15cm 미만) 반만
              IF1: { block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: {
                A: { block: { type: 'variables_get', fields: { VAR: { id: DIST_VAR } } } },
                B: { block: num(15) },
              } } },
              DO1: { block: { type: 'motor_servo', fields: { PIN: '9' },
                inputs: { ANGLE: { block: num(90) } } } },
              // 멀면 닫기
              ELSE: { block: { type: 'motor_servo', fields: { PIN: '9' },
                inputs: { ANGLE: { block: num(0) } } } },
            },
            next: { block: { type: 'basic_delay',
              inputs: { SECONDS: { block: num(0.2) } } } },
          } },
        } } } },
      ] },
    },
  },
  {
    id: 'fire',
    workspace: { blocks: { languageVersion: 0, blocks: [
      { type: 'basic_setup', x: 40, y: 40 },
      { type: 'basic_loop', x: 40, y: 180, inputs: { BODY: { block: {
        type: 'controls_if',
        inputs: {
          IF0: { block: { type: 'logic_compare', fields: { OP: 'GT' }, inputs: {
            A: { block: { type: 'sensor_dht', fields: { PIN: '4', MODE: 'TEMP' } } },
            B: { block: num(40) },
          } } },
          DO0: { block: { type: 'io_buzzer_tone',
            fields: { PIN: '8', NOTE: '523', BEAT: '0.5' } } },
        },
      } } } },
    ] } },
  },
  {
    id: 'fire2',
    workspace: {
      variables: [{ name: varName(TEMP_VAR), id: TEMP_VAR }],
      blocks: { languageVersion: 0, blocks: [
        { type: 'basic_setup', x: 40, y: 40 },
        { type: 'basic_loop', x: 40, y: 180, inputs: { BODY: { block: {
          // 온도 = 온습도 센서 값
          type: 'variables_set', fields: { VAR: { id: TEMP_VAR } },
          inputs: { VALUE: { block: { type: 'sensor_dht', fields: { PIN: '4', MODE: 'TEMP' } } } },
          next: { block: {
            type: 'controls_if', extraState: { elseIfCount: 1, hasElse: true },
            inputs: {
              // 위험(40도 초과): 높은 음 빠르게 3번
              IF0: { block: { type: 'logic_compare', fields: { OP: 'GT' }, inputs: {
                A: { block: { type: 'variables_get', fields: { VAR: { id: TEMP_VAR } } } },
                B: { block: num(40) },
              } } },
              DO0: { block: { type: 'controls_repeat_ext',
                inputs: {
                  TIMES: { block: num(3) },
                  DO: { block: { type: 'io_buzzer_tone',
                    fields: { PIN: '8', NOTE: '523', BEAT: '0.5' } } },
                } } },
              // 주의(30도 초과): 낮은 음 한 번
              IF1: { block: { type: 'logic_compare', fields: { OP: 'GT' }, inputs: {
                A: { block: { type: 'variables_get', fields: { VAR: { id: TEMP_VAR } } } },
                B: { block: num(30) },
              } } },
              DO1: { block: { type: 'io_buzzer_tone',
                fields: { PIN: '8', NOTE: '262', BEAT: '1' } } },
              // 평상시: 조용히
              ELSE: { block: { type: 'io_buzzer_off', fields: { PIN: '8' },
                next: { block: { type: 'basic_delay',
                  inputs: { SECONDS: { block: num(1) } } } } } },
            },
          } },
        } } } },
      ] },
    },
  },
];

// ── 연습(practice) 배치 ──────────────────────────────────────────
// 정답을 복제한 뒤 (1) 모든 블록을 분리해 격자로 흩어 놓고
// (2) 채워야 하는 값(숫자·핀·켜기/끄기·비교·음계 등)을 전부 오답으로 바꾼다.
// 같은 정답 값은 같은 오답 값으로 바뀌므로 부품 개수는 정답과 동일하게 유지된다
// (예: 센서등 1의 LED 두 블록은 연습에서도 같은 핀 = LED 1개).

const clone = (o) => JSON.parse(JSON.stringify(o));

const PWM_ORDER = ['3', '5', '6', '9', '10', '11'];

function wrongPin(blockType, value) {
  if (/^A\d$/.test(value)) return 'A' + ((Number(value[1]) + 1) % 6); // A0~A5
  if (blockType === 'motor_servo') { // 서보는 PWM 핀 안에서만 이동
    return PWM_ORDER[(PWM_ORDER.indexOf(value) + 1) % PWM_ORDER.length];
  }
  return String((Number(value) + 1) % 14); // D0~D13
}

function mutateFields(block) {
  const f = block.fields;
  if (!f) return;
  if (block.type === 'math_number') {
    f.NUM = f.NUM === 0 ? 1 : 0;
    return;
  }
  for (const key of Object.keys(f)) {
    const v = f[key];
    if (key === 'PIN' || key === 'TRIG' || key === 'ECHO') f[key] = wrongPin(block.type, v);
    else if (key === 'STATE') f[key] = v === 'HIGH' ? 'LOW' : 'HIGH';
    else if (key === 'MODE') f[key] = v === 'TEMP' ? 'HUM' : 'TEMP';
    else if (key === 'OP') f[key] = v === 'LT' ? 'GT' : (v === 'GT' ? 'LT' : v);
    else if (key === 'NOTE') f[key] = v === '523' ? '262' : '523';
    else if (key === 'BEAT') f[key] = v === '1' ? '0.5' : '1';
    // VAR(변수 참조) 등 나머지는 그대로 둔다
  }
}

// 블록 트리를 평평하게: 자신을 목록에 넣고 모든 연결(inputs/next)을 끊는다
function collectDetached(block, out) {
  out.push(block);
  if (block.inputs) {
    for (const name of Object.keys(block.inputs)) {
      const child = block.inputs[name].block;
      if (child) collectDetached(child, out);
    }
    delete block.inputs;
  }
  if (block.next) {
    collectDetached(block.next.block, out);
    delete block.next;
  }
}

function makePractice(answer) {
  const ws = clone(answer);
  const flat = [];
  for (const top of ws.blocks.blocks) collectDetached(top, flat);
  flat.forEach((block, i) => {
    mutateFields(block);
    block.x = 40 + (i % 4) * 240;
    block.y = 40 + Math.floor(i / 4) * 110;
  });
  ws.blocks.blocks = flat;
  return ws;
}

for (const ex of EXAMPLES) ex.practice = makePractice(ex.workspace);

// 제목/설명은 현재 언어를 따라가도록 getter로 둔다 (locales/*.js의 examples 항목)
for (const ex of EXAMPLES) {
  Object.defineProperties(ex, {
    title: { get: () => locale().examples[ex.id].title, enumerable: true },
    description: { get: () => locale().examples[ex.id].description, enumerable: true },
  });
}

// 예제 워크스페이스 JSON을 복제하고 변수 이름을 해당 언어로 바꾼다
function localizeWorkspace(ws, lang) {
  const out = clone(ws);
  for (const v of out.variables || []) {
    const key = EXAMPLE_VARIABLES[v.id];
    if (key) v.name = locale(lang).variables[key];
  }
  return out;
}

module.exports = { EXAMPLES, EXAMPLE_VARIABLES, localizeWorkspace };
