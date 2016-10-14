import FactoryMaker from '../../core/FactoryMaker';

const DOWNLOAD_METRIC = 0;
const DELAY_METRIC = 1;
const SKIPPED_METRIC = 2;
const THROUGHPUT_METRIC = 3;

/**
 * @module LogClient
 * @description Simple class to log data to remote server.
 * @note Just for the sake of my thesis evaluation
 * @author Zangue
 */
function LogClient() {

    let context = this.context;

    let infos;
    let baseUrl;
    let shouldReport;
    let instance;

    function setup () {
        let url = window.location.href;

        if (!getParameterByName('report', url))
            shouldReport = false;
        else
            shouldReport = true;

        infos = {
            algo: getParameterByName('algo', url),
            omega: getParameterByName('omega', url),
            sigma: getParameterByName('sigma', url),
            test_nr: getParameterByName('test_nr', url),
            run_nr: getParameterByName('run_nr', url)
        }

        baseUrl = "http://127.0.0.1:5000"
    }

    /**
     * Overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
     * @param obj1
     * @param obj2
     * @returns obj3 a new object based on obj1 and obj2
     * @source stackoverflow
     */
    function mergeOptions(obj1,obj2){
        var obj3 = {};
        for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
        for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
        return obj3;
    }

    function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    function serialize(obj) {
      var str = [];
      for(var p in obj)
        if (obj.hasOwnProperty(p)) {
          str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        }
      return str.join("&");
    }

    function doGetRequest(url, successCB, failureCB) {
        var req = new XMLHttpRequest();
        var oncomplete = function () {
            if ((req.status >= 200) && (req.status < 300)) {
                if (successCB) {
                    successCB();
                }
            } else {
                if (failureCB) {
                    failureCB();
                }
            }
        };

        try {
            req.open('GET', url);
            req.onloadend = oncomplete;
            req.onerror = oncomplete;
            req.send();
        } catch (e) {
            req.onerror();
        }
    }

    function report(data) {
        if (!shouldReport) return;

        let url = baseUrl + '/report?';

        url += serialize(mergeOptions(data, infos));

        // Make an HTTP GET request to the URL contained within the
        // string created in the previous step.
        doGetRequest(url, null, function () {
            // If the Player is unable to make the report, for
            // example because the @reportingUrl is invalid, the
            // host cannot be reached, or an HTTP status code other
            // than one in the 200 series is received, the Player
            // shall cease being a reporting Player for the
            // duration of the MPD.
            shouldReport = false;
            console.warn('Could not report data! Reporter stops...');
        });
    }

    function reset() {
        setup();
    }

    instance = {
        report: report,
        reset: reset
    };

    setup();

    return instance;
}

LogClient.__dashjs_factory_name = 'LogClient';
const factory = FactoryMaker.getClassFactory(LogClient);
factory.DOWNLOAD_METRIC = DOWNLOAD_METRIC;
factory.DELAY_METRIC = DELAY_METRIC;
factory.SKIPPED_METRIC = SKIPPED_METRIC;
factory.THROUGHPUT_METRIC = THROUGHPUT_METRIC;
export default factory;

