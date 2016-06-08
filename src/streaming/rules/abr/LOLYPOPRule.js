import SwitchRequest from '../SwitchRequest.js';
import FactoryMaker from '../../../core/FactoryMaker.js';
import ThroughputPredictor from '../../throughput/ThroughputPredictor.js';
//import VideoModel from '../../models/VideoModel.js';
import PlaybackController from '../../controllers/PlaybackController.js';
import DashAdapter from '../../../dash/DashAdapter.js';
//import VirtualBuffer from '../../VirtualBuffer.js';
import EventBus from '../../../core/EventBus.js';
import Events from '../../../core/events/Events.js';
//import MediaPlayerModel from '../../models/MediaPlayerModel.js';

/**
 * Implementation of LOLYPOP - Adaptation algorithm for Low-Delay live streaming
 *
 * @see http://arxiv.org/pdf/1603.00859v2.pdf#chapter.4
 * @author Armand Zangue
 */
function LOLYPOPRule(/*config*/) {

    let context = this.context;
    //let videoModel = VideoModel(context).getInstance();
    let playbackController = PlaybackController(context).getInstance();
    //let virtualBuffer = VirtualBuffer(context).getInstance();
    //let dashMetrics = config.dashMetrics;
    //let metricsModel = config.metricsModel;
    let eventBus = EventBus(context).getInstance();
    //let mediaPlayerModel = MediaPlayerModel(context).getInstance();

    let fragmentCount = {};
    let qualitySwitchCount = {};
    let lastLoadedQualityIdx = {};

    let instance,
        adapter,
        throughputPredictor;

    function setup() {
        adapter = DashAdapter(context).getInstance();
        throughputPredictor = ThroughputPredictor(context).getInstance();

        fragmentCount.audio = 0;
        fragmentCount.video = 0;

        qualitySwitchCount.audio = 0;
        qualitySwitchCount.video = 0;

        lastLoadedQualityIdx.audio = NaN;
        lastLoadedQualityIdx.video = NaN;

        eventBus.on(Events.LOADING_COMPLETED, onLoadingCompleted, instance);
    }

    function sortQualityAsc (qualities) {
        let asc;

        asc = qualities.sort(function (q1, q2) {
            return q1.bitrate - q2.bitrate;
        });

        return asc;
    }

    function onLoadingCompleted (e) {
        let request = e.request;
        let prevQualityIdx = lastLoadedQualityIdx[request.mediaType];

        if (request.mediaType === 'fragmentedText')
            return;
        //console.log('[LOLYPOP] [onLoadingCompleted] [' + request.mediaType + '] Vorher: fragmentCount: ' + fragmentCount[request.mediaType]);
        //console.log('[LOLYPOP] [onLoadingCompleted] [' + request.mediaType + '] Vorher: qualitySwitchCount: ' + qualitySwitchCount[request.mediaType]);
        fragmentCount[request.mediaType] += 1;
        lastLoadedQualityIdx[request.mediaType] = request.quality;

        if (isNaN(prevQualityIdx) && prevQualityIdx !== request.quality)
            qualitySwitchCount[request.mediaType] += 1;

        ////console.log(request);

        //console.log('[LOLYPOP] [onLoadingCompleted] [' + request.mediaType + '] fragmentCount: ' + fragmentCount[request.mediaType]);
        //console.log('[LOLYPOP] [onLoadingCompleted] [' + request.mediaType + '] qualitySwitchCount: ' + qualitySwitchCount[request.mediaType]);
    }

    function hasSingleRepresentation (mediaInfo) {
        return mediaInfo.representationCount === 1;
    }

    /**
     * calculate the download success probability for each representation
     *
     * @param  {Object} prediction Throughput prediction
     * @param  {Array} qualities   List of bitrates/qualities
     * @return {Object}
     */
    function calcDownloadSuccessProbabilities (prediction, qualities) {
        let probalities = {};
        let estimatedThroughput = prediction.throughput; // in kbps
        let errors = prediction.errors;
        let i, a, b, p;

        // Compute the relative error between estimated throughput and representations throughput
        for (i = 0; i < qualities.length; i++) {
            let error = ((estimatedThroughput * 1000) - qualities[i].bitrate) / qualities[i].bitrate;

            a = errors.countLessOrEqual(error);
            b = errors.count();
            p = a / b;

            probalities[qualities[i].bitrate] = p;
        }

        return probalities;
    }

    function execute(rulesContext, callback) {
        let mediaInfo = rulesContext.getMediaInfo();
        //let trackInfo = rulesContext.getTrackInfo();
        let streamProcessor = rulesContext.getStreamProcessor();
        let abrController = streamProcessor.getABRController();
        let currentIndex =  streamProcessor.getIndexHandler().getCurrentIndex();
        let nextIndex = currentIndex + 1; // next to be downloaded
        let currentTime = playbackController.getTime(); // refactor name: currentPlayHeadTime
        let qualities = sortQualityAsc(abrController.getBitrateList(mediaInfo));
        let upperBoundSkippedSegments = abrController.getSkippedSegmentFraction();
        let upperBoundQualityTransitions = abrController.getQualityTransitionFraction() / 100;
        let switchRequest = SwitchRequest(context).create(SwitchRequest.NO_CHANGE, SwitchRequest.WEAK);
        //let currentQuality = abrController.getQualityFor(mediaInfo.type, mediaInfo.streamInfo);
        let fragmentStartTime = adapter.getIndexHandlerTime(rulesContext.getStreamProcessor()); // next fragment start time
        let lowestQuality = qualities[0];
        let maxQuality; // TODO make this a bitrate info (maybe to hold lowest quality at init)
        let lastLoadedQuality; // quality of last succesful download
        let newQuality;
        let prediction;
        let dsProbabilities;
        //let nextSegment;
        let playbackDeadline;


        /*
         * Optimization: we dont need to go through the whole ABR logic for single representation streams
         */
        if (hasSingleRepresentation(mediaInfo)) {
            console.log('%c[LOLYPOP ABR] [' + mediaInfo.type + ']  Single representation stream. Nothing  to do: ' + (lowestQuality.bitrate / 1000) + ' kbps'  ,'background: blue; color: white');
            switchRequest = SwitchRequest(context).create(lowestQuality.qualityIndex, SwitchRequest.STRONG);
            callback(switchRequest);
            return;
        }

        // TODO - Maybe calculate the fragmentStartTime as period.start + (index * duration)
        // instead of relaying on the index handler

        //console.log(qualities);
        //console.log('lowestQuality');
        //console.log(lowestQuality);
        // IMPORTANT: Index handler time is always set to the end time of the previous segment _request_ -> start time of next segment
        // So use this time to calculate the playback deadline instead of relying on segment index!
        //adapter.getIndexHandlerTime(rulesContext.getStreamProcessor()

        //console.log('BolaDebug ' + mediaInfo.type + '\nBolaDebug ' + mediaInfo.type + ' BolaRule for state=- fragmentStart=' + adapter.getIndexHandlerTime(rulesContext.getStreamProcessor()).toFixed(3));
        //console.log('LOLYPOP - Current Time [Video Model]: ' + videoModel.getElement().currentTime);
        //console.log('LOLYPOP [' + mediaInfo.type + '] [' + Date.now() + '] - Current Index: ' + currentIndex);
        //console.log('LOLYPOP [' + mediaInfo.type + '] [' + Date.now() + '] - Next Index: ' + nextIndex);
        //console.log('LOLYPOP - Time to Load Delay: ' + streamProcessor.getScheduleController().setTimeToLoadDelay());

        if (currentIndex === -1 || fragmentCount[mediaInfo.type] === 0) {
            //console.log('%c[LOLYPOP] [INFO] Current index = -1 do nothing.', 'background: #222; color: #bada55');
            // We start with the lowest quality
            switchRequest = SwitchRequest(context).create(lowestQuality.qualityIndex, SwitchRequest.STRONG);
            console.log('%c[LOLYPOP] SwitchRequest to quality: ' + lowestQuality.bitrate / 1000 + ' kbps - Reason : Just started', 'background: #222; color: #bada55');
            callback(switchRequest);
            return;
        }

        lastLoadedQuality = qualities[lastLoadedQualityIdx[mediaInfo.type]];

        // TODO - remove live delay because we are using video element current time and not wall clock current time
        playbackDeadline = fragmentStartTime - currentTime;
        //playbackDeadline = (fragmentStartTime + mediaPlayerModel.getLiveDelay()) - currentTime;

        console.log('LOLYPOP [' + mediaInfo.type + '] - Playback deadline of next segment [' + nextIndex + ']: ' + playbackDeadline);

        prediction = throughputPredictor.predictAvailableThroughput(playbackDeadline);
        //console.log('Got Prediction');
        //console.log(prediction);
        console.log('%c[LOLYPOP ABR] [' + mediaInfo.type + ']  Prediction - throughput : ' + prediction.throughput ,'background: blue; color: white');

        // No estimation available
        if (prediction.throughput === -1) {
            //console.log('#######################Throughput = -1');
            // select lowest quality
            newQuality = lowestQuality;

            console.log('%c[LOLYPOP] [' + mediaInfo.type + '] SwitchRequest to quality: ' + newQuality.bitrate / 1000 + ' kbps - Reason : No estimation available', 'background: #222; color: #bada55');

            switchRequest = SwitchRequest(context).create(newQuality.qualityIndex, SwitchRequest.STRONG);

            callback(switchRequest);

            return;
        }

        // Decide what quality to take next
        dsProbabilities = calcDownloadSuccessProbabilities(prediction, qualities);

        for (let i = 0; i < qualities.length; i++) {
            //console.log(qualities[i]);
            let p = dsProbabilities[qualities[i].bitrate];

            console.log('[LOLYPOP] [Decide] quality: ' + qualities[i].bitrate + ' 1 - dsp: ' + (1 - p) + ' upperBoundSkippedSegments: ' + upperBoundSkippedSegments);
            if ((1 - p) <= upperBoundSkippedSegments) {
                maxQuality = qualities[i];
            } else {
                maxQuality = lowestQuality; // lowest
            }
        }

        //console.log('%c[LOLYPOP] [INFO] Max quality satisfying upper bound on skipped segments: ' + maxQuality.bitrate / 1000, 'background: #222; color: #bada55');

        // if no change
        if (maxQuality.bitrate === lastLoadedQuality.bitrate) {
            //console.log('%c[LOLYPOP] [INFO] [' + mediaInfo.type + '] No change: sticking with quality : ' + maxQuality.bitrate / 1000 + ' kbps', 'background: #222; color: #bada55');
            switchRequest = SwitchRequest(context).create(SwitchRequest.NO_CHANGE, SwitchRequest.STRONG);
            callback(switchRequest);
            return;
        }

        //console.log('[LOLYPOP] [INFO] New quality: ' + maxQuality.bitrate / 1000 + ' kbps');

        let omega = qualitySwitchCount[mediaInfo.type] / fragmentCount[mediaInfo.type];
        //console.log('[LOLYPOP] [INFO] [' + mediaInfo.type + '] fragmentCount: ' + fragmentCount[mediaInfo.type]);
        //console.log('[LOLYPOP] [INFO] [' + mediaInfo.type + '] qualitySwitchCount: ' + qualitySwitchCount[mediaInfo.type]);
        //console.log('[LOLYPOP] [INFO] [' + mediaInfo.type + '] omega: ' + omega);
        let reason;

        // if higher than last loaded quality
        if (maxQuality.bitrate > lastLoadedQuality.bitrate && omega <= upperBoundQualityTransitions) { // Transition to higher representation is possible
            newQuality = maxQuality;
            reason = 'new quality satisfies upper bound on number of quality transitions';
        } else { // Transition to higher representation not possible
            newQuality = Math.min(maxQuality.bitrate, lastLoadedQuality.bitrate);
            reason = 'Transition available but not possible: new quality do not satisfies upper bound on number of quality transitions';
        }

        switchRequest = SwitchRequest(context).create(newQuality.qualityIndex, SwitchRequest.STRONG);
        //console.log(newQuality);
        //console.log('%c[LOLYPOP] SwitchRequest to quality: ' + newQuality.bitrate / 1000 + ' kbps - Reason : ' + reason, 'background: #222; color: #bada55');
        callback(switchRequest);

    }

    function reset() {
        eventBus.off(Events.LOADING_COMPLETED, onLoadingCompleted, instance);
        setup();
    }

    instance = {
        execute: execute,
        reset: reset
    };

    setup();

    return instance;
}

LOLYPOPRule.__dashjs_factory_name = 'LOLYPOPRule';
export default FactoryMaker.getClassFactory(LOLYPOPRule);