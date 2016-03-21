module.paths.push('/usr/lib/node_modules');

var exports = module.exports = new function () {
	var
		app = null,
		module = null,
		config = {},
		callback = null,
		failed = false,
		https = require('https'),
		request = require('request').defaults({
			jar: true,
			encoding: 'utf8',
			followRedirect: true,
			followAllRedirects: true
		}),
		jar = null,
		devices = [],
		//recover timer for re-sync - if initial recover request failed
		tmrRecover = null,
		tmrTimeout = null,
		//listener socket (client) for events from digitallife
		listener = null,
		key = null,
		authToken = null,
		requestToken = null,
		lastCommand = null,

		//initialization of cookies
		doInit = function () {
			log('Initializing...');
			failed = false;


			if (config.key && config.authToken && config.requestToken) {
				log('Successfully got tokens.');
				//check devices every 3 minutes
				jar = request.jar();
				for (i in config.cookies) {
					var cookie = request.cookie(config.cookies[i]);
					jar.setCookie(cookie, 'https://my-digitallife.att.com');
				}

				//disable the automatic recovery
				if (tmrRecover) clearTimeout(tmrRecover);
				tmrRecover = null;

				doGetDevices();
				doListen();
				if (config.controllable && lastCommand && (lastCommand.retry < 1)) {
					doProcessCommand(lastCommand.deviceId, lastCommand.command, lastCommand.value);
				} else {
					lastCommand = null;
				}
			}
		},

		//recovering procedures
		doRecover = function () {
			if (failed) {
				return;
			}

			alert('Refreshing security tokens...');
			failed = true;
			//abort any existing listener client

			if (listener && listener.abort) {
				try {
					listener.abort();
				} catch (e) {}
			}
			listener = null;
			config = {};

			//abort listener silence detector
			if (tmrTimeout) clearTimeout(tmrTimeout);
			tmrTimeout = null;

			//setup auto recovery
			if (tmrRecover) clearTimeout(tmrRecover);
			tmrRecover = setTimeout(doRecover, 300000); //recover in 5 minutes if for some reason the tokens are not refreshed

			app.refreshTokens(module);
		},

		//get devices
		doGetDevices = function (initial) {
			try {
				//we will quietly rescan devices about every one minute - we don't want to fill the logs up
				if (true) {
					log('Getting list of devices...');
				}
				request
					.get({
							url: 'https://my-digitallife.att.com/penguin/api/' + config.key + '/devices',
							jar: jar,
							headers: {
								'Referer': 'https://my-digitallife.att.com/dl/',
								'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36',
								'DNT': '1',
								'appKey': 'TI_3198CF46D58D3AFD_001',
								'authToken': config.authToken,
								'requestToken': config.requestToken
							}
						},
						function (err, response, body) {
							if (!err && response.statusCode == 200) {
								if (body) {
									try {
										var data = JSON.parse(body);
										if ((data) && (data.content) && (data.content.length)) {
											//cycle through each device
											for (d in data.content) {
												var dev = data.content[d];
												var device = {
													'id': dev.deviceGuid,
													'module': module,
													'type': dev.deviceType,
													'movable': dev.movable,
													'events': ''
												};
												for (prop in dev.events) {
													var event = dev.events[prop];
													device.event += (device.event ? ',' : '') + event.event;
												}
												for (prop in dev.attributes) {
													var attr = dev.attributes[prop];
													doSetDeviceAttribute(device, attr.label, attr.value);
												}
												var existing = false;
												var notify = false;
												//we only push updates to other modules if there are any changes made
												for (i in devices) {
													if (devices[i].id == device.id) {
														//found an existing device
														existing = true;
														if (JSON.stringify(devices[i]) != JSON.stringify(device)) {
															devices[i] = device;
															notify = true;
														}
														break;
													}
												}
												if (!existing) {
													notify = true;
													devices.push(device);
												}
												if (notify) {
													callback({
														name: 'discovery',
														module: module,
														data: {
															device: device,
															description: 'Discovered device "' + device.name + '" <' + device.id + '>'
														}
													});
												}
											}
											if (initial) {
												log('Successfully got device list');
											}
											return;
										}
									} catch (e) {
										//reinitialize after an error
										error('Error reading device list: ' + e);
										doRecover();
										return;
									}
								}
							}
							//reinitialize on error
							error('Error getting device list: ' + err);
							doRecover();
						});
			} catch (e) {}
		},

		//listen for events
		doListen = function () {
			log('Listening for events... token is ' + config.requestToken);
			var buffer = '';
			if (listener && listener.abort) {
				try {
					listener.abort();
				} catch (e) {}
			}
			try {
				listener = request
					.get({
						url: 'https://my-digitallife.att.com/messageRelay/pConnection?uuid=&app2="""&key=' + config.key,
						jar: jar,
						headers: {
							'Referer': 'https://my-digitallife.att.com/dl/',
							'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36',
							'DNT': '1',
							'appKey': 'TI_3198CF46D58D3AFD_001',
							'authToken': config.authToken,
							'requestToken': config.requestToken
						}
					})
					.on('data', function (str) {
						try {
							//log("RCVD: " + str);
							if (tmrTimeout) clearTimeout(tmrTimeout)
							tmrTimeout = setTimeout(function() {
								error("Haven't received anything in one minute, we must be disconnected...")
								doRecover();
							}, 60000); //if we get nothing more in the next 60 seconds, we dropped the ball (we should get something every 30s)
							buffer += str.replace(/\*|\n|\r/g, '');
							var p = buffer.indexOf('"""');
							if (p > 0) {
								var event = JSON.parse(buffer.substr(0, p));
								buffer = buffer.substr(p + 3);
								if (event.type == 'device') {
									doProcessDeviceEvent(event);
								} else {
									//console.log(event);
								}
							}
						} catch (e) {
							//reinitialize after an error
							error('Error reading listener data: ' + e);
							doRecover();
							return;
						}
					})
					.on('response', function (response) {
						if (response.statusCode == 200) {
							log('Connected and listening for events...');
							return;
						}
						//reinitialize on error
						error('Could not connect listener: ' + response.statusCode);
						doRecover();
					})
					.on('end', function () {
						//reinitialize on error
						log('Listener connection terminated, recovering...');
						doRecover();
					})
					.on('error', function (e) {
						//reinitialize on error
						error('An error occurred within the listener: ' + e);
						doRecover();
					});
			} catch (e) {
				error('Failed to setup listener: ' + e);
				doRecover();
			}
		},

		//process device events
		doProcessDeviceEvent = function (event) {
			try {
				for (i in devices) {
					if (devices[i].id == event.dev) {
						//found device
						var device = devices[i];
						var attribute = event.label;
						var value = event.value;
						var result = doSetDeviceAttribute(device, attribute, value);

						if (result) {
							callback({
								name: 'update',
								data: {
									device: device,
									module: module,
									event: event,
									attribute: attribute,
									oldValue: result.oldValue,
									newValue: result.newValue,
									value: value,
									description: 'Device "' + device.name + '" <' + device.id + '> (type: ' + device.type + ') changed its "' + attribute + '" value from "' + result.oldValue + '" to "' + result.newValue + '"'
								}
							});
						}
						return;
					}
				}
			} catch (e) {
				//reinitialize after an error
				error('Failed to process device event: ' + e);
				doRecover();
				return;
			}
		},

		doProcessCommand = function (deviceId, command, value) {
			//if we don't have write permissions, we can't do much
			if (!config.controllable) {
				lastCommand = null;
				return;
			}
			lastCommand = {
				deviceId: deviceId,
				command: command,
				value: value,
				retry: (lastCommand ? lastCommand.retry : 0) + 1
			}
			for (i in devices) {
				if (devices[i].id == deviceId) {
					//found device
					if ((devices[i].type == 'digital-life-system') && (command == 'mode')) {
						doSetAlarmState(value)
					} else {
						//todo control devices
						lastCommand = null;
					}
				}
			}
		},

		//set alarm state
		doSetAlarmState = function (state) {
			log('Setting alarm state to ' + state + '...');
			request
				.post({
						url: 'https://my-digitallife.att.com/penguin/api/' + config.key + '/alarm',
						jar: jar,
						headers: {
							'Referer': 'https://my-digitallife.att.com/dl/',
							'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36',
							'DNT': '1',
							'appKey': 'TI_3198CF46D58D3AFD_001',
							'authToken': config.authToken,
							'requestToken': config.requestToken
						},
						json: true,
						body: {
							bypass: '',
							status: state
						}
					},
					function (err, response, body) {
						try {
							if (!err && (response.statusCode == 200) && (body instanceof Object)) {
								lastCommand = null;
								log('Successfully set alarm state');
								return;
							}
						} catch(e) {
							error('Failed sending command, we need to recover and rerun the command');
						}
						doRecover();
					});
		},

		doSetDeviceAttribute = function (device, attribute, value) {

			switch (device.type) {
			case 'smoke-sensor':
				if (attribute == 'smoke') {
					value = (value == '0' ? 'clear' : 'detected');
				}
				break;
			case 'motion-sensor':
				if (attribute == 'motion') {
					value = (value == '0' ? 'inactive' : 'active');
				}
				break;
			case 'indoor-siren':
				if (attribute == 'alarm') {
					value = (value == '0' ? 'off' : 'siren');
				}
				break;
			}

			attribute = attribute
				.replace('contact-state', 'contact')
				.replace('battery-level', 'battery')
				.replace('signal-strength', 'rssi');

			var attr = (attribute != 'name' ? 'data-' : '') + attribute;
			//return true if the value changed
			if (device[attr] != value) {
				var oldValue = device[attr]
				device[attr] = value;
				return {
					attr: attr,
					oldValue: oldValue,
					newValue: value
				}
			}
			return false;
		},

		//log
		log = function (message) {
			callback({
				name: 'log',
				data: {
					message: message
				}
			});
		},

		//alert
		alert = function (message) {
			callback({
				name: 'log',
				data: {
					alert: message
				}
			});
		},

		//error
		error = function (message) {
			callback({
				name: 'log',
				data: {
					error: message
				}
			});
		}




	//public functions

	this.start = function (_app, _module, _config, _callback) {
		if (_app && _module && _config && _callback) {
			app = _app;
			module = _module;
			config = _config;
			callback = _callback;
			doInit();
			return true;
		}
		return false;
	};

	this.processCommand = function (deviceId, command, value) {
		log('Got command ' + command + ' with value ' + value);
		doProcessCommand(deviceId, command, value);
	}

    this.failed = function() {
        return !!failed;
    }

}();
