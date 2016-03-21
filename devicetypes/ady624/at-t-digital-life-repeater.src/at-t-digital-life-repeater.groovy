/**
 *  AT&T Digital Life Repeater
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
	definition (name: "AT&T Digital Life Repeater", namespace: "ady624", author: "Adrian Caramaliu", oauth: true) {
		capability "Battery"
		capability "Signal Strength"
        attribute "id", "string"
        attribute "module", "string"       
        attribute "type", "string"
        attribute "power-source", "enum", ["AC", "DC"]
	}

    simulator {
	}

	// UI tile definitions
	tiles(scale: 2) {
		standardTile("power-source", "device.power-source", width: 2, height: 2) {
            state "AC", label: 'AC', icon: "st.secondary.refresh", backgroundColor: "#79b821", canChangeIcon: true, canChangeBackground: true
            state "DC", label: 'DC', icon: "st.secondary.refresh", backgroundColor: "#ffa81e", canChangeIcon: true, canChangeBackground: true
        }

		standardTile("id", "device.id", decoration: "flat", width: 6, height: 1, ) {
            state "default", label: '${currentValue}', backgroundColor: "#808080", icon:"st.secondary.refresh"
        }

		multiAttributeTile(name:"multi", type:"generic", width:6, height:4) {
			tileAttribute("device.power-source", key: "PRIMARY_CONTROL") {
      			attributeState "AC", label:'AC POWER', icon:"st.Appliances.appliances17", backgroundColor:"#79b821"
      			attributeState "DC", label: 'ON BATTERY', icon:"st.Appliances.appliances17", backgroundColor:"#ffa81e"
    		}
    		tileAttribute("device.battery", key: "SECONDARY_CONTROL") {
      			attributeState "default", label: 'Battery ${currentValue}%', icon:"st.unknown.unknown", backgroundColor:"#ffa81e", unit:"%"
			}
		}

		main(["power-source"])
        details(['id', 'multi'])
	}
}

// parse events into attributes
def parse(String description) {
}
