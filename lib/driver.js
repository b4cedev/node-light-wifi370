/* global exports:true console */
/**
 * Created by sb on 03.04.14.
 */

(function () {
    "use strict";

    var defaults = {
        autoConnect: true,
        reconnectTries: 3, // integer, 0 for off
        host: "192.168.10.81",
        port: 5577
    };

    var COMMAND_INIT = "\xef\x01\x77";
    var COMMAND_ON = "\xcc\x23\x33";
    var COMMAND_OFF = "\xcc\x24\x33";
//var COMMAND_RGB="\x56\xRR\xGG\xBB\xaa";

    var Q = require('q');
    var extend = require('./util').extend;
    var net = require('net');
    var validateByte = require('./util').validateByte;

    function Driver(options) {
        this.options = extend({}, defaults, options);
        this._disconnecting = false;
        this._prevOptions = {};
        this._socket = undefined;
        this._socketDefer = undefined;
        this._socketPromise = undefined;
        this._status = undefined;

        var driver = this;
        [
            'connect', 'disconnect', 'status', 'turnOn', 'turnOff', 'setLevel',
            'onSocketConnect', 'onSocketEnd', 'onSocketError'
        ].forEach(function (method) {
            driver[method] = driver[method].bind(driver);
        });
    }
    extend(Driver, {
        defaults: defaults
    });
    extend(Driver.prototype, {

        connect: function () {
            if (this._socket) {
//console.log('Driver#connect(): Already connect(ing/ed)');
                return this._socketPromise;
            }
            var driver = this;

            if (!this._socketDefer) {
                this._socketDefer = Q.defer();
                this._socketPromise = this._socketDefer.promise
                    .thenResolve(this).invoke('status')
                    .thenResolve(this).get('_socket')
                    .catch(function (error){
console.error('Driver#connect():', {error: error});
                        driver._socket = undefined;

                        return Q.reject(error);
                    });
//                this._socketPromise.done();
            }

//console.log('Driver#connect(): Connecting...');
            this._socket = net.connect({
                host: this.options.host,
                port: this.options.port
            });

            this._socket.on('connect', this.onSocketConnect);
            this._socket.on('end', this.onSocketEnd);
            this._socket.on('error', this.onSocketError);

            return this._socketPromise;
        },

        reconnect: function (){
            if (!this.options.reconnectTries) { return false; }
            if (this._reconnectTries === undefined) { this._reconnectTries = this.options.reconnectTries; }
            if (0 >= this._reconnectTries) {
console.log('Driver#reconnect(): No (more) reconnects left');
                return false;
            }
console.log('Driver#reconnect(): ' + this._reconnectTries + ' reconnect(s) left');
            this._reconnectTries--;

            if (this.options.autoConnect) {
                // no need to connect manually
                return this._socketPromise;
            }

            return this.connect();
        },

        onSocketConnect: function (){
console.log('Driver#onSocketConnect(): Connected to ' + this.options.host + ':' + this.options.port);
            this._reconnectTries = undefined;
            this._socketDefer.resolve(this._socket);
        },

        onSocketEnd: function (/*error*/){
            if (this._socket) {
                this._socket.destroy();
                this._socket = undefined;
            }
            if (this._disconnecting) {
                this._disconnecting = false;
                this._socketDefer = undefined;
                this._reconnectTries = undefined;
                if (this._prevOptions.autoConnect !== undefined) {
                    $.extend(this.options, this._prevOptions);
                    this._prevOptions = {};
                }
console.log('Driver#onSocketEnd(): Intentional disconnect')
                return;
            }
console.log('Driver#onSocketEnd: Unexpected disconnect');

            if (!this.options.autoConnect) {
                setTimeout(this.reconnect.bind(this), 1000);
            }
        },

        onSocketError: function (error){
            console.error('Driver#onSocketError:', {error: error});
            if (this._socketDefer.promise.isPending()) {
                this._socketDefer.reject(error);
            }
            this.onSocketEnd(error);
        },

        disconnect: function () {
            if (!this._socket) {
                return Q.resolve(this);
            }

            var driver = this;
            var defer = Q.defer();

            var onTimeout = function () {
                console.error('Driver.disconnect(): timeout');
                defer.reject(new Error('timeout'));
            };
            var timeoutId = setTimeout(onTimeout, 5000);

            var onEnd = function () {
                clearTimeout(timeoutId);
                defer.resolve(driver);
            };
            this._socket.on('end', onEnd);

            this._disconnecting = true;
            this._socket.end();

            return defer.promise;
        },

        sendMessage: function (message, expectAnswer) {
            var promise;
            if (this.options.autoConnect) {
                this.connect();
                promise = this._socketDefer.promise;
            } else {
                promise = Q.reject(new Error('Driver: not connected'));
            }
            return promise.thenResolve(this).invoke('_sendMessage', message, expectAnswer);
        },

        _sendMessage: function (message, expectAnswer) {
            var driver = this;
            var buffer = new Buffer(message, 'binary');
//console.log('Driver._sendMessage(): expectAnswer, buffer:', expectAnswer, buffer);
            var deferred = Q.defer();
            if (!this._socket) {
                return deferred.reject(new Error('Driver.sendMessage(): not connected')).promise;
            }
            var onSent;
            if (expectAnswer) {
                var onTimeout = function () {
                    console.error('Driver.sendMessage(): timeout waiting for answer');
                    deferred.reject(new Error('timeout'));
                };
                var timeoutId = setTimeout(onTimeout, 5000);
                var onAnswer = function (data) {
                    clearTimeout(timeoutId);
                    deferred.resolve(data);
                };
                this._socket.on('data', onAnswer);
            } else {
                onSent = function () {
                    deferred.resolve();
                };
            }
            this._socket.write(buffer, onSent);

            return deferred.promise;
        },

        status: function () {
//console.log('Driver#status()');
            if (this._status) {
//console.log('Driver#status(): Already have status:', this._status);
                return Q.resolve(this._status);
            }
            var driver = this;
//console.log('Driver#status(): Fetching status');

            return this.sendMessage(COMMAND_INIT, true)
            .then(function (data) {
//console.log('Driver#status(): Got data:', data);
/*
Die Antwortbytes sind wie folgt:
01: Init (0x66)
02: Init (0x01)
03: Off (0x24) / On (0x23)
04: Mode (0x25 - 0x38)
05: Running (0x21) / Stopped (0x20)
06: Speed  (1/10th seconds?) (0x00 - 0xff)
07: Red (0x00 - 0xff)
08: Green (0x00 - 0xff)
09: Blue (0x00 - 0xff)
10: User Memory used (0xFF) / not used (0x51)
11: Termination (0x99)
*/
                driver._status = {
                    on: data[2] === 0x23,
                    mode: data[3],
                    running: data[4] === 0x21,
                    speed: data[5],
                    red: data[6] / 255,
                    green: data[7] / 255,
                    blue: data[8] / 255,
                    userMemory: data[9]
                };
//console.log('Driver.status():', driver._status);
                return driver._status;
            });
        },

        turnOff: function () {
console.log('Driver#turnOff()');
            return this.sendMessage(COMMAND_OFF);
        },

        turnOn: function () {
console.log('Driver#turnOn()');
            return this.sendMessage(COMMAND_ON);
        },

        setLevel: function (level) {
            level = validateByte(level, 'level');
console.log('Driver#setLevel(): level:', level);
            return this.sendMessage(new Buffer([0x56, level, level, level, 0xaa]));
        },

        setColor: function (color) {
            var red = validateByte(color[0], 'red');
            var green = validateByte(color[1], 'green');
            var blue = validateByte(color[2], 'blue');
//console.log('Driver#setColor(): red, green, blue:', red, green, blue);
            return this.sendMessage(new Buffer([0x56, red, green, blue, 0xaa]));
        }
    });
    module.exports = Driver;

//exports.brighten  = function(callback){ sendMessage(35,00,callback,id); };
//exports.dim       = function(callback){ sendMessage(36,00,callback,id); };
//exports.speedUp   = function(callback){ sendMessage(37,00,callback,id); };
//exports.speedDown = function(callback){ sendMessage(38,00,callback,id); };
//exports.modeUp    = function(callback){ sendMessage(39,00,callback,id); };
//exports.modeDown  = function(callback){ sendMessage(40,00,callback,id); };

//var colors = {
//    "blue"       : 0,
//    "light blue" : 50,
//    "teal"       : 80,
//    "green"      : 100,
//    "yellow"     : 140,
//    "orange"     : 170,
//    "red"        : 180,
//    "purple"     : 190,
//    "pink"       : 200
//};
//exports.mixColor  = function(string, decimal){
//    /******************************************
//     * this function enables you to create or overwrite predefined color strings. With color strings, you can say
//     * lights.setColor("red") instead of having to remember red is 180.  This function allows you to say:
//     * lights.mixColor("awesome", 237) if that's what you want.
//     *
//     * This function takes two arguments; the first is the label for the second argument, which is the value of
//     * the color.  It's called "decimal" because it's a base-10 integer, not because it's a floating point number.
//     **************************************************************************/
//    colors[string] = decimal;
//};
//exports.setColor = function(color, callback, id){
//    if(typeof(color) == "string" && color in colors) color = colors[color]
//    if(!parseInt(color) === color) return console.trace("improper argument (" + color + ") supplied to setColor function with id: " + id)
//    sendMessage(32,color,callback,id)
//};

})();
