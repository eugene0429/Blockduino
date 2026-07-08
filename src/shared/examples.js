'use strict';

// 미리 만들어진 예제 데모: 블록이 일부 연결된 상태의 워크스페이스 JSON.
// 배선 카드는 배선 탭이 사용 중인 부품 블록에서 자동으로 그려준다 (wiring.js).

const num = (n) => ({ type: 'math_number', fields: { NUM: n } });
const led = (pin, state, next) => ({
  type: 'io_led', fields: { PIN: pin, STATE: state },
  ...(next ? { next: { block: next } } : {}),
});

// 센서등 2에서 쓰는 변수 '밝기'의 고정 id
const BRIGHT_VAR = 'bright-var-id';

const EXAMPLES = [
  {
    id: 'light',
    title: '센서등 1',
    description: '어두워지면 LED가 켜져요',
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
    title: '센서등 2',
    description: '밝기에 따라 빨강·노랑·초록 불이 켜져요',
    workspace: {
      variables: [{ name: '밝기', id: BRIGHT_VAR }],
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
    title: '자동문',
    description: '가까이 가면 서보모터가 문을 열어요',
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
    id: 'fire',
    title: '화재 경보기',
    description: '온도가 높아지면 부저가 울려요',
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
];

module.exports = { EXAMPLES };
