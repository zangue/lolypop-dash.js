import FactoryMaker from '../../core/FactoryMaker';
import PlaybackController from '../controllers/PlaybackController';
import MetricsModel from '../models/MetricsModel';
import DashMetrics from '../../dash/DashMetrics';
import StreamController from '../controllers/StreamController';
import VideoModel from '../models/VideoModel';
import EventBus from '../../core/EventBus';
import Events from '../../core/events/Events';

/**
 * @module LiveDelay
 * @description Provides utility function for live delay computation
 * @author Zangue
 */
function LiveDelay() {

    let context = this.context;

    let playbackController;
    let metricsModel;
    let dashMetrics;
    let streamController;
    let videoModel;
    let eventBus;
    let instance;

    function setup () {
        playbackController = PlaybackController(context).getInstance();
        metricsModel = MetricsModel(context).getInstance();
        dashMetrics = DashMetrics(context).getInstance();
        streamController = StreamController(context).getInstance();
        videoModel = VideoModel(context).getInstance();
        eventBus = EventBus(context).getInstance();

        eventBus.on(Events.WALLCLOCK_TIME_UPDATED, onWallclockTimeUpdated, this);
    }

    function onWallclockTimeUpdated(e) {

    }

    function getDVRInfoMetric() {
        var metric = metricsModel.getReadOnlyMetricsFor('video') || metricsModel.getReadOnlyMetricsFor('audio');
        return dashMetrics.getCurrentDVRInfo(metric);
    }

    function getAsUTC(valToConvert) {
        var metric = getDVRInfoMetric();
        var availableFrom,
            utcValue;

        if (!metric) {
            return 0;
        }
        availableFrom = metric.manifestInfo.availableFrom.getTime() / 1000;
        utcValue = valToConvert + (availableFrom + metric.range.start);
        return utcValue;
    }

    /**
     * Duration of the media's playback, in seconds.
     *
     * @returns {number} The current duration of the media.
     * @memberof module:MediaPlayer
     * @instance
     */
    function duration() {
        if (!playbackController.isPlaybackStarted()) {
            throw 'Playback has not started yet';
        }

        var d = videoModel.getElement().duration;

        if (playbackController.getIsDynamic()) {

            var metric = getDVRInfoMetric();
            var range;

            if (!metric) {
                return 0;
            }

            range = metric.range.end - metric.range.start;
            d = range < metric.manifestInfo.DVRWindowSize ? range : metric.manifestInfo.DVRWindowSize;
        }
        return d;
    }

    function time(streamId) {
        if (!playbackController.isPlaybackStarted()) {
            throw 'Playback has not started yet';
        }

        var t = videoModel.getElement().currentTime;

        if (streamId !== undefined) {
            t = streamController.getTimeRelativeToStreamId(t, streamId);
        }

        if (playbackController.getIsDynamic()) {
            var metric = getDVRInfoMetric();
            t = (metric === null) ? 0 : duration() - (metric.range.end - metric.time);
        }
        return t;
    }

    function timeAsUTC() {
        if (!playbackController.isPlaybackStarted()) {
            throw 'Playback has not started yet';
        }
        if (time() < 0) {
            return NaN;
        }
        return getAsUTC(time());
    }

    function getDelay() {
        var d = new Date();

        return Math.round((d.getTime()/1000) - Number(timeAsUTC()));
    }

    function reset() {
        eventBus.off(Events.WALLCLOCK_TIME_UPDATED, onWallclockTimeUpdated, this);
        setup();
    }

    instance = {
        getDelay: getDelay,
        reset: reset
    };

    setup();

    return instance;
}

LiveDelay.__dashjs_factory_name = 'LiveDelay';
export default FactoryMaker.getSingletonFactory(LiveDelay);
