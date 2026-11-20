'use strict';
const { t } = require('../shared/i18n.js');

function friendlyError(stage, output) {
  const detail = output || '';
  if (stage === 'no-port') {
    return { message: t('err.noPort'), detail };
  }
  if (/access is denied|permission denied|resource busy/i.test(detail)) {
    return { message: t('err.busy'), detail };
  }
  if (/stk500|programmer is not responding|can't open device|no device found/i.test(detail)) {
    return { message: t('err.usb'), detail };
  }
  if (stage === 'compile') {
    return { message: t('err.compile'), detail };
  }
  return { message: t('err.upload'), detail };
}

module.exports = { friendlyError };
