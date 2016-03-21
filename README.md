# Home Cloud Hub

HomeCloudHub is a lightweight NodeJS server you can run on your home network that provides real time integration of your SmartThings Hub with the AT&T Digital Life alarm system and almost real time integration with MyQ. This is done via a local LAN connection between your hub and a linux machine running your HomeCloudHub server.

# Community

If you're having any issues, feel free to open issues and PRs here.

# Installation

**Note:** There are two parts to the installation:
 * Install the SmartApp and its associated Device Handlers
 * Install the HomeCloudHub NodeJS server

# Installing the SmartApp and its associated Device Handlers

Go to your SmartThings [IDE](https://graph.api.smartthings.com/login/auth) and go to your [SmartApps](https://graph.api.smartthings.com/ide/apps). Click on Settings and add a new repository with owner **ady624**, name **HomeCloudHub** and branch **master**. Click Ok.

Click on the Update from Repo button and select the HomeCloudHub repo. Select the HomeCloudHub application and install it. Do the same for the Device Handlers, selecting whichever devices you plan on using. If your device is not on the list, let me know so I can add it.

# Installing the HomeCloudHub NodeJS server

Install NodeJS. You can follow these [instructions](https://nodejs.org/en/download/package-manager/) to install Node JS 4.x or 5.x. I have developed and tested this using NodeJs v5.7.1.

On your linux machine, create a folder /var/node (if it doesn't exist yet). Download the homecloudhub.local folder onto your linux machine. I use this on a Raspberry Pi running Raspbian. Install necessary modules:

    sudo npm install -g request
    sudo npm install -g colors
    sudo npm install -g node-ssdp

**NOTE**: If your npm modules are installed in a different location than **/usr/lib/node_modules**, and you plan on running this as a system service, then please change each of the javascript files' first line to reflect the correct path.

  Change
  
    module.paths.push('/usr/lib/node_modules');

  to
  
    module.paths.push('<your node modules path goes here>');
  
Create the file /usr/bin/homecloudhub with this content:

    #!/usr/bin/env node
    //
    // This executable sets up the environment and runs the HomeCloudHub.
    //
    
    'use strict';
    process.title = 'homecloudhub';
    
    // Run HomeCloudHub
    require('/var/node/homecloudhub.local/homecloudhub.js');

Give it execute rights:

    sudo chmod 755 /usr/bin/homecloudhub

Run the server:

    homecloudhub

With homecloudhub running, go to your SmartThings app and go to Marketplace. Scroll down to My Apps and click on the HomeCloudHub app. Select the local server method and it should automatically detect your server. If it doesn't, you can enter the IP manually, but it should detect it. Click next and enter your AT&T Digital Life credentials. These will be stored into the SmartApp settings collection, if security is a concern. Click Done to finish installing the application. At this point, within a few seconds, your Things should be automatically populated based on the Device Handlers you elected to install.

# Installing homecloudhub as a system service

Create a new system username to run homecloudhub under:

    sudo useradd --system homecloudhub

**VERY IMPORTANT** Make sure the new user has read/write access to configuration file!

        sudo chown homecloudhub:homecloudhub /var/node/homecloudhub.local/config/homecloudhub.json 

Create the /etc/default/homecloudhub file with this content:

    # Defaults / Configuration options for homecloudhub
    
    # If you uncomment the following line, homecloudhub will log more.
    # You can display this via systemd's journalctl: journalctl -f -u homecloudhub
    # DEBUG=*

Create the /etc/systemd/system/homecloudhub file with this content:

    [Unit]
    Description=Node.js Local Home Cloud Hub Server
    After=syslog.target
    
    [Service]
    Type=simple
    User=homecloudhub
    EnvironmentFile=/etc/default/homecloudhub
    ExecStart=/usr/bin/node /var/node/homecloudhub.local/homecloudhub.js
    Restart=on-failure
    RestartSec=10
    KillMode=process
    
    [Install]
    WantedBy=multi-user.target

Setup the systemctl service by running:

    sudo systemctl daemon-reload
    sudo systemctl enable homecloudhub
    sudo systemctl start homecloudhub

Check the service status:

    sudo systemctl status homecloudhub

Enjoy :)

