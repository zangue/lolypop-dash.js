/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2016, Technische Universität Berlin.
 * All rights reserved.
 *
 * @author Armand Zangue <zangue@tkn.tu-berlin.de>
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */

import SwitchRequest from '../SwitchRequest';
import FactoryMaker from '../../../core/FactoryMaker';
import ThroughputPredictor from '../../throughput/ThroughputPredictor';
import PlaybackController from '../../controllers/PlaybackController';
import DashAdapter from '../../../dash/DashAdapter';
import LiveDelay from '../../utils/LiveDelay';
import EventBus from '../../../core/EventBus';
import Events from '../../../core/events/Events';
import MediaPlayerModel from '../../models/MediaPlayerModel';

/**
 * Implementation of LOLYPOP - Adaptation algorithm for Low-Delay live streaming
 *
 * @see http://arxiv.org/pdf/1603.00859v2.pdf#chapter.4
 * @author Armand Zangue
 */
function LOLYPOPRule(config) {

    let context = this.context;
    //let videoModel = VideoModel(context).getInstance();
    let playbackController = PlaybackController(context).getInstance();
    let eventBus = EventBus(context).getInstance();
    //let dashMetrics = config.dashMetrics;
    //let metricsModel = config.metricsModel;

    let fragmentCount = {};
    let qualitySwitchCount = {};
    let lastLoadedQualityIdx = {};
    //let fallbackQualityIndex = NaN;

    let instance,
        mediaPlayerModel,
        adapter,
        throughputPredictor,
        liveDelay;

    function setup() {
        mediaPlayerModel = MediaPlayerModel(context).getInstance();
        adapter = DashAdapter(context).getInstance();
        throughputPredictor = ThroughputPredictor(context).getInstance();
        liveDelay = LiveDelay(context).getInstance();

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

        if (request.mediaType === 'fragmentedText' || true === e.skipped || isNaN(request.index))
            return;

        //if (!isNaN(fallbackQualityIndex) && request.quality === fallbackQualityIndex)
        //    return;

        fragmentCount[request.mediaType] += 1;
        lastLoadedQualityIdx[request.mediaType] = request.quality;

        if (!isNaN(prevQualityIdx) && prevQualityIdx !== request.quality)
            qualitySwitchCount[request.mediaType] += 1;

        //console.log('[LOLYPOP] Fragment Count: ' + fragmentCount[request.mediaType]);
        //console.log('[LOLYPOP] Qlt Swicth Count: ' + qualitySwitchCount[request.mediaType]);
        //console.log('[LOLYPOP] Segment Duration: ' + request.duration);
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

        //errors.dump();

        // Compute the relative error between estimated throughput and representations throughput
        for (i = 0; i < qualities.length; i++) {
            let error = ((estimatedThroughput * 1000) - qualities[i].bitrate) / qualities[i].bitrate;

            a = errors.countLessOrEqualThan(error);
            b = errors.count();
            p = a / b;

            //console.log('Error: ' + error + ' less than: ' + a + ' prob: ' + p);

            probalities[qualities[i].bitrate] = p;
        }

        return probalities;
    }

    function requestStartTimeToWallClockTime(streamProcessor, startTime) {
        let currentRepresentationInfo = streamProcessor.getCurrentRepresentationInfo();
        let manifestInfo = currentRepresentationInfo.mediaInfo.streamInfo.manifestInfo;
        let liveStartTime = manifestInfo.availableFrom.getTime() / 1000;

        return liveStartTime + startTime;
    }

    function now() {
        return new Date().getTime() / 1000;
    }

    function execute(rulesContext, callback) {
        //let now = new Date().getTime() / 1000;
        let mediaInfo = rulesContext.getMediaInfo();
        let streamProcessor = rulesContext.getStreamProcessor();
        let abrController = streamProcessor.getABRController();
        let currentIndex =  streamProcessor.getIndexHandler().getCurrentIndex();
        let nextIndex = currentIndex + 1; // next to be downloaded
        let currentPlayHeadTime = playbackController.getTime();
        let qualities = sortQualityAsc(abrController.getBitrateList(mediaInfo));
        let upperBoundSkippedSegments = abrController.getSkippedSegmentConfig();
        let upperBoundQualityTransitions = abrController.getQualityTransitionConfig();
        let switchRequest = SwitchRequest(context).create(SwitchRequest.NO_CHANGE, SwitchRequest.WEAK);
        let fragmentStartTime = adapter.getIndexHandlerTime(rulesContext.getStreamProcessor()); // next fragment start time
        let lowestQuality = qualities[0];
        let maxQuality; // TODO make this a bitrate info (maybe to hold lowest quality at init)
        let lastLoadedQuality; // quality of last succesful download
        let newQuality;
        let prediction;
        let dsProbabilities;
        let playbackDeadline;
        let rst = requestStartTimeToWallClockTime(streamProcessor, fragmentStartTime);
        let desirableDelay = mediaPlayerModel.getLiveDelay() || rulesContext.getTrackInfo().fragmentDuration * 2.5;

        //lastQuality = abrController.getQualityFor(mediaInfo.type, mediaInfo.streamInfo);

        /*
         * Optimization: we dont need to go through the whole ABR logic for single representation streams
         */
        if (hasSingleRepresentation(mediaInfo)) {
            //console.log('%c[LOLYPOP ABR] [' + mediaInfo.type + ']  Single representation stream. Nothing  to do: ' + (lowestQuality.bitrate / 1000) + ' kbps'  ,'background: blue; color: white');
            switchRequest = SwitchRequest(context).create(lowestQuality.qualityIndex, SwitchRequest.STRONG);
            callback(switchRequest);
            return;
        }

        // TODO - Maybe calculate the fragmentStartTime as period.start + (index * duration)
        // instead of relaying on the index handler

        // TODO index can also be -1 after start
        if (/*currentIndex === -1 || */fragmentCount[mediaInfo.type] === 0 || !playbackController.isPlaybackStarted()) {
            switchRequest = SwitchRequest(context).create(lowestQuality.qualityIndex, SwitchRequest.STRONG);
            //console.log('%c[LOLYPOP] SwitchRequest to quality: ' + lowestQuality.bitrate / 1000 + ' kbps - Reason : Just started', 'background: #222; color: #bada55');
            callback(switchRequest);
            return;
        }

        //console.log('[LOLYPOP########################] Live Delay: ' + liveDelay.getDelay());
        lastLoadedQuality = qualities[lastLoadedQualityIdx[mediaInfo.type]];

        // NOTE - live delay is not considered because we are using video element current time and not wall clock current time
        //playbackDeadline = fragmentStartTime - currentPlayHeadTime;
        playbackDeadline = desirableDelay - (now() - rst);

        //console.log('LOLYPOP [' + mediaInfo.type + '] - Playback deadline of next segment [' + nextIndex + ']: ' + playbackDeadline);
        //playbackDeadline = 2;

        prediction = throughputPredictor.predictAvailableThroughput(playbackDeadline);

        //console.log('%c[LOLYPOP ABR] [' + mediaInfo.type + ']  Prediction - throughput : ' + prediction.throughput + ' kbps' ,'background: blue; color: white');

        // No estimation available
        if (prediction.throughput === -1) {
            newQuality = lowestQuality;
            //newQuality = qualities[Math.round(qualities.length/2)];

            //console.log('%c[LOLYPOP] [' + mediaInfo.type + '] SwitchRequest to quality: ' + newQuality.bitrate / 1000 + ' kbps - Reason : No estimation available', 'background: #222; color: #bada55');

            switchRequest = SwitchRequest(context).create(newQuality.qualityIndex, SwitchRequest.STRONG);

            callback(switchRequest);

            return;
        }

        maxQuality = lowestQuality;


        //console.log('Download Success Probalities');
        //console.log('============================');
        // Decide what quality to take next
        dsProbabilities = calcDownloadSuccessProbabilities(prediction, qualities);

        for (let i = 0; i < qualities.length; i++) {
            let p = dsProbabilities[qualities[i].bitrate];

            //console.log('Bitrate: ' + qualities[i].bitrate/1000 + ' kpbs | 1-DSP: ' + (1-p) + ' | Prediction: ' + prediction.throughput + ' kbps | Sigma: ' + upperBoundSkippedSegments);

            //console.log('[LOLYPOP] [Decide] quality: ' + qualities[i].bitrate + ' 1 - dsp: ' + (1 - p) + ' upperBoundSkippedSegments: ' + upperBoundSkippedSegments);
            if ((1 - p) <= upperBoundSkippedSegments) {
                //console.log('HIT');
                maxQuality = qualities[i];
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

        ////console.log('[LOLYPOP] [INFO] New quality: ' + maxQuality.bitrate / 1000 + ' kbps');

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
            //newQuality = Math.min(maxQuality.bitrate, lastLoadedQuality.bitrate);
            newQuality = maxQuality.bitrate < lastLoadedQuality.bitrate ? maxQuality : lastLoadedQuality;
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