__author__ = "Zangue"

import subprocess
import time, sys

from random import shuffle

BASE_URL = "http://localhost:8080/samples/live-streaming"
URL = BASE_URL + "/%s?algo=%s&omega=%d&sigma=%d&test_nr=%d&run_nr=%d&delay=%d&report=1"

RUNS = 5
RUN_DURATION_SEC = 1 * 60

delays = [5]
sigmas = [3, 6, 1, 2, 4] # in %
omegas = [10, 20 , 30, 35, 50] # in %

assert len(sigmas) == len(omegas), "WTF!"

test_count = len(sigmas)

def open_chrome(url):
	cmd = ["google-chrome", "-incognito", "--new-window", url]
	sp = subprocess.Popen(cmd, stdout=subprocess.PIPE)
	#retval = sp.communicate()[0]
	#print sp.returncode
	#assert sp.returncode == 0 or 1, "Ran into an issue while opening chrome browser"
	#return sp.returncode

def close_chrome():
	sp = subprocess.Popen(["killall", "chrome"], stdout=subprocess.PIPE)
	retval = sp.communicate()[0]
	print sp.returncode
	assert sp.returncode == 0 or 1, "Ran into an issue while closing chrome browser"
    	return sp.returncode

# Test Start

if __name__ == "__main__":
	close_chrome()
	print "Start Testing ..."
	global algos
	algos = ['lolypop', 'bola', 'dashjs']
	tc = 0
	# For every config, run test x time
	while tc < test_count:
		count = 0
		omega = omegas[tc]
		sigma = sigmas[tc]
		delay = delays[0]
		print "Test config omega: %d - sigma: %d - delay: %d sec" % (omega, sigma, delay)
		print "%d run(s) for each algo" % RUNS
		while count < RUNS:
			# Test algo in random order each time
			print algos
			shuffle(algos)
			print algos
			for algo in algos:
				test_nr = tc+1
				run_nr = count+1
				url = URL % ("lolypop.html", algo, omega, sigma, test_nr, run_nr, delay)
				print "Test URL %s" % url		
				open_chrome(url)
				print "Run test for %d seconds" % RUN_DURATION_SEC
				time.sleep(RUN_DURATION_SEC)
				close_chrome()
				print "Test done. Sleep 5 seconds ..."
				time.sleep(5)
				print "Woke up, continuing ..."
			count = count + 1
		tc = tc + 1
	print "Testing done :)"
	sys.exit(0)
