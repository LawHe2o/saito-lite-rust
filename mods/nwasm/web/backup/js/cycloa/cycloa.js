'use strict';

/**
 * cycloa名前空間本体
 * @namespace
 * @type {Object}
 */
var cycloa = {};
/**
 * エラークラスの名前空間
 * @type {Object}
 * @namespace
 */
cycloa.err = {};
/**
 * ユーティリティの名前空間
 * @type {Object}
 */
cycloa.util = {};
cycloa.debug = false;

cycloa.NesPalette = new Uint32Array([
	0x787878, 0x2000b0, 0x2800b8, 0x6010a0, 0x982078, 0xb01030, 0xa03000,
	0x784000, 0x485800, 0x386800, 0x386c00, 0x306040, 0x305080, 0x000000,
	0x000000, 0x000000, 0xb0b0b0, 0x4060f8, 0x4040ff, 0x9040f0, 0xd840c0,
	0xd84060, 0xe05000, 0xc07000, 0x888800, 0x50a000, 0x48a810, 0x48a068,
	0x4090c0, 0x000000, 0x000000, 0x000000, 0xffffff, 0x60a0ff, 0x5080ff,
	0xa070ff, 0xf060ff, 0xff60b0, 0xff7830, 0xffa000, 0xe8d020, 0x98e800,
	0x70f040, 0x70e090, 0x60d0e0, 0x787878, 0x000000, 0x000000, 0xffffff,
	0x90d0ff, 0xa0b8ff, 0xc0b0ff, 0xe0b0ff, 0xffb8e8, 0xffc8b8, 0xffd8a0,
	0xfff090, 0xc8f080, 0xa0f0a0, 0xa0ffc8, 0xa0fff0, 0xa0a0a0, 0x000000,
	0x000000
]);
