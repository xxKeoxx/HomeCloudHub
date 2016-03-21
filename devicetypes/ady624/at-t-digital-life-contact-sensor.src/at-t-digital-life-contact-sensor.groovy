/**
 *  AT&T Digital Life Contact Sensor
 *
 *  Copyright 2016 Adrian Caramaliu
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 *
 */
metadata {
	definition (name: "AT&T Digital Life Contact Sensor", namespace: "ady624", author: "Adrian Caramaliu", oauth: true) {
    	capability "Sensor"
		capability "Contact Sensor"
        capability "Battery"
        capability "Refresh"
        attribute "id", "string"
        attribute "module", "string"       
        attribute "type", "string"
        attribute "arm-state", "string"
	}

    simulator {
	}

	// UI tile definitions
	tiles(scale: 2) {
		standardTile("contact", "device.contact", width: 2, height: 2) {
            state "open", label: '${name}', icon: "st.contact.contact.open", backgroundColor: "#ffa81e", canChangeIcon: true, canChangeBackground: true
            state "closed", label: '${name}', icon: "st.contact.contact.closed", backgroundColor: "#79b821", canChangeIcon: true, canChangeBackground: true
        }

		multiAttributeTile(name:"multi", type:"generic", width:6, height:4) {
			tileAttribute("device.contact", key: "PRIMARY_CONTROL") {
      			attributeState "open", label: '${name}', icon:"st.contact.contact.open", backgroundColor:"#ffa81e"
      			attributeState "closed", label:'${name}', icon:"st.contact.contact.closed", backgroundColor:"#79b821"
    		}
    		tileAttribute("device.battery", key: "SECONDARY_CONTROL") {
      			attributeState "default", label: 'Battery ${currentValue}%', icon:"st.unknown.unknown", backgroundColor:"#ffa81e", unit:"%"
			}
		}

		standardTile("id", "device.id", decoration: "flat", width: 6, height: 1, ) {
            state "default", label: '${currentValue}', backgroundColor: "#808080", icon:"st.contact.contact.open"
        }
        
        valueTile("battery", "device.battery", width: 1, height: 1) {
            state "default", label:'${currentValue}% battery', unit:""
        }

        main(["contact"])
        details(["id","multi"])
	}
}

// parse events into attributes
def parse(String description) {
}

def on() {
	log.trace('on() ' + device.dump() + ' - ' + device.name + ' - ' + device.label)
//    log.debug(parent.('proxyCommand'));
    parent.proxyCommand(device, 'switch', 'on')
}

def off() {
    log.debug(parent.proxyCommand(device, 'switch', 'off'))
}