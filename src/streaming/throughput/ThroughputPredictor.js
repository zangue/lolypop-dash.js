import FactoryMaker from '../../core/FactoryMaker.js';

const MAX_PREDICTION_HORIZON = 10;
const TROUGHPUT_MIN = 10; //kbps

function ThroughputPredictor () {

}

ThroughputPredictor.__dashjs_factory_name = 'ThroughputPredictor';
export default FactoryMaker.getSingletonFactory(ThroughputPredictor);