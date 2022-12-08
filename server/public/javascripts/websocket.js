// Create WebSocket connection.
var wsUrl = 'ws://localhost:8080';

var socket;
var connected = false;
var connectWS = function () {
    var interval = setInterval(() => {
        console.log('Connecting...');
        if (connected) {
            console.log('Connected.');
            clearInterval(interval);
        } else {
            // Create WebSocket connection.
            socket = new WebSocket(wsUrl);
            socketListener();
        }
    }, 1000);
}
connectWS();

var rmNode = function (node) {
    console.log('Remove node: ', node);
    socket.send('rmNode:' + node);
}

var log = function(msg) {
    // Append log to output
    if (msg.length > 2) {
        var msgElement = document.createElement('p');
        msgElement.id = msg.split(':')[0];
        msgElement.innerHTML = msg;
        document.getElementById('output').appendChild(msgElement);
        // Scroll to bottom
        document.getElementById('output').scrollTop = document.getElementById('output').scrollHeight;
    }
}

var socketListener = function () {
    // Connection opened
    socket.addEventListener('open', (event) => {
        log('Connection opened');
        connected = true;
        socket.send('INIT');
        document.getElementById('serverconnection').innerText = 'Server: Connected';
    });

    // On connection close
    socket.addEventListener('close', (event) => {
        log('Connection closed');
        connected = false;
        socket = null;
        // Try to reconnect
        connectWS();
    });

    // Listen for messages
    socket.addEventListener('message', (event) => {
        var msg = event.data;
        // Device status
        if (msg.startsWith('device:')) {
            var deviceStatus = msg.split(':')[1];
            log('Device status changed: ' + deviceStatus);
            document.getElementById('deviceconnection').innerText = 'Device: ' + deviceStatus;
        }
        // Node status
        if (msg.startsWith('node:')) {
            var nodeStatus = msg.split(':')[1];
            log('Node status changed: ' + nodeStatus);
        }
        // Received node list parse from json string
        try {
            var nodes = JSON.parse(msg);
            // Clear table
            document.getElementById('nodes').innerHTML = '';
            // Parse json string
            for (var i in nodes) {
                var node = nodes[i];
                // Add node to list
                const nodeName = node.name; // Node_1
                log('New Node added: ' + nodeName);
                const nodeStatus = node.status;
                var buttonElement = document.createElement('button');
                buttonElement.innerText = 'Remove';
                // Add script
                buttonElement.setAttribute('onclick', 'rmNode("' + nodeName + '")');
                // Create table row
                var rowElement = document.createElement('tr');
                rowElement.id = nodeName;
                rowElement.innerHTML = `
                    <td>${nodeName}</td>
                    <td>${nodeStatus}</td>
                    <td>${buttonElement.outerHTML}</td>
                `
                if (document.getElementById(nodeName) == null) {
                    // Not in the table yet
                    document.getElementById('nodes').appendChild(rowElement);
                } else {
                    // Already in the table so remove first
                    document.getElementById(nodeName).remove();
                    document.getElementById('nodes').appendChild(rowElement);
                }
            }
        }
        catch (e) {
            // Do nothing
        }
    });
}