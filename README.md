# wmcc-miningpool (WorldMobileCoin - Public Mining Pool)

This is an ALPHA Release (unstable version) of WMCC-MiningPool.

## Requirement
- [Node JS](https://nodejs.org/en/) >= 8.0.0
- [WMCC Desktop Application](https://worldmobilecoin.com/#downloads) >= 1.0.1-beta.1
- [Asar - Electron Archive](https://github.com/electron/asar)
- [GIT](https://git-scm.com/downloads)

## Installation

### Clone:
```
git clone https://github.com/WorldMobileCoin/wmcc-miningpool.git
```

### Compile:
```
asar pack wmcc-miningpool [WMCC-DESKTOP_PATH]\resources\plugin\wmcc-miningpool.asar

Windows Example:
asar pack wmcc-miningpool C:\Users\[USERNAME]\AppData\Local\Programs\wmcc-desktop\resources\plugin\wmcc-miningpool.asar
```

### Configuration:
[See configuration example](https://github.com/WorldMobileCoin/wmcc-miningpool/tree/master/example)  
Put config.json into [WMCC-DESKTOP_DATAPATH]/miningpool/data directory.

Windows example:  
C:/Users/[USERNAME]/.wmcc/miningpool/data

### Using SSL
If SSL is enable, place your certificate file into [WMCC-DESKTOP_DATAPATH]/miningpool directory.

Windows example:  
C:/Users/[USERNAME]/.wmcc/miningpool/cert.pem  
C:/Users/[USERNAME]/.wmcc/miningpool/key.pem

### Restart WMCC-Desktop Application
You need to restart or relogin WMCC-Desktop Application every time you make a change.

## Official Website
http://www.worldmobilecoin.com/

## Disclaimer

WorldMobileCoin does not guarantee you against theft or lost funds due to bugs, mishaps,
or your own incompetence. You and you alone are responsible for securing your money.

## Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your code
to be distributed under the MIT license. You are also implicitly verifying that
all code is your original work.

## License

> Copyright (c) 2017, Park Alter (pseudonym)  
> Distributed under the MIT software license, see the accompanying  
> file COPYING or http://www.opensource.org/licenses/mit-license.php 
