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
    this.servoUsed_ = false; // 서보 블록이 쓰이면 loop 끝에 지터 방지 지연을 넣는다
    this.varNames_ = new Map();
    const usedNames = new Set();
    let seq = 0;
    for (const v of workspace.getAllVariables()) {
      let name = v.name.replace(/[^A-Za-z0-9_]/g, '');
      if (!name || /^[0-9]/.test(name) || this.RESERVED_WORDS_.split(',').includes(name)) {
        do {
          seq += 1;
          name = `var${seq}`;
        } while (usedNames.has(name));
      } else if (usedNames.has(name)) {
        // sanitize 후 이름이 충돌하면(예: 'led값'과 'led' 모두 'led') 번호를 붙여 유니크화
        let suffix = 2;
        let candidate = `${name}${suffix}`;
        while (usedNames.has(candidate)) {
          suffix += 1;
          candidate = `${name}${suffix}`;
        }
        name = candidate;
      }
      usedNames.add(name);
      this.varNames_.set(v.getId(), name);
      this.addDeclaration(`var_${name}`, `float ${name} = 0;`);
    }
    // 시리얼 디버그: 워크스페이스의 모든 센서 블록을 스캔해 값 출력을 준비한다.
    // 연결 여부와 무관하게 센서를 찾으므로, 블록이 분리된 상태에서도 값이 찍힌다.
    this.debugReads_ = [];
    if (this.debugSerial && this.debugLabels) {
      const seen = new Set();
      for (const type of Object.keys(this.debugLabels)) {
        for (const block of workspace.getBlocksByType(type, false)) {
          if (block.isInsertionMarker && block.isInsertionMarker()) continue;
          if (block.isEnabled && !block.isEnabled()) continue;
          const [expr] = this.forBlock[type](block, this); // include/함수/setup 부수효과 등록
          if (seen.has(expr)) continue;
          seen.add(expr);
          this.debugReads_.push({ label: this.debugLabels[type](block), expr });
        }
      }
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
    // 시리얼 디버그가 켜져 있으면 loop 끝에 300ms 스로틀 센서값 출력을 붙인다.
    // (예제마다 delay가 달라 매 루프 출력 시 폭주하므로 millis로 주기를 고정)
    if (this.debugSerial && this.debugReads_ && this.debugReads_.length) {
      this.addSetup('serial_begin', 'Serial.begin(9600);');
      this.addDeclaration('dbg_last', 'unsigned long _dbgLast = 0;');
      const lines = this.debugReads_
        .map((r) => `    Serial.print("${r.label}: "); Serial.println(${r.expr});`)
        .join('\n');
      this.loopBody_ += '  if (millis() - _dbgLast >= 300) {\n' +
        `    _dbgLast = millis();\n${lines}\n  }\n`;
    }
    // 서보를 쓰면 loop가 초고속으로 돌 때 서보가 덜덜 떨린다(지터). loop 끝에
    // 서보 갱신 주기(20ms)만큼 짧은 지연을 넣어 안정화한다.
    if (this.servoUsed_) this.loopBody_ += '  delay(20);\n';
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
