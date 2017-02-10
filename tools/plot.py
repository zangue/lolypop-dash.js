__author__ = 'Zangue'

import sys
import argparse
import pandas as pd
import matplotlib.pyplot as plt

BASE_DIR = '/home/tkn/Test/logs/final/'

nr_runs = 5
algos = ['lolypop', 'bola', 'dashjs']
configs = [] # Number of items in this list should be the same as the number of tests done
logfiles = None

argparser = argparse.ArgumentParser()

argparser.add_argument('-d', action='store', dest='downloads_file',
			help='The downloads metrics file')
argparser.add_argument('-s', action='store', dest='skipped_seg_file',
			help='The skipped segments metrics file')
argparser.add_argument('--delay', action='store', dest='delay_file',
			help='The delay metrics file')
argparser.add_argument('-t', action='store', dest='throughput_file',
			help='The throughput metrics file')


#def plot_skipped_segment(cfg):
#	df = pd.read_csv(logfiles.skipped_seg_file)
#	df = df[(df['omega'] == cfg['omega']) & (df['sigma'] == cfg['sigma'])]
#	pdata = {'lolypop': [], 'bola': [], 'dashjs': []}
	# Not necessary - lolypop algo is the only one who skip
#	data = df[(df['algo'] == 'lolypop')]
#	print data
#	for i in range(nr_runs):
#		d = data[(data['run_nr'] == (i+1))]
#		print len(d.index)
#		pdata['lolypop'].append(len(d.index))
		#pdata['bola'].append(0)
		#pdata['dashjs'].append(0)
#		pdata['bola'].append(len(d.index))
#		pdata['dashjs'].append(len(d.index))

def plot_skipped_segment(cfg):
	fname = BASE_DIR + '/plot_' + str(cfg['omega']) + '_' + str(cfg['sigma']) + '_skipped_segments.png'
	df = pd.read_csv(logfiles.skipped_seg_file)
	df = df[(df['omega'] == cfg['omega']) & (df['sigma'] == cfg['sigma'])]
	pdata = {'lolypop': [], 'bola': [], 'dashjs': []}
	# Not necessary - lolypop algo is the only one who skip
	#data = df[(df['algo'] == 'lolypop')]
	#print data
	for algo in algos:
		print algo
		data = df[(df['algo'] == algo)]
		for i in range(nr_runs):
			d = data[(data['run_nr'] == (i+1))]
			print "algo %s run nr %d" % (algo, i+1)
			print d
			print len(d.index)
			pdata[algo].append(len(d.index))
	
	print pdata
	#plt.figure()
	text = '$\Omega = %.2f$' % float(float(cfg['omega'])/100)
	text = text + '\n'
	text = text + '$\Sigma = %.2f$' % float(float(cfg['sigma'])/100)
	fig, ax = plt.subplots()
	plt.xlabel('Algorithms')
	plt.ylabel('Number of skipped segment')
	plt.title('Skipped segments')
	plt.boxplot([pdata['lolypop'], pdata['bola'], pdata['dashjs']])
	ax.set_xticklabels(algos, rotation=45)
	ax.text(0.1, 0.9,text, ha='center', va='center', transform=ax.transAxes)
	plt.tight_layout()
	plt.savefig(fname)

#def get_configs():
#	data = pd.read_csv(logfiles.downloads_file)
#	pass

def count_quality_transitions(df):
	prev = None
	count = 0
	for index, row in df.iterrows():
		#print type(row['bitrate'])
		if prev is None:
			prev = row['bitrate']
			continue
		if prev != row['bitrate']:
			count = count + 1
		prev = row['bitrate']
	return count
		

def plot_quality_transitions(cfg):
	fname = BASE_DIR + '/plot_' + str(cfg['omega']) + '_' + str(cfg['sigma']) + '_quality_transitions.png'
	df = pd.read_csv(logfiles.downloads_file)
	# Data for this config
	df = df[(df['omega'] == cfg['omega']) & (df['sigma'] == cfg['sigma'])]
	pdata = {'lolypop': [], 'bola': [], 'dashjs': []}
	for algo in algos:
		print algo
		data = df[(df['algo'] == algo)]
		for i in range(nr_runs):
			d = data[(data['run_nr'] == (i+1))]
			print "algo %s run nr %d" % (algo, i+1)
			print d
			pdata[algo].append(count_quality_transitions(d))
	print pdata
	text = '$\Omega = %.2f$' % float(float(cfg['omega'])/100)
	text = text + '\n'
	text = text + '$\Sigma = %.2f$' % float(float(cfg['sigma'])/100)
	fig, ax = plt.subplots()
	plt.xlabel('Algorithms')
	plt.ylabel('Number of quality transitions')
	plt.title('Quality transitions')
	plt.boxplot([pdata['lolypop'], pdata['bola'], pdata['dashjs']])
	ax.set_xticklabels(algos, rotation=45)
	ax.text(0.1, 0.9,text, ha='center', va='center', transform=ax.transAxes)
	plt.tight_layout()
	plt.savefig(fname)
	

