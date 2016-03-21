/**
 *  AT&T Digital Life Smoke Sensor
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
	definition (name: "AT&T Digital Life Smoke Sensor", namespace: "ady624", author: "Adrian Caramaliu", oauth: true) {
    	capability "Sensor"
		capability "Smoke Detector"
        capability "Battery"
		capability "Signal Strength"
        attribute "id", "string"
        attribute "type", "string"
        attribute "module", "string"       
        attribute "alarm-verified", "string"
	}

    simulator {
	}

	// UI tile definitions
	tiles(scale: 2) {
		standardTile("smoke", "device.smoke", width: 2, height: 2) {
            state "clear", label: 'CLEAR', icon: "st.Home.home29", backgroundColor: "#79b821", canChangeIcon: true, canChangeBackground: true
            state "detected", label: 'DETECTED', icon: "st.Home.home29", backgroundColor: "#ff381e", canChangeIcon: true, canChangeBackground: true
        }

		standardTile("id", "device.id", decoration: "flat", width: 6, height: 1, ) {
            state "default", label: '${currentValue}', backgroundColor: "#808080", icon:"st.Home.home29"
        }
        

		multiAttributeTile(name:"multi", type:"generic", width:6, height:4) {
			tileAttribute("device.smoke", key: "PRIMARY_CONTROL") {
      			attributeState "inactive", label:'CLEAR', icon:"st.Outdoor.outdoor10", backgroundColor:"#79b821"
      			attributeState "active", label: 'DETECTED', icon:"st.Outdoor.outdoor10", backgroundColor:"#ff381e"
    		}
    		tileAttribute("device.battery", key: "SECONDARY_CONTROL") {
      			attributeState "default", label: 'Battery ${currentValue}%', icon:"st.unknown.unknown", backgroundColor:"#ffa81e", unit:"%"
			}
		}

		main(["smoke"])
        details(['id', 'multi'])
	}
}

// parse events into attributes
def parse(String description) {
}