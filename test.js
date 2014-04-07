#!/usr/bin/env node
/**
 * Created by sb on 04.04.14.
 */

(function defineTest() {
    "use strict";

    var Client = require('./lib/driver');
    var client = new Client();
    
    client.connect()
        .then(client.turnOn)
//        .then(client.setLevel.bind(client, 50))
//        .delay(500)
//        .then(client.setLevel.bind(client, 150))
//        .delay(500)
//        .then(client.setLevel.bind(client, 255))
//        .delay(500)
        .then(client.setColor.bind(client, 255, 0, 0))
        .delay(500)
        .then(client.setColor.bind(client, 0, 255, 0))
        .delay(500)
        .then(client.setColor.bind(client, 0, 0, 255))
        .delay(500)
        .then(client.turnOff)
        .then(client.disconnect)/*
        .then(process.exit)*//*
        .fail(function (error) {
            console.error('Error:', error);
        })*/
        .done();


//driver.setColor("green")
//green is predefined as 100.  If you want to overwrite the predefined colors or just mix your own
//colors, a method has been provided.
//driver.mixColor("greenish", 120); lights.setColor("greenish")

})();
