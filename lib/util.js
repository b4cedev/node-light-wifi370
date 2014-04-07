/**
 * Created by sb on 05.04.14.
 */

exports.extend = function(dst) {
    "use strict";
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
