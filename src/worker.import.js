/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
//@ts-check
const path = require('path')
require('ts-node').register()
require(path.resolve(__dirname, './worker.ts'))