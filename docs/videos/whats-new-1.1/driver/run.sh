#!/bin/zsh
# run.sh <udid> "<script>" [out.mp4]: plays a driver script on the simulator,
# recording the screen to out.mp4 when given. Writes out.log (the test's STEP and
# MARK lines) and out.start (the unix time the recording started).
set -u
udid=$1 script=$2 out=${3:-}
D=${0:A:h}
xctestrun=$(ls $D/dd/Build/Products/*.xctestrun | head -1)
now() { python3 -c 'import time; print(f"{time.time():.3f}")'; }
if [[ -n $out ]]; then
  rm -f $out
  xcrun simctl io $udid recordVideo --codec=h264 --force $out 2> $out.rec.err &
  rec=$!
  for i in {1..100}; do grep -q "Recording started" $out.rec.err 2>/dev/null && break; sleep 0.1; done
  now > $out.start
fi
log=${out:-$D/last}.log
TEST_RUNNER_STSCRIPT="$script" xcodebuild test-without-building -xctestrun $xctestrun \
  -destination "id=$udid" -only-testing:DriverUITests/Driver/testScript > $log.full 2>&1
rc=$?
grep -E "^(STEP|MARK) " $log.full > $log
if [[ -n $out ]]; then
  sleep 0.5; kill -INT $rec; wait $rec 2>/dev/null
fi
grep -q "TEST SUCCEEDED\|Test Suite .* passed" $log.full && echo "passed" || { echo "FAILED ($rc)"; grep -E "error|Not found|failed" $log.full | head -5; }
