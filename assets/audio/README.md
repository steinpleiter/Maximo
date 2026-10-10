# Supplied audio

The six original MP3 files were supplied by the user. They are retained unchanged.

- `music000-background.mp3`: base-play loop, derived from `music000.mp3` starting at exactly **00:34**, as requested. Looping returns to that point rather than to the original introduction.
- `music001.mp3`: bonus music; crossfades in when a bonus begins and out after its result.
- `effects000.mp3` through `effects003.mp3`: concatenated effects banks. Selected clips and their source offsets are recorded in `cues.json`; analysis notes are in `CUES.md`.

The background derivative was made locally with:

```sh
ffmpeg -ss 34 -i music000.mp3 -map_metadata -1 -map_chapters -1 -c:a libmp3lame -q:a 3 music000-background.mp3
```

Audio starts after a click or keyboard interaction because browsers require user activation. The top-right Sound control and volume slider remain available during celebrations. Mute and volume persist between visits. Hidden tabs pause playback; returning resumes the current track. No audio is uploaded to a service.
