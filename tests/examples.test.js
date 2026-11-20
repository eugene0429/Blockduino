import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import '../src/shared/blocks/index.js';
import { EXAMPLES, localizeWorkspace } from '../src/shared/examples.js';
import { setLang } from '../src/shared/i18n.js';

function codeOf(id) {
  const ex = EXAMPLES.find((e) => e.id === id);
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(ex.workspace, ws);
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('예제 데모', () => {
  it('예제는 6종이고 모두 로드/코드 생성이 된다', () => {
    expect(EXAMPLES.map((e) => e.id)).toEqual(['light', 'light2', 'door', 'door2', 'fire', 'fire2']);
    for (const ex of EXAMPLES) {
      expect(ex.title).toBeTruthy();
      expect(ex.description).toBeTruthy();
      expect(codeOf(ex.id)).toContain('void loop()');
    }
  });

  it('센서등 1: 조도 < 300이면 LED 켜고 아니면 끈다', () => {
    const code = codeOf('light');
    expect(code).toContain('if (analogRead(A0) < 300) {');
    expect(code).toContain('digitalWrite(13, HIGH);');
    expect(code).toContain('digitalWrite(13, LOW);');
    expect(code).toContain('pinMode(13, OUTPUT);');
    expect(EXAMPLES.find((e) => e.id === 'light').title).toBe('Night Light 1');
  });

  it('센서등 2: 밝기 변수 + 3단계 신호등 (빨강/노랑/초록)', () => {
    const code = codeOf('light2');
    expect(code).toContain('float brightness = 0;');            // 변수 '밝기'
    expect(code).toContain('brightness = analogRead(A0);');
    expect(code).toContain('if (brightness < 200) {');           // 어두움 → 빨강
    expect(code).toContain('else if (brightness < 600) {');      // 중간 → 노랑
    expect(code).toContain('digitalWrite(11, HIGH);');
    expect(code).toContain('digitalWrite(12, HIGH);');
    expect(code).toContain('digitalWrite(13, HIGH);');
    for (const pin of [11, 12, 13]) {
      expect(code).toContain(`pinMode(${pin}, OUTPUT);`);
      expect(code).toContain(`digitalWrite(${pin}, LOW);`);
    }
  });

  it('자동문: 10cm 이내면 서보 90도 + 1초 대기, 아니면 0도', () => {
    const code = codeOf('door');
    expect(code).toContain('#include <Servo.h>');
    expect(code).toContain('if (readUltrasonic(7, 6) < 10) {');
    expect(code).toContain('servo_9.write(90);');
    expect(code).toContain('delay((1) * 1000);');
    expect(code).toContain('servo_9.write(0);');
  });

  it('자동문 2: 거리 변수 + 3단계 문 열기 (기존 부품만 사용)', () => {
    const code = codeOf('door2');
    expect(code).toContain('distance = readUltrasonic(7, 6);');   // 변수 '거리'
    expect(code).toContain('if (distance < 5) {');                 // 아주 가까움 → 활짝
    expect(code).toContain('else if (distance < 15) {');           // 가까움 → 반만
    expect(code).toContain('servo_9.write(180);');
    expect(code).toContain('servo_9.write(90);');
    expect(code).toContain('servo_9.write(0);');
  });

  it('화재 경보기 2: 온도 변수 + 단계별 경보음 (기존 부품만 사용)', () => {
    const code = codeOf('fire2');
    expect(code).toContain('temperature = dht_4.readTemperature();'); // 변수 '온도'
    expect(code).toContain('if (temperature > 40) {');                 // 위험 → 빠른 경보 3번
    expect(code).toContain('for (int i = 0; i < 3; i++) {');
    expect(code).toContain('tone(8, 523);');
    expect(code).toContain('else if (temperature > 30) {');            // 주의 → 낮은 음
    expect(code).toContain('tone(8, 262);');
    expect(code).toContain('noTone(8);');                       // 평상시 → 조용
  });

  it('모든 예제에 연습 배치가 있다 — 정답과 다르지만 블록 개수는 같다', () => {
    for (const ex of EXAMPLES) {
      expect(ex.practice, ex.id).toBeTruthy();
      expect(JSON.stringify(ex.practice)).not.toBe(JSON.stringify(ex.workspace));
      const a = new Blockly.Workspace();
      const p = new Blockly.Workspace();
      Blockly.serialization.workspaces.load(ex.workspace, a);
      Blockly.serialization.workspaces.load(ex.practice, p);
      // 필요한 블록은 전부 보드 위에 있어야 한다 (분리만 되고 없어지진 않음)
      expect(p.getAllBlocks(false).length, ex.id).toBe(a.getAllBlocks(false).length);
      // 연습 배치도 코드 생성이 가능해야 한다 (크래시 없음)
      expect(() => g.workspaceToCode(p), ex.id).not.toThrow();
      a.dispose();
      p.dispose();
    }
  });

  it('연습 배치는 모든 블록이 분리되어 있다', () => {
    for (const ex of EXAMPLES) {
      const a = new Blockly.Workspace();
      Blockly.serialization.workspaces.load(ex.workspace, a);
      const total = a.getAllBlocks(false).length;
      a.dispose();
      // 최상위 블록 수 == 전체 블록 수 → 연결된 블록이 하나도 없음
      expect(ex.practice.blocks.blocks.length, ex.id).toBe(total);
      for (const b of ex.practice.blocks.blocks) {
        expect(b.inputs, `${ex.id}:${b.type}`).toBeUndefined();
        expect(b.next, `${ex.id}:${b.type}`).toBeUndefined();
      }
    }
  });

  it('연습 배치는 채워야 하는 값들이 전부 정답과 다르다', () => {
    const CHECK_FIELDS = ['NUM', 'PIN', 'TRIG', 'ECHO', 'STATE', 'MODE', 'OP', 'NOTE', 'BEAT'];
    // 연습 배치는 정답과 같은 순회 순서로 블록을 분리하므로 위치별 비교가 가능하다
    const values = (ws) => {
      const out = [];
      const walk = (b) => {
        for (const key of CHECK_FIELDS) {
          if (b.fields && b.fields[key] !== undefined) {
            out.push({ slot: `${b.type}.${key}`, value: String(b.fields[key]) });
          }
        }
        if (b.inputs) for (const k of Object.keys(b.inputs)) walk(b.inputs[k].block);
        if (b.next) walk(b.next.block);
      };
      ws.blocks.blocks.forEach(walk);
      return out;
    };
    for (const ex of EXAMPLES) {
      const answer = values(ex.workspace);
      const practice = values(ex.practice);
      expect(practice.length, ex.id).toBe(answer.length);
      answer.forEach((a, i) => {
        // 같은 자리(블록·필드)인데 값은 전부 달라야 한다
        expect(practice[i].slot, `${ex.id} #${i}`).toBe(a.slot);
        expect(practice[i].value, `${ex.id} ${a.slot}`).not.toBe(a.value);
      });
    }
  });

  it('센서등 1 연습도 LED는 한 개만 사용 (두 LED 블록의 핀이 같다)', () => {
    const light = EXAMPLES.find((e) => e.id === 'light');
    const ledPins = light.practice.blocks.blocks
      .filter((b) => b.type === 'io_led')
      .map((b) => b.fields.PIN);
    expect(ledPins.length).toBe(2);
    expect(new Set(ledPins).size).toBe(1); // 같은 핀 = LED 1개
    expect(ledPins[0]).not.toBe('13');     // 단, 정답 핀은 아님
  });

  it('화재 경보기: 온도 > 40이면 경보음', () => {
    const code = codeOf('fire');
    expect(code).toContain('DHT dht_4(4, DHT11);');
    expect(code).toContain('if (dht_4.readTemperature() > 40) {');
    expect(code).toContain('tone(8, 523);');
  });
});

describe('시리얼 디버그 (센서값 자동 출력)', () => {
  function debugCodeOf(id) {
    const ex = EXAMPLES.find((e) => e.id === id);
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(ex.workspace, ws);
    g.debugSerial = true;
    try {
      return g.workspaceToCode(ws);
    } finally {
      g.debugSerial = false;
      ws.dispose();
    }
  }

  it('OFF가 기본값이라 일반 생성 코드에는 Serial이 없다', () => {
    const code = codeOf('light');
    expect(code).not.toContain('Serial');
  });

  it('센서등 1: 조도값을 300ms 주기로 출력한다', () => {
    const code = debugCodeOf('light');
    expect(code).toContain('Serial.begin(9600);');
    expect(code).toContain('if (millis() - _dbgLast >= 300) {');
    expect(code).toContain('Serial.print("Light(A0): "); Serial.println(analogRead(A0));');
  });

  it('자동문 1: 초음파 헬퍼가 50ms 이내 재호출 시 재트리거하지 않는다', () => {
    const code = debugCodeOf('door');
    expect(code).toContain('Serial.print("Distance(cm): "); Serial.println(readUltrasonic(7, 6));');
    // 디버그 모드 헬퍼는 최근 값을 캐시하고 짧은 간격 재호출을 차단한다
    expect(code).toContain('unsigned long _usLastT = 0;');
    expect(code).toContain('if (_usLastT != 0 && millis() - _usLastT < 50) return _usLast;');
  });

  it('디버그 OFF면 초음파 헬퍼에 캐시/레이트리밋이 없다', () => {
    const code = codeOf('door');
    expect(code).not.toContain('_usLast');
    expect(code).toContain('return duration * 0.0343 / 2.0;');
  });

  it('화재 경보기: 온도값을 출력한다 (DHT 선언 포함)', () => {
    const code = debugCodeOf('fire');
    expect(code).toContain('Serial.print("Temp(C): "); Serial.println(dht_4.readTemperature());');
    expect(code).toContain('DHT dht_4(4, DHT11);');
  });

  it('한국어 설정이면 센서값 라벨도 한글', () => {
    setLang('ko');
    try {
      expect(debugCodeOf('light')).toContain('Serial.print("조도(A0): ");');
      expect(debugCodeOf('fire')).toContain('Serial.print("온도(℃): ");');
    } finally {
      setLang('en');
    }
  });

  it('연습 배치(센서 분리 상태)에서도 센서값이 출력된다', () => {
    const ex = EXAMPLES.find((e) => e.id === 'light');
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(ex.practice, ws);
    g.debugSerial = true;
    let code;
    try { code = g.workspaceToCode(ws); } finally { g.debugSerial = false; ws.dispose(); }
    // 연습 배치는 조도 센서 핀이 정답(A0)과 다르지만, 어떤 핀이든 출력돼야 한다
    expect(code).toMatch(/Serial\.println\(analogRead\(A\d\)\);/);
  });

  it('모든 예제가 디버그 모드에서도 크래시 없이 생성된다', () => {
    for (const ex of EXAMPLES) {
      expect(() => debugCodeOf(ex.id), ex.id).not.toThrow();
    }
  });
});

describe('예제 다국어', () => {
  it('제목/설명은 현재 언어를 따른다', () => {
    const ex = EXAMPLES.find((e) => e.id === 'light');
    expect(ex.title).toBe('Night Light 1');
    setLang('ko');
    try {
      expect(ex.title).toBe('센서등 1');
      expect(ex.description).toBe('어두워지면 LED가 켜져요');
    } finally {
      setLang('en');
    }
  });

  it('localizeWorkspace는 예제 변수 이름을 번역하고 원본은 건드리지 않는다', () => {
    const ex = EXAMPLES.find((e) => e.id === 'light2');
    const ko = localizeWorkspace(ex.practice, 'ko');
    expect(ko.variables[0].name).toBe('밝기');
    expect(localizeWorkspace(ex.workspace, 'en').variables[0].name).toBe('brightness');
    expect(ex.practice.variables[0].name).toBe('brightness');
  });
});
