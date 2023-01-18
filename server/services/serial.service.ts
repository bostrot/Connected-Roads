import ws from 'ws';
import { SerialPort } from 'serialport'
import { MeshNode, NodeList } from '../models/node.model';
import dotenv from 'dotenv'

dotenv.config();
var serialport: SerialPort;
var connected = false;

// Serial functions
function initSerial(wsServer: ws.Server) {
    let isOpening = false;
    /* Connect serial port */
    serialport = new SerialPort({
        path: process.env.SERIAL_PORT ?? "/dev/ttyUSB0",
        baudRate: parseInt(process.env.BAUD_RATE ?? "115200") ?? 115200,
        // flowControl RTS/CTS
        rtscts: true,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
    });

    serialport.on('error', (err) => {
        // console.log("Could not connect.");
        connectSerial();
    });
    // Reconnect on disconnect
    serialport.on('close', () => {
        console.log('Serial port closed');
        // Try reconnecting 
        connectSerial();
        // Send to socket
        wsServer.clients.forEach(client => {
            client.send('device:Disconnected');
        });
        connected = false;
        NodeList.clear();
    });

    // On open
    serialport.on('open', () => {
        console.log('Connected to serial port');
        wsServer.clients.forEach(client => {
            client.send('device:Connected');
        });
        connected = true;
    });

    /* Open serial */
    const connectSerial: any = () => {
        if (isOpening) {
            return;
        }
        var interval = setInterval(() => {
            if (serialport.isOpen) {
                isOpening = false;
                clearInterval(interval);
            } else {
                isOpening = true;
                serialport.open();
            }
        }, 1000);
    }
    connectSerial();

    serialport.on('data', function (data) {
        console.log('Data:', data.toString('utf8'));
        var dataStr = data.toString('utf8').trim();
        // Node added
        if (dataStr.indexOf('got heartbeat message') > -1) {
            try {
                // Set device status
                wsServer.clients.forEach(client => {
                    client.send('device:Connected');
                });
                // Get Node name
                var nodeName = dataStr.split('got heartbeat message: ')[1];

                // Remove other chars
                nodeName = nodeName.replace(/[^0-9a-z]/g, '');
                // e.g. a6b3987620c88052
                if (nodeName.length != 16) {
                    return;
                }
                let node = NodeList.getNode(nodeName);
                if (node) {
                    node.status = '🟢';
                    try {
                        clearTimeout(node.timer);
                    } catch (e) {
                        // Do nothing
                    }
                } else {
                    // Create new node
                    node = new MeshNode(
                        nodeName,
                        nodeName,
                        '🟢'
                    );
                }
                // Start timeout for node status
                node.timer = setTimeout(() => {
                    node!.status = '🔴';
                    // Send nodelist to client
                    wsServer.clients.forEach((client: any) => {
                        client.send(NodeList.toString());
                    });
                }, 10000);

                NodeList.addNode(node);
                // Send nodeID to the client
                wsServer.clients.forEach(client => {
                    client.send(NodeList.toString());
                });
            } catch (e) {
                console.log(e);
            }
        }
        // Press button for being a provisioner
        else if (dataStr.indexOf('Press Button') > -1) {
            wsServer.clients.forEach(client => {
                client.send('device:Press Button');
            });
        }
        // New device found
        else if (dataStr.indexOf('detected') > -1) {
            // Send nodeID to the client
            wsServer.clients.forEach(client => {
                client.send('device:Press Button');
            });
        }
        // Microphone data
        // TODO: change uart data format
        else if (RegExp(/^\s*\d*,\d+,\d+/).test(dataStr.replace(/[^0-9,]/g, ''))) {
            dataStr = dataStr.replace(/[^0-9,]/g, '');
            // 32-bit integer left channel
            var leftChannel = new Int32Array(1);
            // 32-bit integer right channel
            var rightChannel = new Int32Array(1);
            // 64-bit integer timestamp
            var timestamp = new BigInt64Array(1);

            // connect to tcp socket and send data
            var net = require('net');
            var client = new net.Socket();
            // localhost:1234
            client.connect(1234, '127.0.0.1', function () {
                console.log('Connected');
                client.write('' + leftChannel + rightChannel + timestamp);
            });
            wsServer.clients.forEach(client => {
                client.send('micdata:' + dataStr);
            });
        }
    });

    // function testNode(num: number) {
    //     // Get Node name
    //     var nodeName = 'Node 0x000'+num;
    //     // Remove non ascii numbers
    //     nodeName = nodeName.replace(/[^0-9]/g, '');
    //     var newNode: Node = {
    //         id: parseInt(nodeName),
    //         name: nodeName,
    //         status: '🟢'
    //     }
    //     nodeList.push(newNode);
    //     // Send nodelist to client
    //     wsServer.clients.forEach(client => {
    //         client.send(JSON.stringify(nodeList));
    //     });
    // }
    // setTimeout(() => testNode(1), 3000);
    // setTimeout(() => testNode(2), 4000);
    // setTimeout(() => testNode(3), 5000);
}

export {
    initSerial,
    serialport,
    connected
};