module.paths.push('/usr/lib/node_modules');

var app = new function () {
    //modules
    var
		app = this,
		configFile = __dirname + '/config/homecloudhub.json',
        node = {
			'ssdp': require('node-ssdp'),
            'http': require('http'),
			'url': require('url'),
            'request': require('request'),
            'colors': require('colors'),
			'fs': require('fs')
        },
        config = {},
        modules = [],
        server = null,

        doInit = function () {
            if (config.modules) {
                log({info: 'Processing modules...'});
                for (module in config.modules) {
                    log({info: '   + Loading module ' + module});
                    modules[module] = require('./modules/' + module + '.js');
                }
            }


            //prepare the connections
            if (config.connections) {
                for (i in config.connections) {
                    if (config.connections[i].events) {
                        config.connections[i].events = (config.connections[i].events instanceof Array ? config.connections[i].events : config.connections[i].events.split(','));
                    }
                    if (config.connections[i].outputs) {
                        config.connections[i].outputs = (config.connections[i].outputs instanceof Array ? config.connections[i].outputs : config.connections[i].outputs.split(','));
                    }
                }
            }

            log({info: 'Finished processing modules, starting...'});
            for (module in modules) {
                if ((modules[module]) && (modules[module].start)) {
                    log({info: '   + Starting module ' + module});
                    var func = function (module) {
                        setTimeout(
                            function () {
                                //start the module
                                modules[module].start(app, module, config.modules[module], function (event) {
                                    doProcessEvent(module, event);
                                }, this)
                            }, 1);
                    }(module);
                }
            }

            log({info: 'Initialization complete.'});
            log({info: '===================================================================================================='});
            log();
        },

        //process events from modules
        doProcessEvent = function (module, event) {
			try {
	            if (event) {
	                //log support
	                if (event.name == 'log') {
						if (event.data) {
							event.data.module = module;
							log(event.data);
						}
	                } else if (event.data && event.data.device) {
		                var device = event.data.device;
		                if (device.id && device.name && device.type) {
		                    try {
								var data = {
									module: module,
									id: device.id,
									name: device.name,
									type: device.type,
									event: event.name,
									value: event.data.value
								};
		                        for (attr in device) {
		                            if (attr.substr(0, 5) == 'data-') {
		                                data[attr] = device[attr];
		                            }
		                        }
		                        log({info: 'Sending event to SmartThings: ' + (event.data.description || '')});
					            node.request.put({
			                        url: 'http://' + config.server.ip + ':' + config.server.port + '/event',
			                        headers: {
            			                'Content-Type': 'application/json'
			                        },
			                        json: true,
			                        body: {
										event: 'event',
										data: data
									}
		                        },
			                    function (err, response, body) {
									if (err) {
			                            log({error: 'Failed sending event: ' + err});
									}
			                    });

		                    } catch (e) {
		                        log({error: 'Error parsing event data: ' + e});
		                    }
		                }
					}
				}
	        } catch(e) {
	            error('Failed to send event to SmartThings: ' + e);
	        }
	    },

    
		log = function(event) {
			var t = (new Date()).toLocaleString();
			if (event) {
			event.module = event.module || 'homecloudhub';
				if (event.info) {
					console.log(t + ' [' + node.colors.cyan(event.module) + '] ' + event.info);
				}
				if (event.message) {
					console.log(t + ' [' + node.colors.green(event.module) + '] ' + event.message);
				}
	                if (event.alert) {
	                    console.log(t + ' [' + node.colors.yellow(event.module) + '] ' + event.alert);
	                }
	                if (event.error) {
	                    console.log(t + ' [' + node.colors.red(event.module) + '] ' + event.error);
	                }
		    } else {
			console.log('');
		    }
		},

    	doProcessRequest = function(request, response) {
			try {
				var urlp = node.url.parse(request.url, true);	
				//console.log('got a request ' + urlp.pathname + ' >>> ' + JSON.stringify(urlp.query));
				var path = urlp.pathname;
				var query = urlp.query;
				var payload = null;
				if (query && query.payload) {
					payload = JSON.parse((new Buffer(query.payload, 'base64')).toString())
				}
		        if (request.method == 'GET') {
					switch (urlp.pathname) {
						case '/ping':
							response.writeHead(202, {'Content-Type': 'application/json'});
							var data = {
								service: 'hch',
								result: 'pong'
							};
							response.write(JSON.stringify(data));
							response.end();
							return;
						case '/init':
							console.log('init');
							if (payload && payload.server && payload.modules) {
								response.writeHead(202, {'Content-Type': 'application/json'});
								response.end();
								if (payload.server && payload.server.ip && payload.server.port) {
									config.server = payload.server || config.server;
									doSaveConfig();
								}
                                for (module in payload.modules) {
                                    var cfg = payload.modules[module];
                                    app.startModule(module, cfg);
                                }

							}
						break;
					}
				}
			} catch (e) {
				console.log("ERROR: " + e);
			}
			response.writeHead(500, {});
			response.end();
	    },


		doLoadConfig = function() {
			node.fs.readFile(configFile, function read(err, data) {
				if (!err) {
					try {
						config.server = JSON.parse(data);
						if (config.server && config.server.ip && config.server.port) {
							log({info: 'Retrieved config with server at ' + config.server.ip + ':' + config.server.port});
				            node.request.put({
		                        url: 'http://' + config.server.ip + ':' + config.server.port,
		                        headers: {
	          			                'Content-Type': 'application/json'
		                        },
		                        json: true,
		                        body: {
									event: 'init'
								}
	                        });
						}
					} catch(e) {
						log({error: 'Failed reading config file: ' + e});
					}
			    }
			});
		},

		doSaveConfig = function() {
			node.fs.writeFile(configFile, JSON.stringify(config.server, null, 4));
		};


    this.start = function () {
        log();
        log();
        log();
        log();
        log({info: 'Home Cloud Hub app v0.1'});
        log({info: '===================================================================================================='});


		var ssdpServer = new node.ssdp.Server();
		ssdpServer.addUSN('urn:schemas-upnp-org:device:HomeCloudHubLocalServer:624');
		ssdpServer.start();
/*
		var ssdpClient = new node.ssdp.Client();
		ssdpClient.on('response', function (headers, statusCode, rinfo) {
			console.log(headers);
			console.log(rinfo);
		});
		ssdpClient.search('ssdp:all');
*/

		config = {};
        server = node.http.createServer(doProcessRequest);
        server.listen(42457, '0.0.0.0'); //hchls - HCH Local Server
		doLoadConfig();

    }

    this.startModule = function(module, config) {
		try {
			var initial = !modules[module];
			log({info: 'Starting module ' + module});
	        modules[module] = modules[module] || require('./modules/' + module + '.js');
	        modules[module].config = config;
			if (initial || modules[module].failed) {
		        modules[module].start(app, module, config, function (event) {
		            doProcessEvent(module, event);
		        })
			}
		} catch(e) {
			log({error: 'Error starting module: ' + e});
		}
    }

    //refresh security tokens
    this.refreshTokens = function(module) {

		try {
			if (config.server && config.server.ip && config.server.port) {
	            node.request.put({
                       url: 'http://' + config.server.ip + ':' + config.server.port,
                       headers: {
        			                'Content-Type': 'application/json'
                       },
                       json: true,
                       body: {
							event: 'init',
							data: module
						}
				});
			}
    	} catch(e) {
		}
	};
};





//start the app
app.start();
