import FactoryMaker from '../../core/FactoryMaker.js';
import SortedSet from './lib/SortedSet.js';
import PredictionError from './vo/PredictionError.js';
import ThroughputPrediction from './vo/ThroughputPrediction.js';
import EventBus from '../../core/EventBus.js';
import Events from '../../core/events/Events.js';
import Error from '../vo/Error.js';

/**
 * This module tracks received bytes and activity period of segments requests and,
 * based on this data performs prediction of available network throughput. Also
 * calculation prediction accuracy (Error distribution).
 *
 * @see http://arxiv.org/pdf/1603.00859v2.pdf
 * @author Armand Zangue
 */
function ThroughputPredictor () {

    /**
     * Maximum amount of time (in seconds) in the future we can do prediction for.
     *
     * @const {Number}
     */
    const MAX_PREDICTION_HORIZON = 10;

    /**
     * Minimal throughput.
     *
     * @const {Number}
     */
    const TROUGHPUT_MIN = 10; //kbps

    let context = this.context;
    let eventBus = EventBus(context).getInstance();

    let instance,
        bytes,
        activity,
        errors,
        throughputMatrix,
        timeIndex,
        firstRecordTime,
        lastRecordTime,
        throughputMatrixfirstUpdate,
        lastUpadteTimeIndex; // Throughput matrix last update time;

    function setup() {
        bytes = [];
        activity = [];
        errors = SortedSet(context).create();
        throughputMatrix = [];
        timeIndex = null;
        firstRecordTime = null;
        lastRecordTime = null;
        throughputMatrixfirstUpdate = true;
        lastUpadteTimeIndex = null;

        eventBus.on(Events.LOADING_PROGRESS, onLoadingProgress, instance);
        //console.log('ThroughputPredictor setup()');
    }

    /**
     * set the current time index.
     *
     * @param {number} ti the current time index
     */
    function setCurrentTimeIndex(ti) {
        timeIndex = ti;
    }

    /**
     * Get the current time index.
     *
     * @return {number} the current time index
     */
    function getCurrentTimeIndex() {
        return timeIndex;
    }

    /**
     * Computes the age of the last recorded data
     *
     * @return {number} data age in seconds
     */
    function getDataAge() {
        let now = new Date();

        return Math.floor((now.getTime() - lastRecordTime.getTime()) / 1000);
    }

    /**
     * Estimates download success probability for each representation according
     * to future bandwidth throughput
     *
     * @param  {number} horizon prediction horizon in second(s)
     * @return {number}         Estimated bandwidth throughput
     */
    function doPrediction(horizon) {
        let dataAge = getDataAge();
        let index = getCurrentTimeIndex();
        let estimatedThroughput = -1;
        let predictionVector;
        let prediction;
        let i;

        // Make sure we will choose an interval that contains the provided horizon
        horizon = Math.ceil(horizon);
        //console.log('[ThroughputPredictor] Current time index : ' + index);
        //console.log('[ThroughputPredictor] perform prediction for next : ' + horizon + 'seconds');

        // Derivate the prediction vector from throughput matrix using time offset
        predictionVector = throughputMatrix[index - 1];
        //console.log('[ThroughputPredictor] prediction vector follows');
        //console.log(predictionVector);

        /*
         * We cannot perform throughput prediction, if we don't have any data, if the data are
         * too old (older than max prediction horizon)and if the horizon is not 'not valid'
         */
        if (!firstRecordTime || dataAge > MAX_PREDICTION_HORIZON ||
            horizon > MAX_PREDICTION_HORIZON || horizon < 1 || !predictionVector) {
            //console.log('[ThroughputPredictor] cannot prediction due to data age or horizon out of prediction range');
            prediction = new ThroughputPrediction(estimatedThroughput, errors);
            return prediction;
        }

        // TODO - Fucking fix this shit!
        // Perform prediction for timescales up to 10 seconds
        //console.log('[ThroughputPredictor] performing prediction for timescales up to 10 seconds');
        for (i = horizon - 1; i < MAX_PREDICTION_HORIZON; i++) {
            //if (!throughputMatrix[index - 1])
            //    continue;

            //estimatedThroughput = throughputMatrix[index - 1][horizon - 1];
            //console.log('[ThroughputPredictor] time scale : ' + (i+1) + ' = ' + predictionVector[i]);
            estimatedThroughput = predictionVector[i] || -1;

            if (estimatedThroughput)
                break;
        }

        //console.log('Prediction: estimated Throughput: ' + estimatedThroughput);

        // If no prediction available set to -1
        //if (!estimatedThroughput)
        //    estimatedThroughput = -1;

        //console.log('[ThroughputPredictor] choosen prediction: ' + estimatedThroughput);
        prediction = new ThroughputPrediction(estimatedThroughput, errors);

        return prediction;
    }

    /**
     * Utility function: sums up the last X entries of array starting from given index
     *
     * @param  {number} from start index
     * @param  {number} x    number of entries to build the sum of
     * @return {number}      The sum
     */
    function sigma(array, from, x) {
        //console.log(array);
        //console.log(from);
        //console.log(x);

        let retval = 0;
        let stop = from - x;

        if (stop < 0) {
            return NaN;
        }

        //console.log('\nArray sum last array');

        for (let i = from; i >= stop; i--) {
            //console.log('array[' + i + '] (' + array[i] + ') +');

            // Skip undefined entries to avoid the sum to be NaN
            if (array[i] === undefined) {
                continue;
            }

            retval += array[i];
        }

        ////console.log('Array sum last retval: ' + retval);
        return retval;
    }

    /**
     * Calculate the relative prediction error.
     *
     * @param  {number} tpPrediction predicted value
     * @param  {number} tpReal       real value
     * @return {number}              relative error between both values
     */
    function calcRelativeError(tpPrediction, tpReal) {
        //console.log(tpPrediction + ' ' + tpReal);
        let error;
        let tpMin = TROUGHPUT_MIN; // kpbs

        error = Math.max(tpPrediction, tpMin) - Math.max(tpReal, tpMin);
        error = error / Math.max(tpReal, tpMin);

        return error;
    }

    /**
     * Calculate the accuracy of previously computed predictions for different
     * horizon of times. This calculation is eventually used to determine the
     * error distribution of predictions.
     *
     * @param  {int} index column index of Throughput matrix
     * @return {void}
     */
    function calcPredictionAccuracy(index) {
        //console.log(index);
        let dimension = MAX_PREDICTION_HORIZON;
        let error = null;
        let tpPrediction;
        let tpReal;

        for (let i = 0; i < dimension; i++) {
            let j = i + 1;
            let k = index - j;

            if (k < 0)
                break;

            tpPrediction = throughputMatrix[index][i];
            tpReal = throughputMatrix[k][i];

            //console.log('tpPrediction = throughputMatrix[' + index + ']' + '[' + i + '] = ' + tpPrediction);
            //console.log('tpReal = throughputMatrix[' + k + ']' + '[' + i + '] = ' + tpReal);

            if (!tpReal || !tpPrediction)
                continue;

            error = new PredictionError();

            error.value = calcRelativeError(tpPrediction, tpReal);
            error.timestamp = Math.floor(Date.now() / 1000); // unix timestamp

            errors.insert(error);

            //console.log('ERRORS: ');
            //errors.dump();
        }
    }

    /**
     * Update the throughput matrix for a particular time index
     *
     * @param  {number} timeIndex the time index
     * @return {void}
     */
    function updateThroughputMatrixForTime(timeIndex) {
        //console.log('Updapte throughput matrix for time: ' + timeIndex);
        let dimension = MAX_PREDICTION_HORIZON;
        let bytesCount;
        let activityPeriod;
        let throughput;

        if (!throughputMatrix[timeIndex]) {
            throughputMatrix[timeIndex] = [];
        }

        bytesCount = bytes[timeIndex];
        activityPeriod = activity[timeIndex];

        //console.log(bytesCount);
        //console.log(activityPeriod);

        throughput = Math.floor(((bytesCount * 8) / activityPeriod) / 1000); //kbps

        throughputMatrix[timeIndex][0] = throughput;
        //console.log('throughputMatrix[' + timeIndex + '][0] = ' + throughput);

        for (let i = 1; i < dimension; i++) {
            bytesCount = sigma(bytes, timeIndex, i);
            activityPeriod = sigma(activity, timeIndex, i);

            //console.log(bytesCount);
            //console.log(activityPeriod);
            throughput = Math.floor(((bytesCount * 8) / activityPeriod) / 1000); //kbps

            //console.log('throughputMatrix[' + timeIndex + '][' + i + '] = ' + throughput);

            throughputMatrix[timeIndex][i] = throughput;
        }

        ////console.log('\nThroughput Matrix:')
        //console.dir(throughputMatrix);
        ////console.log(throughputMatrix[0][0])
    }

    /**
     * Update the throughput matrix
     *
     * @return {void}
     */
    function updateThroughputMatrix() {
        let currentTimeIndex = getCurrentTimeIndex();
        let timeIndex;
        //let timeShiftOffset;

        /*
         * if there is gap between the last update time of the matrix and now
         * we need to fill it
         * TODO - What if gap is bigger than MAX_HORIZON
         */
        while (lastUpadteTimeIndex < currentTimeIndex - 1 &&
                !throughputMatrixfirstUpdate) {
            timeIndex = lastUpadteTimeIndex + 1;
            //timeShiftOffset = ;

            updateThroughputMatrixForTime(timeIndex);
            lastUpadteTimeIndex++;
            // TODO - Calculate errors - time shift offset
        }

        updateThroughputMatrixForTime(currentTimeIndex);

        lastUpadteTimeIndex = currentTimeIndex;

        if (throughputMatrixfirstUpdate) {
            throughputMatrixfirstUpdate = false;
        }
    }

    /**
     * Populates bytes and activity array with data collected from request traces
     *
     * @listen Events.LOADING_PROGRESS event (FragmentLoader)
     * @param  data event data
     * @return void
     */
    function onLoadingProgress(data) {
        let now = new Date();
        let mediaType = data.request.mediaType;
        let trace = data.trace;
        let index;
        let lastIndex;
        let traceStartTime;
        let traceBytes;
        let traceDuration;

        // Skip audio requests as they happen in parallel with video segment requests
        if (mediaType === 'audio') {
            return;
        }

        // Store the reference time
        if (!firstRecordTime) {
            //firstRecordTime = httpRequest.trequest;
            firstRecordTime = trace.s;
        }

        lastIndex = getCurrentTimeIndex();
        traceStartTime = trace.s;
        traceBytes = trace.b[0];
        traceDuration = trace.d / 1000; // in seconds
        index = Math.floor((traceStartTime.getTime() - firstRecordTime.getTime()) / 1000);

        setCurrentTimeIndex(index);

        //console.log('Last Index: ' + lastIndex);
        //console.log('Current Index: ' + index);

        // Populate bytes and activity arrays using trace data
        bytes[index] = bytes[index] ? bytes[index] + traceBytes : traceBytes;
        activity[index] = activity[index] ? activity[index] + traceDuration : traceDuration;

        //bytes[index] ? bytes[index] += traceBytes : bytes[index] = traceBytes;
        //activity[index] ? activity[index] += traceDuration : activity[index] = traceDuration;

        //console.log('Index: ' + index + ' Bytes: ' + traceBytes);
        //console.log(bytes);
        //console.log(activity);

        // Something nasty somehow happened! Why you so paranoid?
        if (bytes.length !== activity.length) {
            throw new Error('Activity and Bytes array length mismatch');
        }

        // Keep the troughpout matrix up-to-date
        updateThroughputMatrix();

        // Check if we can compute prediction errors for the last index
        if (lastIndex && lastIndex < index) {
            calcPredictionAccuracy(lastIndex);
        }

        console.log('elapsed seconds since first record: ' + Math.floor(((now.getTime() - firstRecordTime.getTime()) / 1000)));
        lastRecordTime = traceStartTime;
    }

    /**
     * Return estimated throughput for the next 'horizon' seconds along with error distribution
     *
     * @public
     * @param  {number} horizon playback deadline of next to be downloaded segment in seconds
     * @return {Object}         Throughput prediction
     */
    function predictAvailableThroughput(horizon) {
        //console.log(horizon);
        let now = new Date();
        let timeIndex = Math.floor((now.getTime() - firstRecordTime.getTime()) / 1000);

        // Update time
        setCurrentTimeIndex(timeIndex);

        // Update matrix
        updateThroughputMatrix();

        // predict
        return doPrediction(horizon);
    }

    function reset() {
        eventBus.off(Events.LOADING_PROGRESS, onLoadingProgress, instance);
        setup();
    }

    instance = {
        predictAvailableThroughput: predictAvailableThroughput,
        reset: reset
    };

    setup();

    return instance;
}

ThroughputPredictor.__dashjs_factory_name = 'ThroughputPredictor';
export default FactoryMaker.getSingletonFactory(ThroughputPredictor);