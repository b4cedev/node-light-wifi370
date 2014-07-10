/**
 * Created by sb on 05.04.14.
 */
"use strict";

exports.extend = function(dst) {
    for (var i = 1, j = arguments.length; i < j; i++) {
        var src = arguments[i];
        for (var key in src) {
            if (Object.prototype.hasOwnProperty.call(src, key)) {
                dst[key] = src[key];
            }
        }
    }
    return dst;
};

exports.validateByte = function(val, name) {
//console.log('validateByte(): val, name:', val, name);
    if (!name) { name = 'value'; }
    if (typeof val === 'number') {
        if (val < 0) {
            val = 0;
        }
        if (val >= 0 && val <= 1) {
            val = Math.round(val * 255);
        }
    }
    if ((typeof val !== 'number') || (val % 1 !== 0)) {
        throw new Error('checkByte(): ' + name + ' is not a number: ' + val);
    }
    if (val < 0 || val > 255) {
        throw new Error('checkByte(): ' + name + ' is not in the range 0..255: ' + val);
    }
    return val;
};
