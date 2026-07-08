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

describe('재미 동작 블록', () => {
  it('LED 점사 → ledBurst 헬퍼 1회 정의 + 호출', () => {
    const code = loopCode({ type: 'io_led_effect', fields: { PIN: '13', EFFECT: 'BURST' } });
    expect(code).toContain('void ledBurst(int pin)');
    expect(code).toContain('ledBurst(13);');
    expect(code).toContain('pinMode(13, OUTPUT);');
  });

  it('LED SOS 신호', () => {
    const code = loopCode({ type: 'io_led_effect', fields: { PIN: '7', EFFECT: 'SOS' } });
    expect(code).toContain('void ledSos(int pin)');
    expect(code).toContain('ledSos(7);');
  });

  it('LED 천천히 깜빡이기', () => {
    const code = loopCode({ type: 'io_led_effect', fields: { PIN: '13', EFFECT: 'BLINK' } });
    expect(code).toContain('ledBlink(13);');
  });

  it('부저 멜로디: 비행기 → 음표 배열 + playMelody 호출', () => {
    const code = loopCode({ type: 'io_buzzer_melody', fields: { PIN: '8', SONG: 'PLANE' } });
    expect(code).toContain('void playMelody(int pin, const int notes[], const int beats[], int length)');
    expect(code).toContain('const int MELODY_PLANE_NOTES[]');
    expect(code).toContain('const int MELODY_PLANE_BEATS[]');
    expect(code).toContain('playMelody(8, MELODY_PLANE_NOTES, MELODY_PLANE_BEATS, 26);');
  });

  it('부저 멜로디: 학교종/작은별도 정의되어 있다', () => {
    const bell = loopCode({ type: 'io_buzzer_melody', fields: { PIN: '8', SONG: 'BELL' } });
    expect(bell).toContain('playMelody(8, MELODY_BELL_NOTES, MELODY_BELL_BEATS, 24);');
    const star = loopCode({ type: 'io_buzzer_melody', fields: { PIN: '8', SONG: 'STAR' } });
    expect(star).toContain('playMelody(8, MELODY_STAR_NOTES, MELODY_STAR_BEATS, 14);');
  });

  it('서보 왔다갔다 흔들기', () => {
    const code = loopCode({ type: 'motor_servo_effect', fields: { PIN: '9', EFFECT: 'SWEEP' } });
    expect(code).toContain('#include <Servo.h>');
    expect(code).toContain('servo_9.attach(9);');
    expect(code).toContain('void servoSweep(Servo &s)');
    expect(code).toContain('servoSweep(servo_9);');
  });

  it('서보 인사하기', () => {
    const code = loopCode({ type: 'motor_servo_effect', fields: { PIN: '10', EFFECT: 'NOD' } });
    expect(code).toContain('servoNod(servo_10);');
  });

  it('LCD 화면 깜빡이기', () => {
    const code = loopCode({ type: 'lcd_blink' });
    expect(code).toContain('lcd.init();');
    expect(code).toContain('void lcdBlink()');
    expect(code).toContain('lcd.noBacklight();');
    expect(code).toContain('lcdBlink();');
  });
});
