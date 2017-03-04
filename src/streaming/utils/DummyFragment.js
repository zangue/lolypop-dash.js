/**
 * Generate new media segment by replaying the previous one.
 * @author Zangue
 */

import FactoryMaker from '../../core/FactoryMaker';
import EventBus from '../../core/EventBus';
import Events from '../../core/events/Events';
import {HTTPRequest} from '../vo/metrics/HTTPRequest';
import ISOBoxer from 'codem-isoboxer';
import SegmentCache from './SegmentCache';

function DummyFragment(config) {

    const context = this.context;
    const eventBus = EventBus(context).getInstance();

    let instance;
    let segmentCache;

    function setup() {
        //segmentCache = new SegmentData();
        segmentCache = SegmentCache(context).getInstance();
    }

    function isInitializationRequest(request) {
        return (request && request.type && request.type === HTTPRequest.INIT_SEGMENT_TYPE);
    }

    function getSampleDuration(data) {
        return data.fetch('trun').samples[0].sample_duration;
    }

    function getSampleCount(data) {
        return data.fetch('trun').sample_count;
    }

    function getBaseMediaDecodeTime(data) {
        return data.fetch('tfdt').baseMediaDecodeTime;
    }

    function getTfdtVersion (data) {
        return data.fetch('tfdt').version;
    }

    function readString(length, data, offset) {
        let str = '';

        for (let c = 0; c < length; c++) {
            let char = data.getUint8(offset + c);
            str += String.fromCharCode(char);
        }

        return str;
    }

    function checkBox(data, offset) {
        let size = data.getUint32(offset);
        let type = readString(4, data, offset + 4);

        return {size: size, type: type};
    }

    function setTimingData (request) {
        let pos = 0;
        //let buffer = segmentData.get(request.quality);
        let buffer = segmentCache.get(request.mediaType, request.quality);
        console.log("Cached Segment");
        console.log(buffer);
        let data = new DataView(buffer);
        let parsedFile = ISOBoxer.parseBuffer(buffer);

        while (pos < data.byteLength) {
            let box = checkBox(data, pos);

            if (box.type == 'moof') {
                let _pos = pos + 8;
                let moofEnd = pos + box.size;

                while (_pos < moofEnd) {
                    let _box = checkBox(data, _pos);

                    if (_box.type == 'mfhd') {
                        //console.log('-- MFHD sequence number: ' + data.getUint32(_pos + 12));
                        data.setUint32(_pos + 12, request.index);
                        //console.log('-- MFHD sequence number (edited): ' + data.getUint32(_pos + 12));
                    }

                    if (_box.type == 'traf') {
                        //console.log('Inside TRAF');
                        let __pos = _pos + 8;
                        let trafEnd = __pos + _box.size;

                        while (__pos < trafEnd) {
                            let __box = checkBox(data, __pos);

                            if (__box.type == 'tfdt') {
                                let version = getTfdtVersion(parsedFile);
                                let sampleDuration = getSampleDuration(parsedFile);
                                let sampleCount = getSampleCount(parsedFile);
                                let offset;
                                let bmdt;

                                if (version === 1) { // 64 Bit
                                    // Note: this would not work if decode time actually needs more than 32 bits
                                    // So we just assume it's never bigger than max unsigned int
                                    offset = 16;
                                } else if (version === 0) { // 32 Bit
                                    offset = 12;
                                } else {
                                    throw 'Invalid version number for tfdt box';
                                }

                                //console.log('-- -- TFTD base media decode time : ' + getBaseMediaDecodeTime(parsedFile));

                                // set base media decode time of next segment = sample_duration * sample_count
                                bmdt = (sampleCount * sampleDuration) * request.index;

                                data.setUint32(__pos + offset, bmdt);

                                let cbuf = ISOBoxer.parseBuffer(buffer);
                                //console.log('-- -- TFTD base media decode time (edited) : ' + cbuf.fetch('tfdt').baseMediaDecodeTime);
                            }

                            __pos += __box.size;
                        }
                    }
                    _pos += _box.size;
                }
            }
            pos += box.size;
        }

        return buffer;
    }

    function loadDummyFragment(request, fragmentLoader) {

        let data = setTimingData(request);

        //console.log('%cReplaying segment. ' + request.index + ' quality: ' + request.quality, 'background: red; color: white');

        eventBus.trigger(Events.LOADING_COMPLETED, {
            request: request,
            response: data || null,
            error: null,
            sender: fragmentLoader,
            skipped: true
        });
    }

    function reset() {
        setup();
    }

    instance = {
        generateMediaSegment: loadDummyFragment,
        reset: reset
    };

    setup();

    return instance;

}

DummyFragment.__dashjs_factory_name = 'DummyFragment';
export default FactoryMaker.getClassFactory(DummyFragment);
