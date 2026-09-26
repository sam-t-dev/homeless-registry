#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const p1 = fs.readFileSync(path.join(__dirname, 'data', 'generate-world-data.part1.txt'), 'utf8');
const p2 = fs.readFileSync(path.join(__dirname, 'data', 'generate-world-data.part2.txt'), 'utf8');
const code = p1 + p2;
const tmp = path.join(__dirname, 'data', '_generate_world_data_runtime.js');
fs.writeFileSync(tmp, code);
require(tmp);
