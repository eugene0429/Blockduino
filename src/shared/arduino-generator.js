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
