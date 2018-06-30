const _langs = {
  server: {
    domain: "wmccpool.com",
    host: "stratum+tcp://wmccpool.com"
  },
  title: {
    siteTitle: "WMCC Public Pool |",
    menuTitle: "WMCC Pool"
  },
  global: {
    plural: true,
    date: {
      plural: true,
      year: "Year",
      month: "Month",
      week: "Week",
      day: "Day",
      hour: "Hour",
      minute: "Minute",
      second: "Second",
      ago: "ago",
      justNow: "Just now"
    },
    size: {
      number: {
        k: "k",
        m: "M",
        g: "B",
        t: "T",
        p: "P",
        e: "E",
        z: "Z",
        y: "Y",
        zero: "",
        kilo: "Thousand",
        mega: "Million",
        giga: "Billion",
        tera: "Trillion",
        peta: "Quadrillion",
        exa: "Quintillion",
        zetta: "Sextillion",
        yotta: "Septillion"
      },
      byte: {
        bytes: "Bytes",
        kb: "KB",
        mb: "MB",
        gb: "GB",
        tb: "TB",
        pb: "PB",
        eb: "EB",
        zb: "ZB",
        yb: "YB",
        perTime: "/sec"
      },
      hash: {
        hashes: "Hashes",
        kh: "KH",
        mh: "MH",
        gh: "GH",
        th: "TH",
        ph: "PH",
        eh: "EH",
        zh: "ZH",
        yh: "YH",
        perTime: "/sec"
      },
      share: {
        shares: "Shares",
        ks: "KS",
        ms: "MS",
        gs: "GS",
        ts: "TS",
        ps: "PS",
        es: "ES",
        zs: "ZS",
        ys: "YM",
        perTime: "/min"
      }
    },
    yes: "Yes",
    no: "No",
    true: {
      uppercase: "TRUE",
      capital: "True"
    },
    false: {
      uppercase: "FALSE",
      capital: "False"
    }
  },
  menu: {
    sidebar: {
      general: "General",
      home: "Home",
      miner: "Miner",
      getStarted: "Get Started",
      connectionDetails: "Connection Details",
      miningApps: "Mining Application",
      terms: "Terms",
      poolBlocks: "Pool Blocks",
      monitoring: "Monitoring",
      payments: "Payments",
      paymentRecords: "Payment Records",
      yourPayments: "Your Payments",
      support: "Support"
    }
  },
  home: {
    global: {
      stats: "Stats",
      hashRate: "Hash Rate",
      sharesDiff1: "Share of Difficulty 1",
      perSec: "/sec",
      blockFound: "Block Found"
    },
    pool: {
      pool: "Pool",
      connected: "Connected",
      miner: "Miner",
      poolFee: "Pool Fee",
      perBlockFound: "Per Block Found",
      foundAverage: "Found Average",
      perBlock: "Per Block",
      totalFound: "Total Found",
      block: "Block"
    },
    network: {
      network: "Network",
      difficulty: "Difficulty",
      blockChain: "Blockchain",
      height: "Height",
      lastReward: "Last Reward",
      wmcc: "WMCC",
      blockTips: "Block Tips",
      hash: "Hash",
      refreshIn: "Refresh in"
    },
    announcement: {
      announcement: "Announcement",
      poolNoticeboard: "Pool Noticeboard"
    },
    poolConfig: {
      poolConfiguration: "Pool Configuration",
      fee: "Pool Fee",
      founderReward: "Block Founder Reward",
      threshold: "Payout Threshold",
      confirmation: "Block Maturity Depth"
    }
  },
  poolActivity: {
    poolActivities: "Pool Activities",
    minedBlocksBy: "Mined blocks by",
    blockMinedForLast: "Block mined for last",
    hours: "hours"
  },
  miner: {
    getStarted: {
      gettingStarted: "Getting Started",
      userGuide: "User Guide",
      prerequisite: "Prerequisite",
      content: {
        tag: "li",
        array: [
          "The following is a quick start guide of mining WMCC on Windows 7 or greater x64.",
          "To mine WMCC you need a WMCC Account and mining device - Baikal, GPU or CPU.",
          "Or rent hashing power on [[https://www.nicehash.com]](NiceHash), [[https://www.miningrigrentals.com]](MiningRigRentals) or any miner rig that support X15 algorithm and point it to a pool.",
          "You can get WMCC Account by download [[https://worldmobilecoin.com/#downloads]](WMCC Desktop Application) or you can use [[https://github.com/WorldMobileCoin/wmcc-daemon]](WMCC Daemon) (for advanced user)."
        ]
      }
    },
    connectionDetail: {
      connectionDetails: "Connection Details",
      poolConfiguration: "Pool Configuration",
      miningPorts: "Mining Ports",
      port: "Port",
      initialDifficulty: "Initial Difficulty:",
      dynamicDifficulty: "Dynamic Difficulty:",
      description: "Description:",
      recommended: "Recommended",
      serverHostName: "Server Hostname"
    },
    miningApp: {
      miningApplication: "Mining Application",
      cpuGpuBaikal: "CPU, GPU and Baikal",
      guidelineToStart: "This is a small guideline for anyone who wants to start mining with wmccpool.com!",
      cpu: {
        title: "CPU",
        descriptions: {
          tag: "li",
          array: [
            "For CPU user, you can easly mine WMCC by press Start Mining (solo mining) button on WMCC Desktop Application.",
            "Currently, we dont support CPU pool mining for built-in client. You can use any external CPU mining application that support X15 Algorithm."
          ]
        }
      },
      gpu: {
        title: "GPU",
        downloadLink: "Download Link",
        command: "Command:",
        example: "Example:",
        descriptions: {
          tag: "li",
          array: [
            "For GPU miner, WMCC can be mined by one of the mining applications below.",
            "Choose mining application suit to your GPU version."
          ]
        },
        amd: {
          title: "AMD - SGminer",
          links: {
            tag: "li",
            array: [
              "[[https://github.com/nicehash/sgminer/releases]](https://github.com/nicehash/sgminer/releases)",
              "[[https://cryptomining-blog.com/?s=x15+sgminer]](https://cryptomining-blog.com/?s=x15+sgminer)"
            ]
          },
          command: "sgminer --algorithm bitblock -o [HOSTNAME]:[PORT] -u [WMCC_ADDRESS] -p [PASSWORD]",
          example: "sgminer --algorithm bitblock -o stratum+tcp://wmccpool.com:5880 -u wc1qzvpmtyzptxusxf7vqvymvp8qphkjhm7uwz6jyu -p x"
        },
        nvidia: {
          title: "NVIDIA - CCminer",
          links: {
            tag: "li",
            array: [
              "[[https://cryptomining-blog.com/?s=x15+ccminer]](https://cryptomining-blog.com/?s=x15+ccminer)",
            ]
          },
          command: "ccminer -a x15 -o [HOSTNAME]:[PORT] -u [WMCC_ADDRESS] -p [PASSWORD]",
          example: "ccminer -a x15 -o stratum+tcp://wmccpool.com:5880 -u wc1qzvpmtyzptxusxf7vqvymvp8qphkjhm7uwz6jyu -p x"
        },
      },
      baikal: {
        title: "Baikal",
        descriptions: {
          tag: "li",
          array: [
            "For Baikal miner, you can login web interface and setup baikal as following:"
          ]
        },
        settings: {
          tag: "li",
          array: [
            "URL: [HOSTNAME]:[PORT]",
            "Algo: x15",
            "User: [WMCC_ADDRESS]",
            "Pass: [PASSWORD]",
            "Extranonce: Uncheck"
          ]
        }
      },
      note: {
        title: "Note",
        descriptions: {
          tag: "li",
          array: [
            "Replace [HOSTNAME] and [PORT], refer to Connection Details section.",
            "You then need to change [WMCC_ADDRESS] and [PASSWORD] to reflect your own account.",
            "Default password is x (lowercase)."
          ]
        }
      }
    }
  },
  payments: {
    title: {
      payment: "Payment",
      records: "Records",
      generalInfo: "General Info",
      paymentsMade: "Payments Made"
    },
    table: {
      timeSent: "Time Sent",
      transactionHash: "Transaction Hash",
      amount: "Amount",
      payout: "Payout"
    }
  },
  payouts: {
    title: {
      yourPayment: "Your Payment",
      records: "Records",
      payoutHistory: "Payout History"
    },
    form: {
      enterYourAddress: "Enter Your Adress:",
      search: "Search"
    },
    table: {
      timeSent: "Time Sent",
      transactionHash: "Transaction Hash",
      amount: "Amount",
      diff1Share: "Diff1 Share",
      payoutThreshold: "Payout Threshold"
    },
    summary: {
      blockchainTip: "Blockchain Tip",
      currentBlockchainHeight: "Current blockchain height.",
      latestFoundBlockAge: "Latest found block age.",
      averageTimeToFindOneBlock: "Average time to find one block.",
      totalBlockFoundbyPool: "Total block found by pool."
    }
  },
  blocks: {
    title: {
      poolBlock: "Pool Block",
      records: "Records",
      blockFoundBy: "Block found by"
    },
    table: {
      status: "Status",
      blockAge: "Block Age",
      blockHight: "Block Height",
      mergedToBlock: "Merged to Block",
      blockHash: "Block Hash",
      totalDiff1Share: "Total Diff1 Share",
      rewards: "Rewards"
    },
    status: {
      valid: "Valid",
      pending: "Pending",
      staled: "Staled"
    }
  }
}