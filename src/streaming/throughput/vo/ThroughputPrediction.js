/**
 * @author Armand Zangue
 */
class ThroughputPrediction {
    constructor (throughput, errors) {
        this.throughput = throughput; // Estimated throughput
        this.errors = errors; // Errors distribution
    }
}

export default ThroughputPrediction;