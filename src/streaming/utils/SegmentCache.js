/**
 * @author Zangue
 */ 

import FactoryMaker from '../../core/FactoryMaker';
import EventBus from '../../core/EventBus';
import Events from '../../core/events/Events';
import {HTTPRequest} from '../vo/metrics/HTTPRequest';

function SegmentCache () {
    const context = this.context;
    let instance;
    let eventBus = EventBus(context).getInstance();
    let cache;

    function setup () {
        cache = {};
        eventBus.on(Events.FRAGMENT_LOADING_COMPLETED, onFragmentLoadingCompleted, this);
    }

    function isInitializationRequest(request) {
        return (request && request.type && request.type === HTTPRequest.INIT_SEGMENT_TYPE);
    }


    function onFragmentLoadingCompleted (e) {
        let request = e.request;
        let bytes = e.response;
        let isInit = isInitializationRequest(request);

        console.log("CAACHINGGGGGGGG");
        console.log(e.request);
        console.log(e.response);

        // Do not cache initialization segments
        if (isInit)
            return;

        if (!bytes) {
            log('No ' + request.mediaType + ' bytes to cache.');
            return;
        }

        console.log('Caching');
        console.log(request);
        if (!cache.hasOwnProperty(request.mediaType))
            cache[request.mediaType] = {};
        else //if (!cache[request.mediaType].hasOwnProperty(request.quality))
            cache[request.mediaType][request.quality] = bytes;
    }

    function getSegment(mediaType, qualityIndex) {
        console.log(cache);
        console.log(mediaType);
        console.log(qualityIndex);
        if (!cache.hasOwnProperty(mediaType))
            throw 'No segment cache available for this media type: ' + mediaType;

        if (cache[mediaType].hasOwnProperty(qualityIndex))
            return cache[qualityIndex];

        throw 'No Cached segment available for this quality';
    }

    function reset () {
        eventBus.off(Events.FRAGMENT_LOADING_COMPLETED, onFragmentLoadingCompleted, this);
        setup();
    }

    instance = {
        get: getSegment,
        reset: reset
    };

    setup();

    return instance;
}

SegmentCache.__dashjs_factory_name = 'SegmentCache';
export default FactoryMaker.getSingletonFactory(SegmentCache);