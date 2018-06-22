const _langs = {
  server: {
    domain: "wmccpool.com"
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
        zero: '',
        kilo: 'Thousand',
        mega: 'Million',
        giga: 'Billion',
        tera: 'Trillion',
        peta: 'Quadrillion',
        exa: 'Quintillion',
        zetta: 'Sextillion',
        yotta: 'Septillion'
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
      recommended: "Recommended"
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
      output: "Output"
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