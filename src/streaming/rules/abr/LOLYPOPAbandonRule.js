import SwitchRequest from '../SwitchRequest.js';
import FactoryMaker from '../../../core/FactoryMaker.js';
//import Debug from '../../../core/Debug.js';
import VideoModel from '../../models/VideoModel.js';
//import FragmentModel from '../../models/FragmentModel.js';
//import MediaPlayerModel from '../../models/MediaPlayerModel.js';
import PlaybackController from '../../controllers/PlaybackController.js';
import EventBus from '../../../core/EventBus.js';
import Events from '../../../core/events/Events.js';
//import DataChunk from '../../vo/DataChunk.js';
//import MetricsModel from '../../models/MetricsModel.js';
//import DashMetrics from '../../../dash/DashMetrics.js';
import WebSocketLogger from '../../utils/WebSocketLogger.js';
//import BoxParser from '../../utils/BoxParser.js';

//const ABANDON_MILLISECONDS = 30;

function LOLYPOPAbandonRule(/*config*/) {

    let context = this.context;
    //let log = Debug(context).getInstance().log;
    let videoModel = VideoModel(context).getInstance();
    //let mediaPlayerModel = MediaPlayerModel(context).getInstance();
    let wslog = WebSocketLogger(context).getInstance().log;
    //let adapter = context.adapter;
    let eventBus = EventBus(context).getInstance();
    //let metricsModel = MetricsModel(context).getInstance();
    //let dashMetrics = DashMetrics(context).getInstance();
    //let boxParser = BoxParser(context).getInstance();

    let instance;
    let lastResponse = {};
    let playbackController;
    let currentRequest = {};
    //let lastRequest = null;
    let skip = {};

    function setup() {
        playbackController = PlaybackController(context).getInstance();
        eventBus.on(Events.FRAGMENT_LOADING_COMPLETED, onFragmentLoadingCompleted, instance);
    }

    // function shouldAbandon(currentTime, playbackTime) {
    //     let deadline = playbackTime - currentTime;

    //     deadline *= 1000; // milliseconds

    //     if (deadline <= ABANDON_MILLISECONDS) {
    //         console.log('%c[LOLYPOPABANDON] Should abondon current request','background: #222; color: #bada55');
    //         return true;
    //     }

    //     //return deadline < ABANDON_MILLISECONDS;
    //     //return deadline <= 0;
    //     //if (skip >= 5) { return true;}
    //     return false;
    // }

    function abandon (request) {
        if (skip[request.mediaType] > 0 && ((skip[request.mediaType] % 5) === 0)) {
            skip[request.mediaType] = 0;
            currentRequest[request.mediaType] = undefined;
            return true;
        }

        return false;
    }

    function onFragmentLoadingCompleted (e) {
        lastResponse[e.request.mediaType] = e.response;
        // let parsed = boxParser.parse(e.response);
        // console.log('Parsed segment');
        // console.log(parsed);
    }

    function execute(rulesContext, callback) {
        let request = rulesContext.getCurrentValue().request;
        let streamProcessor = rulesContext.getStreamProcessor();
        //let indexHandler = streamProcessor.getIndexHandler();
        let fragmentModel = streamProcessor.getFragmentModel();
        let switchRequest = SwitchRequest(context).create(SwitchRequest.NO_CHANGE, SwitchRequest.WEAK);
        let currentTime;
        let playbackTime;
        //let deadline;
        //let abortedRequests;

        if (isNaN(request.index)) {
            callback(switchRequest);
            return;
        }

        if (!currentRequest[request.mediaType]) {
            currentRequest[request.mediaType] = request;
            skip[request.mediaType] = 0;
        } else if ((currentRequest[request.mediaType].index !== request.index) &&
                    (currentRequest[request.mediaType].mediaType) === request.mediaType) {
            currentRequest[request.mediaType] = request;
            skip[request.mediaType] = skip[request.mediaType] + 1;
        }

        console.log('[LOLYPOPAbandonRule][' + rulesContext.getMediaInfo().type + '] presentation time: ' + request.startTime + ' current video time: ' + videoModel.getElement().currentTime);
        currentTime = videoModel.getElement().currentTime;
        playbackTime = request.startTime;

        //if (shouldAbandon(currentTime, playbackTime)) {
        if (abandon(request)) {
            if (fragmentModel.abortRequest(request)) {
                console.log('%c[LOLYPOPABANDON] [' + Date.now() + '] [' + request.mediaType + '] skipping segment index: ' + request.index + ' startTime: ' + request.startTime, 'background: #222; color: #bada55');
                streamProcessor.getScheduleController().skipNextSegment(request);
                console.log('Skipped segment');
                wslog({id: 5, request: request});
            }
        }

        callback(switchRequest);
    }

    function reset() {
        eventBus.off(Events.FRAGMENT_LOADING_COMPLETED, onFragmentLoadingCompleted, instance);
    }

    instance = {
        execute: execute,
        reset: reset
    };

    setup();
    return instance;
}

LOLYPOPAbandonRule.__dashjs_factory_name = 'LOLYPOPAbandonRule';
export default FactoryMaker.getClassFactory(LOLYPOPAbandonRule);