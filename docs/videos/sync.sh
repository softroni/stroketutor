#!/bin/zsh
# sync.sh <project> [<project> ...]: copy a promotion video's source from .studio/<project> (where it is made,
# beside its recordings, voices, music and renders) into docs/videos/<project>, so git keeps it. Media and builds
# stay behind (sync-excludes.txt); a file deleted in .studio is deleted here too. Commit what changed afterwards.
set -eu
here=${0:A:h}
studio=${here:h:h}/.studio
(( $# > 0 )) || { echo "usage: docs/videos/sync.sh <project> [<project> ...]   (folders in .studio, e.g. whats-new-1.1)"; exit 2; }
for project in "$@"; do
  [[ -d $studio/$project/video/src ]] || { echo "$project: no .studio/$project/video/src"; exit 1; }
  rsync -a --delete --exclude-from=$here/sync-excludes.txt $studio/$project/ $here/$project/
  echo "$project: $(find $here/$project -type f | wc -l | tr -d ' ') files, $(du -sh $here/$project | cut -f1)"
done
