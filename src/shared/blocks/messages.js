'use strict';
const Blockly = require('blockly/core');
const { locale, getLang } = require('../i18n.js');

// Copy our block messages into Blockly.Msg so block JSON can reference them
// as %{BKY_<KEY>}. References are resolved when a block is created, so after
// switching language the renderer re-creates the workspace blocks.
function applyBlockMessages(lang = getLang()) {
  Object.assign(Blockly.Msg, locale(lang).blocks);
}

applyBlockMessages();

module.exports = { applyBlockMessages };
