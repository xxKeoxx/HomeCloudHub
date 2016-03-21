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
//		myQAppId = 'JVM/G9Nwih5BwKgNCjLxiFUQxQijAebyyg8QUHr7JOrP+tuPb8iHfRHKwTmDzHOu',
		myQAppId = 'Vj8pQggXLhLy0WHahglCD4N1nAkkXQtGYpq2HrHD7H1nvmbT55KqtN6RSF4ILB/i',
		jar = null,
		devices = [],
        //recover timer for re-sync - if initial recover request failed
        tmrRecover = null,
		//myq state polling timer
		tmrRefresh = null,
		//listener socket (client) for events from digitallife
		listener = null,
		key = null,
		authToken = null,
		requestToken = null,

		//initialization of cookies
		doInit = function () {
			log('Initializing...');
			failed = false;

			//disable the automatic recovery
			if (tmrRecover) clearTimeout(tmrRecover);
			tmrRecover = null;


			if (config.securityToken) {
				//we're good to go
				doGetDevices();
				setTimeout(doRecover, 14400000); //refresh security tokens every 4 hours
			} else {
				setTimeout(doRecover, 300000); //something did not work right, recover 5 minutes later
			}
		},

		//recovering procedures
		doRecover = function () {
			if (failed) {
				return;
			}

			alert('Refreshing security tokens...');
			failed = true;

			//abort refreshes
            if (tmrRefresh) clearTimeout(tmrRefresh);
            tmrRefresh = null;

			//setup automatic recovery
            if (tmrRecover) clearTimeout(tmrRecover);
            tmrRecover = setTimeout(doRecover, 300000); //recover in 5 minutes if for some reason the tokens are not refreshed

			app.refreshTokens(module);
		},

		//get devices
		doGetDevices = function (initial) {
			try {
				//we will quietly rescan devices about every one minute - we don't want to fill the logs up
				if (initial) {
					log('Getting list of devices...');
				}
				request
					.get({
							url: 'https://myqexternal.myqdevice.com/api/UserDeviceDetails?appId=' + myQAppId + '&securityToken=' + config.securityToken,
							headers: {
								'Referer': 'https://my-digitallife.att.com/dl/',
								'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36'
							}
						},
						function (err, response, body) {
							if (!err && response.statusCode == 200) {
								if (body) {
									try {
										var data = JSON.parse(body);
										if ((data) && (data.Devices) && (data.Devices.length)) {
											//cycle through each device
											//log('Got ' + data.Devices.length + ' device(s)');
											for (d in data.Devices) {
												var dev = data.Devices[d];
												var device = {
													'id': dev.MyQDeviceId,
													'name': dev.TypeName.replace(' Opener', ''),
													'module': module,
													'type': dev.MyQDeviceTypeName,
													'serial': dev.SerialNumber
												};
												for (prop in dev.Attributes) {
													var attr = dev.Attributes[prop];
													doSetDeviceAttribute(device, attr.Name, attr.Value);
												}
												var existing = false;
												var notify = false;
												//we only push updates to other modules if there are any changes made
												for (i in devices) {
													if (devices[i].id == device.id) {
														//found an existing device
														existing = true;
														if (JSON.stringify(devices[i]) != JSON.stringify(device)) {
															var attribute = '';
															var oldValue = '';
															var newValue = '';
															if (devices[i]['data-door'] != device['data-door']) {
																attribute = 'data-door';
																oldValue = devices[i]['data-door'];
																newValue = device['data-door'];
																notify = true;
															}
															//update the device
															devices[i] = device;
															//notify change
															if (notify) {
																callback({
										                    		name: 'update',
										                            data: {
										                                device: device,
									    	                            module: module,
										                                attribute: attribute,
										                                oldValue: oldValue,
										                                newValue: newValue,
									                                	value: newValue,
									                                	description: 'Device "' + device.name + '" <' + device.id + '> changed its "' + attribute + '" value from "' + oldValue + '" to "' + newValue + '"'
                            	    								}
									                            });
															}
														}
														break;
													}
												}
												if (!existing) {
													devices.push(device);
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


											//custom delays depending on status
											var delay;
											switch (device['data-door']) {
												case 'open':
													delay = 5;
													break;
												case 'opening':
												case 'closing':
													delay = 1;
													break;
												default:
													delay = 10;
											}

											tmrRefresh = setTimeout(doGetDevices, delay * 1000); //every ? seconds


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
									description: 'Device "' + device.name + '" <' + device.id + '> changed its "' + attribute + '" value from "' + result.oldValue + '" to "' + result.newValue + '"'
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
			var state = (command == 'open' ? 1 : (command == 'close' ? 0 : null));
			if (state != null) {
				doSetGarageDoorState(deviceId, state);
			}
		},


		//API call to open/close garage door
		doSetGarageDoorState = function(deviceId, state) {
			request.put({
						url: 'https://myqexternal.myqdevice.com/api/v4/deviceattribute/putdeviceattribute?appId=' + myQAppId + '&SecurityToken=' + config.securityToken,
						json: {
							'ApplicationId': myQAppId,
							'SecurityToken': config.securityToken,
							'MyQDeviceId': deviceId,
							'AttributeName': 'desireddoorstate',
							'AttributeValue': state
						}
					},
					function (err, response, body) {
						if (!err && response.statusCode == 200) {
							try {
								var result = JSON.parse(body);
								if (result && (result.ReturnCode == 0)) {
									return true;
								}
							} catch(e) {
							}
						}
					});
			return false;
		},

		doSetDeviceAttribute = function (device, attribute, value) {

			switch (device.type) {
			case 'GarageDoorOpener':
				if (attribute == 'doorstate') {
					switch (value) {
						case '1':
						case '9':
							value = 'open';
							break;
						case '2':
							value = 'closed';
							break;
						case '3':
							value = 'stopped';
							break;
						case '4':
							value = 'opening';
							break;
						case '5':
							value = 'closing';
							break;
						default:
							value = 'unknown';
					}
				}
				break;
			}

			attribute = attribute
				.replace('doorstate', 'door')
				.replace('desc', 'description');

			var attr = 'data-' + attribute;
			//return true if the value changed
			if (device[attr] != value) {
				var oldValue = device[attr]
				device[attr] = value;
				if (attr == 'data-door') {
					device['data-contact'] = value;
				}
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