def plot_avg_quality(cfg):
	fname = BASE_DIR + '/plot_' + str(cfg['omega']) + '_' + str(cfg['sigma']) + '_avg_quality.png'
	df = pd.read_csv(logfiles.downloads_file)
	df = df[(df['omega'] == cfg['omega']) & (df['sigma'] == cfg['sigma'])]
	pdata = {'lolypop': [], 'bola': [], 'dashjs': []}
	for algo in algos:
		print algo
		#print df['algo']
		data = df[(df['algo'] == algo)]
		for i in range(nr_runs):
			d = data[(data['run_nr'] == (i+1))]
			print d['bitrate'].mean()
			pdata[algo].append(d['bitrate'].mean()/1000)
	print pdata		
	#plt.figure()
	text = '$\Omega = %.2f$' % float(float(cfg['omega'])/100)
	text = text + '\n'
	text = text + '$\Sigma = %.2f$' % float(float(cfg['sigma'])/100)
	fig, ax = plt.subplots()
	plt.xlabel('Algorithms')
	plt.ylabel('Video quality (kbps)')
	plt.title('Video average quality')
	plt.boxplot([pdata['lolypop'], pdata['bola'], pdata['dashjs']])
	ax.set_xticklabels(algos, rotation=45)
	ax.text(0.1, 0.9,text, ha='center', va='center', transform=ax.transAxes)
	plt.tight_layout()
	plt.savefig(fname)

def plot_delay(cfg):
	fname = BASE_DIR + '/plot_' + str(cfg['omega']) + '_' + str(cfg['sigma']) + '_avg_delay.png'
	df = pd.read_csv(logfiles.delay_file)
	df = df[(df['omega'] == cfg['omega']) & (df['sigma'] == cfg['sigma'])]
	# elimanate case when browser got stuck
	df = df[(df['delay'] < 11)]
	pdata = {'lolypop': [], 'bola': [], 'dashjs': []}
	for algo in algos:
		print algo
		#print df['algo']
		data = df[(df['algo'] == algo)]
		# elimanate case when browser got stuck
		# data = data[(data['delay'] < 25)]
		for i in range(nr_runs):
			if cfg['omega'] is 10 and (i+1) is 2:
				continue
			d = data[(data['run_nr'] == (i+1))]
			print d['delay'].mean()
			pdata[algo].append(d['delay'].mean())
	print pdata
	#plt.figure()
	text = '$\Omega = %.2f$' % float(float(cfg['omega'])/100)
	text = text + '\n'
	text = text + '$\Sigma = %.2f$' % float(float(cfg['sigma'])/100)
	fig, ax = plt.subplots()
	plt.xlabel('Algorithms')
	plt.ylabel('delay (s)')
	plt.title('Average delay')
	plt.boxplot([pdata['lolypop'], pdata['bola'], pdata['dashjs']])
	ax.set_xticklabels(algos, rotation=45)
	ax.text(0.1, 0.9,text, ha='center', va='center', transform=ax.transAxes)
	plt.tight_layout()
	plt.savefig(fname)

def get_configs():
	data = pd.read_csv(logfiles.downloads_file)
	#print data
	for index, row in data.iterrows():
		conf = {'omega': row['omega'], 'sigma': row['sigma']}
		if len(configs) is 0 or conf not in configs:
			configs.append(conf)
	print configs
	#b = data[(data['run_nr'] == 1)]
	b = data[(data['omega'] == 130)]
	print b


if __name__ == '__main__':
	logfiles = argparser.parse_args()
	get_configs()
	for i in range(len(configs)):
		plot_skipped_segment(configs[i])
		plot_quality_transitions(configs[i])
		plot_avg_quality(configs[i])
		plot_delay(configs[i])
#	plt.show()
	sys.exit(0)

