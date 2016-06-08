import FactoryMaker from '../../core/FactoryMaker.js';
import Debug from '../../core/Debug.js';
import io from 'socket.io-client';

/**
 * @author Armand Zangue
 */

function WebSocketLogger () {

    let debug = Debug(this.context).getInstance();

    let instance,
        socket;

    let open = false;

    function setup () {
        socket = io.connect('http://localhost:9000');

        socket.on('connect', function () {
            debug.log('[WebSocketLogger] Socket connection established');
            console.log('[WebSocketLogger] Socket connection established');
            open = true;
        });
    }

    function log (data) {
        if (open)
            socket.emit('log', {data: data});
    }

    instance = {
        log: log
    };

    setup();
    return instance;
}

WebSocketLogger.__dashjs_factory_name = 'WebSocketLogger';
export default FactoryMaker.getSingletonFactory(WebSocketLogger);