/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
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
import MediaPlayerModel from '../../models/MediaPlayerModel';
import PlaybackController from '../../controllers/PlaybackController';
import FactoryMaker from '../../../core/FactoryMaker';
import Debug from '../../../core/Debug';
import EventBus from '../../../core/EventBus';
import Events from '../../../core/events/Events';

const GRACE_TIME_THRESHOLD = 251;
const LOADED_THRESHOLD = 80;

function LOLYPOPAbortRule(config) {

    let context = this.context;
    let log = Debug(context).getInstance().log;
    let dashMetrics = config.dashMetrics;
    let metricsModel = config.metricsModel;
    let eventBus = EventBus(context).getInstance();

    let instance,
        mediaPlayerModel,
        playbackStarted,
        playbackController;

    function setup() {
        mediaPlayerModel = MediaPlayerModel(context).getInstance();
        playbackController = PlaybackController(context).getInstance();
        eventBus.on(Events.PLAYBACK_PLAYING, onPlaying, instance);
        playbackStarted = false;
    }

    function isInitializationRequest(request) {
        return (request && request.type && request.type === HTTPRequest.INIT_SEGMENT_TYPE);
    }

    function onPlaying(e) {
        playbackStarted = true;
        eventBus.off(Events.PLAYBACK_PLAYING, onPlaying, instance);
    }

    function requestStartTimeToWallClockTime(streamProcessor, request) {
        let currentRepresentationInfo = streamProcessor.getCurrentRepresentationInfo();
        let manifestInfo = currentRepresentationInfo.mediaInfo.streamInfo.manifestInfo;
        let liveStartTime = manifestInfo.availableFrom.getTime() / 1000;

        return liveStartTime + request.startTime;
    }

    function isStalling(streamProcessor) {
        let bufferController = streamProcessor.getBufferController();
        let representationInfo = streamProcessor.getCurrentRepresentationInfo();
        let mediaInfo = representationInfo.mediaInfo;
        let mediaType = mediaInfo.type;
        let bufferLevel = dashMetrics.getCurrentBufferLevel(metricsModel.getReadOnlyMetricsFor(mediaType));

        //console.log('%c[LOLYPOPAbortRule] Current Buffer Level : ' +  bufferController.getBufferLevel(), 'background: red; color: white');
        //console.log('%c[LOLYPOPAbortRule] Playback started : ' +  bufferController.isPlaybackStarted() + ' / ' + playbackStarted, 'background: red; color: white');

        //return (bufferLevel <= bufferController.STALL_THRESHOLD);
        return (bufferLevel <= 0.7);
    }

    function isDone(request) {
        //console.log('%c[LOLYPOPAbortRule] Bytes Loaded : ' +  request.bytesLoaded + ' Bytes Total: ' + request.bytesTotal, 'background: red; color: white');
        return request.bytesLoaded >= request.bytesTotal;
    }

    function execute(rulesContext, callback) {
        let now = new Date().getTime() / 1000;
        let mediaInfo = rulesContext.getMediaInfo();
        let streamProcessor = rulesContext.getStreamProcessor();
        let scheduleController = streamProcessor.getScheduleController();
        let bufferController = streamProcessor.getBufferController();
        let progressEvent = rulesContext.getCurrentValue();
        let request = progressEvent.request;
        let xhr = progressEvent.xhr;
        let switchRequest = SwitchRequest(context).create(SwitchRequest.NO_CHANGE, SwitchRequest.STRONG);
        let desirableDelay = mediaPlayerModel.getLiveDelay() || request.duration * 2.5;
        let currenTime = playbackController.getTime();
        let rst = requestStartTimeToWallClockTime(streamProcessor, request);
        let loadedPercentage = Math.round(((request.bytesLoaded / request.bytesTotal) * 100));
        let playbackDeadline /*= request.startTime - currenTime*/;

        //console.log('%c[LOLYPOPAbortRule] Now : ' +  now, 'background: red; color: white');
        //console.log('%c[LOLYPOPAbortRule] Request Start Time : ' +  rst, 'background: red; color: white');
        //console.log('%c[LOLYPOPAbortRule] Diff : ' +  (now - rst), 'background: red; color: white');

        // Experimental
        playbackDeadline = desirableDelay - (now - rst);

        console.log('Playback Deadline: ' + (playbackDeadline*1000) + ' ms');
        console.log('Deadline threshold: ' + LOADED_THRESHOLD + ' ms');
        console.log('Loaded: ' + loadedPercentage + ' %\n');

        //console.log('%c[LOLYPOPAbortRule] Request URL : ' +  request.url, 'background: red; color: white');
        //console.log('%c[LOLYPOPAbortRule] Current Time : ' +  currenTime + ' Start Time: ' + request.startTime, 'background: red; color: white');
        //console.log('%c[LOLYPOPAbortRule] Playback deadline (sec) : ' +  playbackDeadline, 'background: red; color: white');
        //console.log(playbackController.getVideoModel().getElement());


        if (currenTime === 0 || isNaN(request.index) || isDone(request)) {
            //console.log('%c[LOLYPOPAbortRule] DO NOTHING for request: ' + request.index, 'background: red; color: white');
            callback(switchRequest);
            
            return;
        }


        if ((playbackStarted && (isStalling(streamProcessor)) ||
            ((playbackDeadline * 1000) < GRACE_TIME_THRESHOLD) && (loadedPercentage <= LOADED_THRESHOLD))) {
            
            request.requestEndDate = new Date();

            xhr.onloadend = xhr.onerror = xhr.onprogress = undefined;
            
            xhr.abort();
            
            scheduleController.skipSegment(request);
            console.trace();
            console.log('%c[LOLYPOPAbortRule] Asking to abandon request: ' + request.index, 'background: red; color: white');

            callback(switchRequest);
            
            return;
        }

        callback(switchRequest);
    }

    function reset() {
        eventBus.off(Events.PLAYBACK_PLAYING, onPlaying, instance);
        setup();
    }

    instance = {
        execute: execute,
        reset: reset
    };

    setup();

    return instance;
}

LOLYPOPAbortRule.__dashjs_factory_name = 'LOLYPOPAbortRule';
export default FactoryMaker.getClassFactory(LOLYPOPAbortRule);