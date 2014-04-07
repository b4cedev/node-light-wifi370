/* global exports:true console */
/**
 * Created by sb on 03.04.14.
 */

(function () {
    "use strict";

    var defaults = {
        host: "192.168.10.81",
        port: 5577
    };

    var COMMAND_INIT = "\xef\x01\x77";
    var COMMAND_ON = "\xcc\x23\x33";
    var COMMAND_OFF = "\xcc\x24\x33";
//var COMMAND_RGB="\x56\xRR\xGG\xBB\xaa";

    var Q = require('q');
    var net = require('net');
    var extend = require('./util').extend;

    function Client(options) {
        this.options = extend({}, defaults, options);
        this._socket = undefined;
        this._status = undefined;

        var client = this;
        ['connect', 'disconnect', 'status', 'turnOn', 'turnOff', 'setLevel'].forEach(function (method) {
            client[method] = client[method].bind(client);
        });
    }
    extend(Client, {

        defaults: defaults
    });
    extend(Client.prototype, {

        connect: function () {
            var client = this;
            var deferred = Q.defer();
            this._socket = net.connect({host: this.options.host, port: this.options.port});

            this._socket.on('connect', function () {
                console.log('Client.connect(): Connected to ' + client.options.host + ':' + client.options.port);
                client.status()
                    .then(deferred.resolve, deferred.reject);
            });
            this._socket.on('error', function (error) {
                console.error('socket error:', error);
                client._socket.destroy();
                client._socket = undefined;
                throw error;
            });
            this._socket.on('end', function () {
                console.log('socket closed');
            });

            return deferred.promise;
        },

        disconnect: function () {
            var client = this;
            var deferred = Q.defer();
            if (!this._socket) {
                console.log('Client.disconnect(): not connected');
                return deferred.resolve().promise;
            }
            var onTimeout = function () {
                console.error('Client.disconnect(): timeout');
                deferred.reject(new Error('timeout'));
            };
            var timeoutId = setTimeout(onTimeout, 5000);
            var onEnd = function () {
                console.log('Client.disconnect(): socket closed');
                client._socket.removeListener('end', onEnd);
                clearTimeout(timeoutId);
                this._socket = undefined;
                deferred.resolve();
            };
            this._socket.on('end', onEnd);
            this._socket.end();

            return deferred.promise;
        },

        sendMessage: function (message, expectAnswer) {
            var client = this;
            var buffer = new Buffer(message, 'binary');
//            console.log('Client.sendMessage(): expectAnswer, buffer:', expectAnswer, buffer);
            var deferred = Q.defer();
            if (!this._socket) {
                return deferred.reject(new Error('Client.sendMessage(): not connected')).promise;
            }
            var onSent;
            if (expectAnswer) {
                var onTimeout = function () {
                    console.error('Client.sendMessage(): timeout waiting for answer');
                    deferred.reject(new Error('timeout'));
                };
                var timeoutId = setTimeout(onTimeout, 5000);
                var onAnswer = function (data) {
                    client._socket.removeListener('data', onAnswer);
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
//            console.log('Client.status()');
            return this.sendMessage(COMMAND_INIT, true)
                .then(function (data) {
//                    console.log('Client.status(): Got data:', data);
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
                    var status = {
                        on: data[2] === 0x23,
                        mode: data[3],
                        running: data[4] === 0x21,
                        speed: data[5],
                        red: data[6],
                        green: data[7],
                        blue: data[8],
                        userMemory: data[9]
                    };
                    console.log('Client.status():', status);
                    return status;
                });
        },

        turnOff: function () {
            console.log('Client.turnOff()');
            return this.sendMessage(COMMAND_OFF);
        },

        turnOn: function () {
            console.log('Client.turnOn()');
            return this.sendMessage(COMMAND_ON);
        },

        setLevel: function (level) {
            console.log('Client.setLevel(): level:', level);
            return this.sendMessage(new Buffer([0x56, level, level, level, 0xaa]));
        },

        setColor: function (r, g, b) {
            console.log('Client.setColor(): r, g, b:', r, g, b);
            return this.sendMessage(new Buffer([0x56, r, g, b, 0xaa]));
        }
    });
    module.exports = Client;

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
