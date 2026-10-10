# Audio cue analysis

The six source MP3s were supplied by the user. The four effects files are concatenated banks; no publisher cue/timing manifest was supplied. The app uses locally extracted excerpts, preserving the original banks.

## Method and limits

- Decoded all four banks locally to mono 24 kHz float PCM for analysis. Playback excerpts preserve the original stereo image.
- Detected silence at -45 dB for at least 150 ms, then split only gaps at least 300 ms. Added up to 25 ms onset padding and 60 ms tail padding.
- Generated and visually inspected indexed STFT spectrograms (512-sample window, 128-sample hop). Used transient shapes, harmonic bands, decay and repeated pulses to validate selected sound families.
- Ranked 34 candidate descriptions with [LAION CLAP](https://huggingface.co/laion/clap-htsat-unfused), running locally on Apple MPS. No audio was uploaded. Cosine scores are similarity ranks, not probabilities.
- Gameplay roles are inferred. “Coin” and “collect” share a family of short pitched chimes; precise publisher meanings cannot be recovered from a spectrogram alone. The train-like cue is tentative.
- Extracted short stereo MP3 files with 3 ms fade-in and 25 ms fade-out. No loudness normalization; runtime gain is in cues.json.

The gitignored `.context/audio-analysis/` directory contains reproducible scripts, full ranked results, raw analysis arrays and spectrogram sheets. `cues.json` records every selected source offset, length and reason.

## Selected app cues

| App cue | Bank | Start (s) | Length (s) | Inferred sound | Confidence |
|---|---|---:|---:|---|---|
| button | effects003.mp3 | 187.8785 | 0.4638 | Mechanical click | medium |
| spin | effects003.mp3 | 63.7043 | 0.2037 | Short whoosh | medium |
| land | effects000.mp3 | 104.7632 | 0.6427 | Landing thud | medium |
| collect | effects002.mp3 | 89.0745 | 0.6325 | Bright gem chime | medium |
| coin | effects002.mp3 | 84.8747 | 0.6586 | Coin-like chime | medium |
| upgrade | effects000.mp3 | 1.4953 | 4.6124 | Power-up flourish | medium |
| gunshot | effects002.mp3 | 150.9142 | 0.5955 | Sharp gunshot | medium |
| explosion | effects001.mp3 | 20.1718 | 3.9655 | Deep explosion | medium |
| crash | effects001.mp3 | 110.0750 | 1.4222 | Shattering impact | medium |
| win | effects002.mp3 | 72.7178 | 4.0813 | Win chime flourish | medium |
| bigWin | music000.mp3 | 34.0000 | 2.8500 | Original musical excerpt | source identified |
| bonus | effects003.mp3 | 84.7227 | 3.8792 | Bonus fanfare | medium |
| train | effects002.mp3 | 0.0000 | 8.1192 | Rhythmic train-like roll | low |
| powerUp | effects003.mp3 | 160.5331 | 3.9723 | Magic shimmer | medium |

## Full detected bank catalog

These 226 rows are inferred clip families. Gaps under 300 ms can leave multi-part effects grouped together. Longer music/celebration groups are intentionally not split into arbitrary beats. The app selects only the excerpts above.

| Segment | Start (s) | Length (s) | Top local classifier description | Cosine |
|---|---:|---:|---|---:|
| effects000_000 | 0.0000 | 1.0171 | A short magical rising sparkle sound for a game power up. | 0.4107 |
| effects000_001 | 1.4953 | 4.6124 | A short magical rising sparkle sound for a game power up. | 0.6158 |
| effects000_002 | 7.2921 | 1.7353 | An impact crashing and glass shattering. | 0.4569 |
| effects000_003 | 9.5072 | 1.7156 | An impact crashing and glass shattering. | 0.4648 |
| effects000_004 | 11.8471 | 1.7591 | A gun being fired with a loud sharp gunshot. | 0.4116 |
| effects000_005 | 14.1879 | 1.7183 | An impact crashing and glass shattering. | 0.4474 |
| effects000_006 | 16.5335 | 1.7144 | An impact crashing and glass shattering. | 0.4077 |
| effects000_007 | 18.8666 | 1.0472 | An impact crashing and glass shattering. | 0.5661 |
| effects000_008 | 20.9346 | 0.8846 | An impact crashing and glass shattering. | 0.3894 |
| effects000_009 | 23.1066 | 1.4659 | A cartoon character voice laughing or shouting. | 0.3100 |
| effects000_010 | 27.0219 | 2.1298 | A gun being fired with a loud sharp gunshot. | 0.4292 |
| effects000_011 | 29.9348 | 2.3391 | An impact crashing and glass shattering. | 0.2617 |
| effects000_012 | 33.0668 | 0.5809 | An impact crashing and glass shattering. | 0.5657 |
| effects000_013 | 35.4328 | 5.9603 | An impact crashing and glass shattering. | 0.5440 |
| effects000_014 | 41.9385 | 1.8698 | A fire crackling or fuse sizzling. | 0.3575 |
| effects000_015 | 44.6752 | 0.3916 | A dramatic brass horn sting. | 0.2979 |
| effects000_016 | 46.2183 | 0.4047 | An impact crashing and glass shattering. | 0.3592 |
| effects000_017 | 47.4626 | 0.8740 | An impact crashing and glass shattering. | 0.4817 |
| effects000_018 | 48.9832 | 2.4084 | An impact crashing and glass shattering. | 0.4438 |
| effects000_019 | 52.7795 | 1.3180 | An impact crashing and glass shattering. | 0.3997 |
| effects000_020 | 54.9900 | 4.5280 | A gun being fired with a loud sharp gunshot. | 0.5755 |
| effects000_021 | 59.7983 | 1.8208 | An impact crashing and glass shattering. | 0.4350 |
| effects000_022 | 62.4200 | 3.5852 | A video game cash register or coins jingling and clinking. | 0.3982 |
| effects000_023 | 66.9302 | 7.2246 | A triumphant musical fanfare or celebratory winning jingle. | 0.4247 |
| effects000_024 | 74.8530 | 17.0515 | A western banjo or guitar musical riff. | 0.3527 |
| effects000_025 | 92.5682 | 0.8149 | An impact crashing and glass shattering. | 0.2813 |
| effects000_026 | 95.6129 | 1.8030 | An impact crashing and glass shattering. | 0.2870 |
| effects000_027 | 99.1740 | 1.1086 | An impact crashing and glass shattering. | 0.2550 |
| effects000_028 | 102.7846 | 0.9884 | A cartoon character voice laughing or shouting. | 0.3000 |
| effects000_029 | 104.7632 | 0.6427 | A short low thud, wooden knock or object landing. | 0.5267 |
| effects000_030 | 105.7515 | 0.6779 | A horse neighing or galloping. | 0.4403 |
| effects000_031 | 106.8672 | 0.3713 | A short low thud, wooden knock or object landing. | 0.3621 |
| effects000_032 | 107.9073 | 0.7595 | A short low thud, wooden knock or object landing. | 0.3952 |
| effects000_033 | 108.9692 | 2.2472 | A fire crackling or fuse sizzling. | 0.4565 |
| effects000_034 | 113.0602 | 1.7294 | A fire crackling or fuse sizzling. | 0.3858 |
| effects000_035 | 115.0773 | 2.2605 | A horse neighing or galloping. | 0.3421 |
| effects000_036 | 118.1191 | 3.2820 | A horse neighing or galloping. | 0.3263 |
| effects000_037 | 122.8973 | 2.3100 | A fire crackling or fuse sizzling. | 0.5238 |
| effects000_038 | 126.3011 | 0.7058 | A human spoken voice speaking words. | 0.2881 |
| effects000_039 | 127.7083 | 2.7846 | A high pitched slide whistle or cartoon pitch bend. | 0.4888 |
| effects000_040 | 131.6911 | 0.7484 | A cartoon character voice laughing or shouting. | 0.5255 |
| effects000_041 | 133.1958 | 2.7808 | A high pitched slide whistle or cartoon pitch bend. | 0.4331 |
| effects000_042 | 136.7935 | 3.0523 | An impact crashing and glass shattering. | 0.3122 |
| effects000_043 | 140.3317 | 0.3583 | A sharp click or mechanical button switch. | 0.3749 |
| effects000_044 | 141.0775 | 0.3334 | A short low thud, wooden knock or object landing. | 0.4765 |
| effects000_045 | 141.8268 | 0.3232 | A sharp click or mechanical button switch. | 0.4068 |
| effects000_046 | 142.5729 | 0.3672 | A sharp click or mechanical button switch. | 0.3769 |
| effects000_047 | 143.3299 | 3.0259 | A cartoon character voice laughing or shouting. | 0.4099 |
| effects000_048 | 148.9310 | 2.2885 | A cartoon bird chirping or squawking. | 0.4255 |
| effects000_049 | 153.9835 | 2.6928 | A high pitched slide whistle or cartoon pitch bend. | 0.3837 |
| effects000_050 | 159.0355 | 2.6905 | A siren or warning alarm sounding. | 0.5576 |
| effects000_051 | 164.0793 | 1.2659 | An impact crashing and glass shattering. | 0.3537 |
| effects000_052 | 165.9190 | 1.8935 | A fire crackling or fuse sizzling. | 0.4235 |
| effects000_053 | 168.5152 | 3.5585 | An impact crashing and glass shattering. | 0.3969 |
| effects000_054 | 173.4467 | 2.2234 | An impact crashing and glass shattering. | 0.6270 |
| effects000_055 | 176.6321 | 2.0375 | An impact crashing and glass shattering. | 0.3586 |
| effects000_056 | 179.1677 | 2.0470 | An impact crashing and glass shattering. | 0.4110 |
| effects001_000 | 0.0000 | 3.0874 | A gun being fired with a loud sharp gunshot. | 0.5076 |
| effects001_001 | 4.3445 | 2.7735 | An impact crashing and glass shattering. | 0.4725 |
| effects001_002 | 8.7000 | 3.4609 | A fire crackling or fuse sizzling. | 0.4570 |
| effects001_003 | 12.3767 | 0.8171 | An impact crashing and glass shattering. | 0.4451 |
| effects001_004 | 13.4563 | 1.8032 | A fire crackling or fuse sizzling. | 0.5349 |
| effects001_005 | 16.8667 | 2.6578 | A gun being fired with a loud sharp gunshot. | 0.4715 |
| effects001_006 | 20.1718 | 3.9655 | A dynamite bomb explosion with a deep rumbling blast. | 0.5135 |
| effects001_007 | 25.2368 | 4.7451 | A dynamite bomb explosion with a deep rumbling blast. | 0.4077 |
| effects001_008 | 31.2793 | 3.5952 | A fire crackling or fuse sizzling. | 0.4624 |
| effects001_009 | 35.7553 | 3.0092 | An impact crashing and glass shattering. | 0.4786 |
| effects001_010 | 40.3069 | 3.9145 | An impact crashing and glass shattering. | 0.6324 |
| effects001_011 | 45.2919 | 2.6103 | An impact crashing and glass shattering. | 0.4202 |
| effects001_012 | 48.7925 | 2.8338 | A high pitched slide whistle or cartoon pitch bend. | 0.4407 |
| effects001_013 | 52.0486 | 14.4452 | An impact crashing and glass shattering. | 0.3649 |
| effects001_014 | 67.8716 | 1.3910 | A sharp click or mechanical button switch. | 0.4434 |
| effects001_015 | 71.7738 | 3.1305 | An impact crashing and glass shattering. | 0.4991 |
| effects001_016 | 76.5840 | 1.7727 | An impact crashing and glass shattering. | 0.5203 |
| effects001_017 | 78.7603 | 5.0385 | A triumphant musical fanfare or celebratory winning jingle. | 0.4241 |
| effects001_018 | 85.2099 | 1.8103 | An impact crashing and glass shattering. | 0.5668 |
| effects001_019 | 88.0097 | 1.8081 | An impact crashing and glass shattering. | 0.5536 |
| effects001_020 | 91.3096 | 1.8647 | An impact crashing and glass shattering. | 0.5386 |
| effects001_021 | 94.0985 | 0.7748 | A gun being fired with a loud sharp gunshot. | 0.4688 |
| effects001_022 | 96.1479 | 1.3205 | An impact crashing and glass shattering. | 0.6294 |
| effects001_023 | 97.7068 | 5.8454 | A horse neighing or galloping. | 0.4540 |
| effects001_024 | 104.8527 | 1.0146 | An impact crashing and glass shattering. | 0.6679 |
| effects001_025 | 106.6537 | 2.3040 | An impact crashing and glass shattering. | 0.3340 |
| effects001_026 | 110.0750 | 1.4222 | An impact crashing and glass shattering. | 0.6882 |
| effects001_027 | 112.1239 | 3.1779 | A video game cash register or coins jingling and clinking. | 0.4263 |
| effects001_028 | 116.7405 | 5.1360 | An impact crashing and glass shattering. | 0.4126 |
| effects001_029 | 123.6635 | 1.1930 | A short low thud, wooden knock or object landing. | 0.4557 |
| effects001_030 | 125.0823 | 3.7586 | An impact crashing and glass shattering. | 0.3623 |
| effects001_031 | 129.5026 | 0.9681 | An impact crashing and glass shattering. | 0.4686 |
| effects001_032 | 130.8462 | 5.1252 | A triumphant musical fanfare or celebratory winning jingle. | 0.2960 |
| effects001_033 | 136.4292 | 1.5168 | An impact crashing and glass shattering. | 0.5782 |
| effects001_034 | 139.1467 | 0.8778 | An impact crashing and glass shattering. | 0.3579 |
| effects001_035 | 140.9389 | 1.3189 | An impact crashing and glass shattering. | 0.5683 |
| effects001_036 | 143.8118 | 2.0722 | An impact crashing and glass shattering. | 0.4982 |
| effects001_037 | 147.8445 | 1.1660 | An impact crashing and glass shattering. | 0.5204 |
| effects001_038 | 150.2079 | 1.2487 | A whoosh of air or fast swoosh movement. | 0.4795 |
| effects001_039 | 152.5556 | 0.2303 | A whoosh of air or fast swoosh movement. | 0.5656 |
| effects001_040 | 154.2797 | 1.1426 | A high pitched slide whistle or cartoon pitch bend. | 0.5054 |
| effects001_041 | 155.6767 | 5.2518 | A cartoon character voice laughing or shouting. | 0.2732 |
| effects001_042 | 161.2017 | 0.2364 | A high pitched slide whistle or cartoon pitch bend. | 0.4699 |
| effects001_043 | 161.7085 | 0.3710 | A short low thud, wooden knock or object landing. | 0.4380 |
| effects001_044 | 162.6748 | 3.6932 | A high pitched slide whistle or cartoon pitch bend. | 0.3411 |
| effects001_045 | 167.0674 | 2.9406 | An impact crashing and glass shattering. | 0.4801 |
| effects001_046 | 171.1281 | 2.6659 | An impact crashing and glass shattering. | 0.4190 |
| effects001_047 | 175.1710 | 2.6304 | A siren or warning alarm sounding. | 0.3949 |
| effects001_048 | 178.5942 | 2.1399 | An impact crashing and glass shattering. | 0.4152 |
| effects002_000 | 0.0000 | 8.1192 | A steam train blowing its whistle and chugging. | 0.4302 |
| effects002_001 | 9.0914 | 0.8372 | An impact crashing and glass shattering. | 0.5608 |
| effects002_002 | 10.3934 | 0.6271 | An impact crashing and glass shattering. | 0.6507 |
| effects002_003 | 12.4429 | 1.7139 | An impact crashing and glass shattering. | 0.5578 |
| effects002_004 | 15.4930 | 1.5055 | An impact crashing and glass shattering. | 0.4477 |
| effects002_005 | 18.1769 | 3.3270 | A horse neighing or galloping. | 0.5787 |
| effects002_006 | 23.2351 | 2.3479 | A high pitched slide whistle or cartoon pitch bend. | 0.4245 |
| effects002_007 | 26.2231 | 1.4943 | An impact crashing and glass shattering. | 0.3418 |
| effects002_008 | 29.2454 | 1.6430 | An impact crashing and glass shattering. | 0.4543 |
| effects002_009 | 31.7585 | 1.3988 | A high pitched slide whistle or cartoon pitch bend. | 0.3424 |
| effects002_010 | 33.3770 | 0.6437 | A splash of water or liquid bubbling. | 0.4226 |
| effects002_011 | 35.5389 | 1.3002 | An impact crashing and glass shattering. | 0.4319 |
| effects002_012 | 38.0180 | 1.4440 | A high pitched slide whistle or cartoon pitch bend. | 0.2913 |
| effects002_013 | 40.8685 | 1.5469 | A fire crackling or fuse sizzling. | 0.4913 |
| effects002_014 | 43.2749 | 1.2595 | An impact crashing and glass shattering. | 0.3822 |
| effects002_015 | 44.8472 | 1.4367 | A splash of water or liquid bubbling. | 0.3713 |
| effects002_016 | 46.7860 | 2.9907 | An impact crashing and glass shattering. | 0.4301 |
| effects002_017 | 50.8371 | 6.2620 | A triumphant musical fanfare or celebratory winning jingle. | 0.4234 |
| effects002_018 | 58.1416 | 5.0325 | A triumphant musical fanfare or celebratory winning jingle. | 0.4432 |
| effects002_019 | 64.6850 | 5.1141 | A triumphant musical fanfare or celebratory winning jingle. | 0.4468 |
| effects002_020 | 71.2429 | 1.1094 | A gun being fired with a loud sharp gunshot. | 0.3218 |
| effects002_021 | 72.7178 | 4.0813 | A short magical rising sparkle sound for a game power up. | 0.5711 |
| effects002_022 | 77.8542 | 5.1198 | A triumphant musical fanfare or celebratory winning jingle. | 0.4039 |
| effects002_023 | 83.8281 | 0.5996 | A video game cash register or coins jingling and clinking. | 0.3740 |
| effects002_024 | 84.8747 | 0.6586 | A video game cash register or coins jingling and clinking. | 0.4493 |
| effects002_025 | 85.9231 | 0.6718 | A video game cash register or coins jingling and clinking. | 0.4113 |
| effects002_026 | 86.9731 | 0.6406 | A video game cash register or coins jingling and clinking. | 0.4328 |
| effects002_027 | 88.0285 | 0.6493 | A short bright electronic ding or bell chime for collecting a gem in a video game. | 0.4324 |
| effects002_028 | 89.0745 | 0.6325 | A short bright electronic ding or bell chime for collecting a gem in a video game. | 0.4816 |
| effects002_029 | 90.1240 | 0.6795 | A short bright electronic ding or bell chime for collecting a gem in a video game. | 0.4481 |
| effects002_030 | 91.1724 | 0.6454 | A video game cash register or coins jingling and clinking. | 0.4613 |
| effects002_031 | 92.2270 | 0.6791 | A video game cash register or coins jingling and clinking. | 0.4357 |
| effects002_032 | 93.2744 | 0.5901 | A laser zap or science fiction electronic effect. | 0.4046 |
| effects002_033 | 94.3236 | 0.6463 | A short bright electronic ding or bell chime for collecting a gem in a video game. | 0.4114 |
| effects002_034 | 95.3731 | 0.6132 | A video game cash register or coins jingling and clinking. | 0.3443 |
| effects002_035 | 96.4285 | 0.5672 | A short bright electronic ding or bell chime for collecting a gem in a video game. | 0.3963 |
| effects002_036 | 97.4748 | 0.6241 | A video game cash register or coins jingling and clinking. | 0.4006 |
| effects002_037 | 98.5238 | 0.6400 | A video game cash register or coins jingling and clinking. | 0.4303 |
| effects002_038 | 99.5736 | 0.6495 | A video game cash register or coins jingling and clinking. | 0.4625 |
| effects002_039 | 100.6275 | 0.6615 | A video game cash register or coins jingling and clinking. | 0.4290 |
| effects002_040 | 101.6747 | 0.6178 | A video game cash register or coins jingling and clinking. | 0.4394 |
| effects002_041 | 102.7234 | 0.6592 | A video game cash register or coins jingling and clinking. | 0.4461 |
| effects002_042 | 103.7743 | 0.5968 | A video game cash register or coins jingling and clinking. | 0.4491 |
| effects002_043 | 104.8273 | 6.5010 | A triumphant musical fanfare or celebratory winning jingle. | 0.4157 |
| effects002_044 | 111.7831 | 2.6594 | A high pitched slide whistle or cartoon pitch bend. | 0.4808 |
| effects002_045 | 115.3230 | 1.3535 | An impact crashing and glass shattering. | 0.4939 |
| effects002_046 | 117.8890 | 4.2213 | An impact crashing and glass shattering. | 0.3427 |
| effects002_047 | 123.3187 | 4.2555 | A high pitched slide whistle or cartoon pitch bend. | 0.3398 |
| effects002_048 | 128.5613 | 3.4112 | An impact crashing and glass shattering. | 0.3252 |
| effects002_049 | 132.9758 | 3.9599 | A splash of water or liquid bubbling. | 0.3004 |
| effects002_050 | 138.8111 | 3.0750 | An impact crashing and glass shattering. | 0.2808 |
| effects002_051 | 142.7621 | 1.2080 | An impact crashing and glass shattering. | 0.4928 |
| effects002_052 | 145.2285 | 0.6670 | An impact crashing and glass shattering. | 0.5135 |
| effects002_053 | 146.7647 | 2.2969 | An impact crashing and glass shattering. | 0.6256 |
| effects002_054 | 150.9142 | 0.5955 | A gun being fired with a loud sharp gunshot. | 0.5913 |
| effects002_055 | 152.8676 | 1.6622 | A gun being fired with a loud sharp gunshot. | 0.5478 |
| effects002_056 | 154.9150 | 1.5903 | A gun being fired with a loud sharp gunshot. | 0.4629 |
| effects002_057 | 156.9783 | 1.4781 | A gun being fired with a loud sharp gunshot. | 0.5440 |
| effects002_058 | 158.9715 | 3.1227 | A gun being fired with a loud sharp gunshot. | 0.5813 |
| effects002_059 | 163.1162 | 0.9166 | A gun being fired with a loud sharp gunshot. | 0.6104 |
| effects002_060 | 165.1657 | 1.0610 | A gun being fired with a loud sharp gunshot. | 0.5878 |
| effects002_061 | 167.2184 | 1.8346 | A gun being fired with a loud sharp gunshot. | 0.5312 |
| effects002_062 | 169.5158 | 8.5045 | A gun being fired with a loud sharp gunshot. | 0.4625 |
| effects002_063 | 180.0333 | 2.2124 | A high pitched slide whistle or cartoon pitch bend. | 0.3151 |
| effects003_000 | 0.0000 | 23.4967 | A triumphant musical fanfare or celebratory winning jingle. | 0.3582 |
| effects003_001 | 24.4145 | 7.2200 | A triumphant musical fanfare or celebratory winning jingle. | 0.3862 |
| effects003_002 | 32.4150 | 0.8826 | An impact crashing and glass shattering. | 0.5354 |
| effects003_003 | 34.1077 | 1.3762 | An impact crashing and glass shattering. | 0.5582 |
| effects003_004 | 36.0385 | 3.0622 | An impact crashing and glass shattering. | 0.4195 |
| effects003_005 | 40.1900 | 3.6415 | A gun being fired with a loud sharp gunshot. | 0.5651 |
| effects003_006 | 45.1169 | 1.7767 | A high pitched slide whistle or cartoon pitch bend. | 0.3864 |
| effects003_007 | 47.9961 | 1.0125 | A gun being fired with a loud sharp gunshot. | 0.3777 |
| effects003_008 | 50.5453 | 0.5652 | An impact crashing and glass shattering. | 0.3392 |
| effects003_009 | 52.0074 | 0.9504 | A gun being fired with a loud sharp gunshot. | 0.3749 |
| effects003_010 | 54.0996 | 0.4216 | An impact crashing and glass shattering. | 0.3925 |
| effects003_011 | 56.4922 | 0.4100 | An impact crashing and glass shattering. | 0.4238 |
| effects003_012 | 58.5754 | 0.7254 | A gun being fired with a loud sharp gunshot. | 0.4479 |
| effects003_013 | 60.2594 | 0.3524 | An impact crashing and glass shattering. | 0.3688 |
| effects003_014 | 61.3185 | 0.5221 | An impact crashing and glass shattering. | 0.3605 |
| effects003_015 | 62.3637 | 0.5923 | An impact crashing and glass shattering. | 0.3925 |
| effects003_016 | 63.7043 | 0.2037 | A whoosh of air or fast swoosh movement. | 0.5810 |
| effects003_017 | 64.6374 | 0.5706 | A cartoon character voice laughing or shouting. | 0.3706 |
| effects003_018 | 70.7397 | 0.9647 | A laser zap or science fiction electronic effect. | 0.4885 |
| effects003_019 | 71.9778 | 0.8985 | A high pitched slide whistle or cartoon pitch bend. | 0.4746 |
| effects003_020 | 73.1755 | 7.7185 | A triumphant musical fanfare or celebratory winning jingle. | 0.4058 |
| effects003_021 | 81.6677 | 2.1155 | A gun being fired with a loud sharp gunshot. | 0.5565 |
| effects003_022 | 84.7227 | 3.8792 | A triumphant musical fanfare or celebratory winning jingle. | 0.3988 |
| effects003_023 | 88.8675 | 0.1955 | A short low thud, wooden knock or object landing. | 0.3958 |
| effects003_024 | 89.3155 | 1.0927 | An impact crashing and glass shattering. | 0.5964 |
| effects003_025 | 91.0672 | 2.1627 | A horse neighing or galloping. | 0.6298 |
| effects003_026 | 95.1169 | 1.7345 | An impact crashing and glass shattering. | 0.4063 |
| effects003_027 | 98.1895 | 1.0667 | A splash of water or liquid bubbling. | 0.5645 |
| effects003_028 | 99.6065 | 2.4935 | An impact crashing and glass shattering. | 0.4293 |
| effects003_029 | 102.7875 | 6.8383 | An impact crashing and glass shattering. | 0.4617 |
| effects003_030 | 111.4915 | 1.0076 | An impact crashing and glass shattering. | 0.6472 |
| effects003_031 | 113.1777 | 1.3289 | An impact crashing and glass shattering. | 0.4160 |
| effects003_032 | 114.9777 | 1.3289 | An impact crashing and glass shattering. | 0.4251 |
| effects003_033 | 116.7839 | 2.5245 | An impact crashing and glass shattering. | 0.4455 |
| effects003_034 | 120.3344 | 3.0124 | An impact crashing and glass shattering. | 0.4830 |
| effects003_035 | 124.8881 | 3.0165 | An impact crashing and glass shattering. | 0.5880 |
| effects003_036 | 129.4168 | 1.4085 | An impact crashing and glass shattering. | 0.4880 |
| effects003_037 | 132.4663 | 1.2346 | An impact crashing and glass shattering. | 0.5128 |
| effects003_038 | 135.5244 | 2.6827 | An impact crashing and glass shattering. | 0.5112 |
| effects003_039 | 139.5637 | 2.6371 | A siren or warning alarm sounding. | 0.3769 |
| effects003_040 | 142.9910 | 2.1528 | An impact crashing and glass shattering. | 0.4015 |
| effects003_041 | 146.3543 | 3.2797 | An impact crashing and glass shattering. | 0.5573 |
| effects003_042 | 151.4073 | 8.1515 | A steam train blowing its whistle and chugging. | 0.4114 |
| effects003_043 | 160.5331 | 3.9723 | A short magical rising sparkle sound for a game power up. | 0.4871 |
| effects003_044 | 165.5874 | 5.6971 | A short magical rising sparkle sound for a game power up. | 0.5721 |
| effects003_045 | 171.9450 | 3.6299 | A high pitched slide whistle or cartoon pitch bend. | 0.5407 |
| effects003_046 | 175.9312 | 0.9655 | An impact crashing and glass shattering. | 0.5296 |
| effects003_047 | 177.6431 | 1.6448 | An impact crashing and glass shattering. | 0.5122 |
| effects003_048 | 180.4880 | 0.9773 | An impact crashing and glass shattering. | 0.4505 |
| effects003_049 | 182.5384 | 1.7598 | An impact crashing and glass shattering. | 0.6341 |
| effects003_050 | 184.6903 | 1.7643 | An impact crashing and glass shattering. | 0.6004 |
| effects003_051 | 186.8355 | 0.3776 | A splash of water or liquid bubbling. | 0.4218 |
| effects003_052 | 187.8785 | 0.4638 | A sharp click or mechanical button switch. | 0.5348 |
| effects003_053 | 188.9253 | 0.7092 | An impact crashing and glass shattering. | 0.5692 |
| effects003_054 | 190.6340 | 1.2407 | A whoosh of air or fast swoosh movement. | 0.5206 |
| effects003_055 | 192.2987 | 1.3107 | A whoosh of air or fast swoosh movement. | 0.4100 |

## User correction: big win cue

The original `bigWin` mapping (`effects002.mp3`, 58.1416–63.1741s) was
misclassified: the user identified it as a bird death sound. It is rejected
for wins. The replacement is actual audio from `music000.mp3`, 34.00–36.85s,
from the musical section the user selected. Only short onset/tail fades are
applied; there is no synthesis or pitch shifting. The original bank catalog
preserves classifier output as an audit, not a verified label.

Big, Super, Mega, Epic, Gold Rush and bonus-result celebrations all use the
corrected cue, including their no-wager previews.
