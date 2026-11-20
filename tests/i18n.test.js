import { describe, it, expect, afterEach } from 'vitest';
import * as Blockly from 'blockly';
import '../src/shared/blocks/index.js';
import { applyBlockMessages } from '../src/shared/blocks/messages.js';
import { LOCALES, setLang, getLang, t, DEFAULT_LANG } from '../src/shared/i18n.js';

afterEach(() => {
  setLang('en');
  applyBlockMessages('en');
});

const sections = ['ui', 'blocks', 'examples', 'variables'];

describe('i18n', () => {
  it('기본 언어는 영어', () => {
    expect(DEFAULT_LANG).toBe('en');
    expect(getLang()).toBe('en');
  });

  it('모든 언어가 같은 키를 가진다', () => {
    for (const section of sections) {
      const enKeys = Object.keys(LOCALES.en[section]).sort();
      for (const [lang, loc] of Object.entries(LOCALES)) {
        expect(Object.keys(loc[section]).sort(), `${lang}.${section}`).toEqual(enKeys);
      }
    }
  });

  it('블록 메시지의 %N 자리표시자 개수가 언어마다 같다', () => {
    const placeholders = (s) => (s.match(/%\d/g) || []).sort().join(',');
    for (const [key, en] of Object.entries(LOCALES.en.blocks)) {
      expect(placeholders(LOCALES.ko.blocks[key]), key).toBe(placeholders(en));
    }
  });

  it('t()는 파라미터를 치환하고, 모르는 언어는 영어로 대체한다', () => {
    expect(t('port.arduino', { port: 'COM3' })).toBe('Arduino board (COM3)');
    setLang('ko');
    expect(t('port.arduino', { port: 'COM3' })).toBe('아두이노 보드 (COM3)');
    setLang('xx');
    expect(getLang()).toBe('en');
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('블록 문구가 언어에 맞게 그려진다 (드롭다운 포함)', () => {
    const textOf = () => {
      const ws = new Blockly.Workspace();
      const b = ws.newBlock('io_led');
      const text = b.toString();
      ws.dispose();
      return text;
    };
    expect(textOf()).toContain('turn LED on pin');
    applyBlockMessages('ko');
    expect(textOf()).toContain('번 핀');
    expect(textOf()).toContain('켜기');
  });

  it('% 문자가 들어간 드롭다운(습도)도 깨지지 않는다', () => {
    const ws = new Blockly.Workspace();
    const b = ws.newBlock('sensor_dht');
    b.setFieldValue('HUM', 'MODE');
    expect(b.getField('MODE').getText()).toBe('humidity (%)');
    ws.dispose();
  });
});
