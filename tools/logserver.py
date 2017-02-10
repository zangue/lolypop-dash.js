__author__ = "Zangue"

from flask import Flask, request
from flask_cors import CORS, cross_origin

import time
import subprocess

LOG_DIR = '/home/tkn/Test/logs/'
DOWNLOAD_METRIC = 0
DELAY_METRIC = 1
SKIPPED_METRIC = 2
THROUGHPUT_METRIC = 3

app = Flask(__name__)
CORS(app)

def to_log_string(items):
	ls = ''
	size = len(items)
	for i in range(size):
		ls = ls + str(items[i])
		if (i < (size - 1)):
			ls = ls + ','
	return ls + '\n'

def log_download(args):
	log_items = []
	log_items.append(args.get('metric_id'))
	log_items.append(args.get('timestamp'))
	log_items.append(args.get('type'))
	log_items.append(args.get('bitrate'))
	log_items.append(args.get('send_time'))
	log_items.append(args.get('first_bytes_time'))
	log_items.append(args.get('loaded_time'))
	log_items.append(args.get('bytes_loaded'))
	log_items.append(args.get('bytes_total'))
	log_items.append(args.get('algo'))
	log_items.append(args.get('omega'))
	log_items.append(args.get('sigma'))
	log_items.append(args.get('test_nr'))
	log_items.append(args.get('run_nr'))

	log_string = to_log_string(log_items)

	fo = open(download_log_file, 'a')
	fo.write(log_string)
	fo.close()
	
	return 'ok'

def log_delay(args):
	log_items = []
	log_items.append(args.get('metric_id'))
	log_items.append(args.get('timestamp'))
	log_items.append(args.get('delay'))
	log_items.append(args.get('algo'))
	log_items.append(args.get('omega'))
	log_items.append(args.get('sigma'))
	log_items.append(args.get('test_nr'))
	log_items.append(args.get('run_nr'))

	log_string = to_log_string(log_items)

	fo = open(delay_log_file, 'a')
	fo.write(log_string)
	fo.close()
	
	return 'ok'
	
def log_skipped(args):
	log_items = []
	log_items.append(args.get('metric_id'))
	log_items.append(args.get('timestamp'))
	log_items.append(args.get('type'))
	log_items.append(args.get('bitrate'))
	log_items.append(args.get('send_time'))
	log_items.append(args.get('first_bytes_time'))
	log_items.append(args.get('abort_time'))
	log_items.append(args.get('bytes_loaded'))
	log_items.append(args.get('bytes_total'))
	log_items.append(args.get('algo'))
	log_items.append(args.get('omega'))
	log_items.append(args.get('sigma'))
	log_items.append(args.get('test_nr'))
	log_items.append(args.get('run_nr'))

	log_string = to_log_string(log_items)

	fo = open(skipped_log_file, 'a')
	fo.write(log_string)
	fo.close()
	
	return 'ok'

def log_throughput(args):
	log_items = []
	log_items.append(args.get('metric_id'))
	log_items.append(args.get('timestamp'))
	log_items.append(args.get('type'))
	log_items.append(args.get('bytes'))
	log_items.append(args.get('activity_s'))
	log_items.append(args.get('throughput_bps'))
	log_items.append(args.get('algo'))
	log_items.append(args.get('omega'))
	log_items.append(args.get('sigma'))
	log_items.append(args.get('test_nr'))
	log_items.append(args.get('run_nr'))

	log_string = to_log_string(log_items)

	fo = open(throughput_log_file, 'a')
	fo.write(log_string)
	fo.close()
	
	return 'ok'	

@app.route('/report', methods=['GET'])
def report():
	metric_id = int(request.args.get('metric_id'))
	if (metric_id == DOWNLOAD_METRIC):
		return log_download(request.args)
	elif (metric_id == DELAY_METRIC):
		return log_delay(request.args)
	elif (metric_id == SKIPPED_METRIC):
		return log_skipped(request.args)
	elif (metric_id == THROUGHPUT_METRIC):
		return log_throughput(request.args)
	else:
		print 'Unknow Metric'
		return 'Error'
	

@app.route('/', methods=['GET'])
def index():
	return "Simple logging server"

def create_log_files():
	print 'create log files called!'
	#return
	ts = int(time.time())
	log_dir = LOG_DIR + str(ts) + '/'
	sp = subprocess.Popen(['mkdir', log_dir])
	sp.wait()

	# Create quality log file
	global download_log_file
	download_log_file = log_dir + 'download_log.csv'
	header = 'metric_id,timestamp,type,bitrate,send_time,first_bytes_time,loaded_time,bytes_loaded,bytes_total,algo,omega,sigma,test_nr,run_nr\n'
	fo = open(download_log_file, 'wb')
	fo.write(header)
	fo.close()

	# Create delay log file
	global delay_log_file
	delay_log_file = log_dir + 'delay_log.csv'
	header = 'metric_id,timestamp,delay,algo,omega,sigma,test_nr,run_nr\n'
	fo = open(delay_log_file, 'wb')
	fo.write(header)
	fo.close()

	# Create throughput log file
	global throughput_log_file
	throughput_log_file = log_dir + 'throughput_log.csv'
	header = 'metric_id,timestamp,type,bytes,activity_s,throughput_bps,algo,omega,sigma,test_nr,run_nr\n'
	fo = open(throughput_log_file, 'wb')
	fo.write(header)
	fo.close()
	
	# Create skipped segment log file
	global skipped_log_file
	skipped_log_file = log_dir + 'skipped.csv'
	header = 'metric_id,timestamp,type,bitrate,send_time,first_bytes_time,abort_time,bytes_loaded,bytes_total,algo,omega,sigma,test_nr,run_nr\n'
	fo = open(skipped_log_file, 'wb')
	fo.write(header)
	fo.close()

if __name__ == '__main__':
	create_log_files()
	app.run(debug=True)
