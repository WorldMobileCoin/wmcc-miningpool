function WMCC_Events () {
  const self = this;

  this.timers = [];
  this.tableIds = [];
  this.tableListeners = [];
  this.sharesTime = [];

  /**
   * SERVER SIDE EVENTS
   */
  this.s_pool_stats = function(data) {
    self.setDataEvent(data, 'pool_stats');
  }

  this.s_network_stats = function(data) {
    self.setDataEvent(data, 'network_stats');
  }

  this.s_update_stats = function(next) {
    const events = function() {
      IO.emit('c_network_stats');
      IO.emit('c_pool_stats');
      IO.emit('c_update_stats');
    };

    let count = Math.floor(next/1000)-1;
    const loop = setInterval(function(){
      self.setDataEvent({timer: count--}, 'update_stats');
    }, 1000);

    self.clearTimers('stats');

    self.timers.push({
      name: 'stats',
      timeout: setTimeout(events, next),
      interval: loop
    });
  }

  this.s_pool_activity = function(data) {
    self.sharesTime = [];

    for (let i=0; i<data.shares.length;i++)
      self.sharesTime.push(data.shares[i].ts);

    self.setActivityGraph(data.max);

    const loop = setInterval(function(){
      self.setActivityGraph(data.max);
    }, 5*60*1000);

    self.clearTimers('activity');

    self.timers.push({
      name: 'activity',
      interval: loop
    });
  }

  this.s_add_share = function(share) {
    self.sharesTime.push(share.ts);
  }

  this.s_payment_summary = function(data) {
    self.setDataEvent(data, 'payment_summary');
    //self.payoutThreshold.refresh(data.pending, data.threshold);
  }

  this.s_payment_list = function() {
    self.setupDataTable(self.processPayment, 'payment_update', 'table_payment');
  }

  this.s_payout_summary = function(data) {
    self.setDataEvent(data, 'payout_summary');
    self.setThresholdPercent(data);
  }

  this.s_payout_list = function(addr) {
    self.setupDataTable(self.processPayout, 'payout_update', 'table_payout', addr);
  }

  this.s_block_summary = function(data) {
    self.setDataEvent(data, 'block_summary');
  }

  this.s_block_list = function() {
    self.setupDataTable(self.processBlock, 'block_update', 'table_block_valid', '1');
    
    $('#blockTab a').on('shown.bs.tab', function(e){
      const id = $(e.target).attr('table-id');
      const type = $(e.target).attr('data-type');
      self.setupDataTable(self.processBlock, 'block_update', id, type);
    });
  }

  this.s_mining_ports = function(length) {
    let html = '';

    for (let i = 0; i < length; i++) {
      const id = 'mining_port_' + i;
      $('#mining_ports').append('<div id="'+id+'" class="tile-port animated flipInY col-lg-3 col-md-3 col-sm-6 col-xs-12"></div>');
      wmcc_template.append('miner/mining_port', id, true);
      IO.emit('c_mining_port', i);
    }
  }

  this.s_mining_port = function(data, index) {
    //setTimeout(function(){
     // console.log(data, index)
    self.setDataEvent(data, 'mining_port', 'mining_port_'+index);
  //}, 2000)
  }

  /**
   * CLIENT SIDE EVENTS
   */
  this.getElements = function() {
    return {
      BODY: $('body'),
      MENU_TOGGLE: $('#menu_toggle'),
      SIDEBAR_MENU: $('#sidebar-menu'),
      SIDEBAR_FOOTER: $('.sidebar-footer'),
      LEFT_COL: $('.left_col'),
      RIGHT_COL: $('.right_col'),
      NAV_MENU: $('.nav_menu'),
      FOOTER: $('footer')
    }
  }

  this.currentUrl = function() {
    return window.location.href.split('#')[0].split('?')[0];
  }

  /* to run all general function */
  this.c_run_all = function() {
    //this.c_sidebar_menu();
    this.c_toogle_slide();
  }

  this.c_sidebar_menu = function() {
    const $EL = this.getElements();
    const setContentHeight = function ($EL) {
      // reset height
      $EL.RIGHT_COL.css('min-height', $(window).height());

      let bodyHeight = $EL.BODY.outerHeight(),
          footerHeight = $EL.BODY.hasClass('footer_fixed') ? -10 : $EL.FOOTER.height(),
          leftColHeight = $EL.LEFT_COL.eq(1).height() + $EL.SIDEBAR_FOOTER.height(),
          contentHeight = bodyHeight < leftColHeight ? leftColHeight : bodyHeight;
      // normalize content
      contentHeight -= $EL.NAV_MENU.height() + footerHeight;
      $EL.RIGHT_COL.css('min-height', contentHeight);
    };

    // sidebar click event
    //$(document).on('click','#sidebar-menu a', function(ev) {
    $EL.SIDEBAR_MENU.find('a').unbind('click').on('click', function() {
      const $li = $(this).parent();

      if ($li.is('.active'))
        return;

      if ($li.parent().is('.child_menu'))
        $li.parent().find("li").removeClass('active');

      if ($li.is('.active')) {
        $li.removeClass('active active-sm');
        $('ul:first', $li).slideUp(function() {
          setContentHeight($EL);
        });
      } else {
        // prevent closing menu if we are on child menu
        if (!$li.parent().is('.child_menu')) {
          $EL.SIDEBAR_MENU.find('li').removeClass('active active-sm');
          $EL.SIDEBAR_MENU.find('li ul').slideUp();
        } else {
          if ($EL.BODY.is(".nav-sm")) {
            $EL.SIDEBAR_MENU.find( "li" ).removeClass( "active active-sm" );
            $EL.SIDEBAR_MENU.find( "li ul" ).slideUp();
          }
        }
        $li.addClass('active');

        $('ul:first', $li).slideDown(function() {
          setContentHeight($EL);
        });
      }
    });

    // toggle small or large menu 
    $EL.MENU_TOGGLE.unbind('click').on('click', function() {
      if ($EL.BODY.hasClass('nav-md')) {
        $EL.SIDEBAR_MENU.find('li.active ul').hide();
        $EL.SIDEBAR_MENU.find('li.active').addClass('active-sm').removeClass('active');
      } else {
        $EL.SIDEBAR_MENU.find('li.active-sm ul').show();
        $EL.SIDEBAR_MENU.find('li.active-sm').addClass('active').removeClass('active-sm');
      }

      $EL.BODY.toggleClass('nav-md nav-sm');
      setContentHeight($EL);
      $('.dataTable').each ( function () { $(this).dataTable().fnDraw(); });
    });

    // check active menu
    $EL.SIDEBAR_MENU.find('a[href="' + self.currentUrl() + '"]').parent('li').addClass('current-page');

    $EL.SIDEBAR_MENU.find('a').filter(function () {
      return this.href == self.currentUrl();
    }).parent('li').addClass('current-page').parents('ul').slideDown(function() {
      setContentHeight($EL);
    }).parent().addClass('active');

    // recompute content when resizing
    $(window).smartresize(function(){  
      setContentHeight($EL);
    });

    setContentHeight($EL);

    // fixed sidebar
    if ($.fn.mCustomScrollbar) {
      $('.menu_fixed').mCustomScrollbar({
        autoHideScrollbar: true,
        theme: 'minimal',
        mouseWheel:{ preventDefault: true }
      });
    }
  }

  this.c_toogle_slide = function() {
    $('.collapse-link').on('click', function() {
      const $BOX_PANEL = $(this).closest('.x_panel'),
            $BOX_CONTENT = $BOX_PANEL.find('.x_content');

      // fix for some div with hardcoded fix class
      if ($BOX_PANEL.attr('style')) {
          $BOX_CONTENT.slideToggle(200, function(){
            $BOX_PANEL.removeAttr('style');
          });
      } else {
        $BOX_CONTENT.slideToggle(200); 
        $BOX_PANEL.css('height', 'auto');  
      }

      $(this).find('i').toggleClass('fa-chevron-up fa-chevron-down');
    });

    $('.close-link').click(function () {
      $(this).closest('.x_panel').remove();
    });
  }

  this.c_payout_search = function() {
    $('#payout_search').on('click', function() {
      const addr = $('#payout_address').val();

      if (!addr)
        return;

      IO.emit('c_payout_summary', addr);
      IO.emit('c_payout_list', addr);
    });
  }

  /**
   * FUNCTIONS
   */
  this.setActivityGraph = function(dataMax) {
    const el = $('#pool_activity').parent();
    const text = $('#pool_activity_text');

    const len = el.width()/15;
    const max = Math.min(Math.round(len), dataMax);
    const width = el.width()/max;
    const now = Math.floor(Date.now()/1000);

    let times = [],
        shares = [];

    for (let i=0; i<max; i++) {
      shares[i] = 0;
      times[i] = now-60*60*i;
    }

    for (let i=0; i<self.sharesTime.length; i++) {
      const idx = Math.abs(Math.ceil((now-self.sharesTime[i])/(60*60))-1);
      if (idx<max)
        shares[idx]++;
    };

    const data = {
      keyType: 'plural',
      keyOptions: {type: 'int', unit: _langs.home.pool.block},
      keys: shares,
      valueType: 'hourRange',
      valueOptions: {},
      values: times
    }

    text.html(
      _langs.poolActivity.blockMinedForLast +
      ' ' + times.length +
      ' ' + _langs.poolActivity.hours
    );

    let done = true;
    $(window).on('resize', function(){
      if (!done)
        return;


      done = false;

      setTimeout(function(){
        done = true;
        self.setActivityGraph(dataMax);
      }, 1000);
    });

    self.setupSparkline(data, 'pool_activity', {width: (4/6*width).toFixed(2), spacing: (2/6*width).toFixed(2)});
  }

  this.processPayment = function(data, dt) {
    const payouts = [];
    // not compatible to old browser
    /*for (let payout of data.payouts) {
      const time = self.dataType('age', payout.time);
      const amount = self.dataType('wmcoin', payout.total, {decimal: 8});
      payouts.push([time.toString(), payout.hash, amount.toString(true), payout.miner]);
    };*/
    for (let i=0; i<data.payouts.length; i++) {
      const time = self.dataType('age', data.payouts[i].time);
      const amount = self.dataType('wmcoin', data.payouts[i].total, {decimal: 8});
      payouts.push([
        time.toString(),
        data.payouts[i].hash,
        amount.toString(true),
        data.payouts[i].miner
      ]);
    };

/*    const header = [
      { title: _langs.payouts.table.timeSent },
      { title: _langs.payouts.table.transactionHash },
      { title: _langs.payouts.table.amount },
      { title: _langs.payouts.table.share }
    ]*/

    return {
      draw: dt.draw,
      data: payouts,
//      columns: header,
      recordsTotal: data.size,
      recordsFiltered: data.size
    }
  }

  this.processPayout = function(data, dt) {
    const payouts = [];

    for (let i=0; i<data.payouts.length; i++) {
      const time = self.dataType('age', data.payouts[i].time);
      const amount = self.dataType('wmcoin', data.payouts[i].amount, {decimal: 8});
      payouts.push([
        time.toString(),
        data.payouts[i].paymentID,
        amount.toString(),
        data.payouts[i].value
      ]);
    };

    return {
      draw: dt.draw,
      data: payouts,
      recordsTotal: data.size,
      recordsFiltered: data.size
    }
  }

  this.processBlock = function(data, dt) {
    const shares = [];

    for(let i=0; i<data.shares.length; i++) {
      const age = self.dataType('age', data.shares[i].ts);
      const reward = self.dataType('wmcoin', data.shares[i].reward, {decimal: 8});
      const share = [];

      share.push(age.toString());
      share.push(data.shares[i].height);
      if (data.shares[i].merged)
        share.push(data.shares[i].merged);
      share.push(data.shares[i].block);
      share.push(data.shares[i].total);
      if (!data.shares[i].merged)
        share.push(reward);

      shares.push(share);
    }

    return {
      draw: dt.draw,
      data: shares,
      recordsTotal: data.size,
      recordsFiltered: data.size
    }
  }

  this.setupDataTable = function(fn, event, id, options) {
    if( typeof ($.fn.DataTable) === 'undefined'){ return; }

    options = options || {};
    let idx = self.tableIds.indexOf(id);

    if (idx > -1) {
      self.tableListeners[idx].destroy();
      IO.removeAllListeners('s_'+event);
    } else {
      const len = self.tableIds.push(id);
      idx = len - 1;
    }

    const table = $('#'+id).DataTable({
      serverSide: options.serverSide || true,
      ordering: options.ordering || false,
      searching:  options.searching || false,
      ajax: function(dt, cb) {
        IO.emit('c_'+event, dt.length, dt.start, options);
        IO.on('s_'+event, function(data) {
          cb(fn(data, dt));
        });
      }
    });

    self.tableListeners[idx] = table;
  }

  this.setupSparkline = function(data, id, options) {
    if(typeof ($.fn.sparkline) === 'undefined'){ return; }

    options = options || {};

    const toObject = function(data, type, parser, options) {
      const obj = [];

      for (let i=0; i<data.length; i++) {
        const dt = parser(type, data[i], options);
        obj.push(dt.parent + (dt.child?( ' ' + dt.child):''));
      }

      return obj;
    }

    const opts = {
      type: 'bar',
      keys: toObject(data.keys, data.keyType, self.dataType, data.keyOptions),
      values: toObject(data.values, data.valueType, self.dataType, data.valueOptions),
      tooltipFormatter: function(sp, options, fields) {
        const field = fields[0];
        const fKey = '<div class="jqsfield"><span style="color: #ff9900">&#9679;</span> {{key}}</div>';
        const fVal = '<div class="jqsfield"><span style="color: #3366cc">&#9679;</span> {{val}}</div>';
        const format = $.spformat(fKey+fVal);

        field.key = options.get('keys')[field.offset];
        field.val = options.get('values')[field.offset];
        return format.render(field, options.get('tooltipValueLookups'), options);
      },
      height: options.height || '125',
      barWidth: options.width || 13,
      barSpacing: options.spacing || 2,
      barColor: options.color || '#26B99A'
    }

    return $('#'+id).sparkline(data.keys, opts);
  }

  this.setDataEvent = function(data, eventName, id) {
    for (const name in data) {
      const el = $('[data-event="'+eventName+'"][data-name="'+name+'"]' + (id?'[data-id="'+id+'"]':''));
      if (!el.length)
        continue;

      const types = el.attr('data-type').split("::");

      if (types[0] === 'visible') {
        if (!data[name])
          el.hide();
        continue;
      }

      const dt = self.dataType(types[0], data[name], {type: types[1], unit: types[2]});

      el.html(dt.parent);
      if (el.is("[data-child]")) {
        const childName = el.attr("data-child");
        const child = el.parent().find('[data-name="'+childName+'"]');
        child.html(dt.child);
      }
    }
  }

  this.setThresholdPercent = function(data) {
    const done = $('#payout_threshold .progress-bar-success');
    const balance = $('#payout_threshold .progress-bar-blank');
    const pending = data.pending/1e8;
    const percent = Math.round(pending/data.threshold*100);
    const width = Math.min(percent, 100)*0.6;

    $('#payout_threshold_percent').html(percent);

    done.css({width: width+'%'});
    balance.css({width: (60-width)+'%'});
  }

  this.clearTimers = function(name) {
    const clear = function(fn, i) {
      if (fn[i].timeout)
        clearTimeout(fn[i].timeout);
      if (fn[i].interval)
        clearInterval(fn[i].interval);
      fn.splice(i, 1);
    }

    for(let i=self.timers.length-1; i>=0; i--) {
      if (name) {
        if (self.timers[i].name === name)
          clear(self.timers, i);
      } else clear(self.timers, i);
    }
  }

  this.dataType = function(type, value, options) {
    const dt = new _dt();

    switch (type) {
      case 'plural':
        const data = self.dataType(options.type, value);
        dt.parent = data.parent;
        dt.child = options.unit + ((data.parent>1 && _langs.global.plural)?'s':'');
        break;
      case 'int':
      case 'float':
        dt.parent = value.toLocaleString();
        break;
      case 'string':
        dt.parent = value.toString();
        break;
      case 'boolean':
        dt.parent = (value)? _langs.global.true.uppercase: _langs.global.false.uppercase;
        break;
      case 'yesno':
        dt.parent = (value)? _langs.global.yes: _langs.global.no;
        break;
      case 'percent':
        dt.parent = value+'<span style="font-size:70%">%</span>';
        break;
      case 'hashrate':
        const hashrate = self.formatSize(value, 'hash', true);
        dt.parent = hashrate.size;
        dt.child = hashrate.unit;
        break;
      case 'sharerate':
        const sharerate = self.formatSize(value, 'share', true);
        dt.parent = sharerate.size;
        dt.child = sharerate.unit;
        break;
      case 'sharesize':
        const sharesize = self.formatSize(value, 'share');
        dt.parent = sharesize.size;
        dt.child = sharesize.unit;
        break;
      case 'age':
        const age = self.formatAge(value);
        dt.parent = age.time;
        dt.child = age.unit;
        break;
      case 'time':
        const time = self.formatSecond(value);
        dt.parent = time.time;
        dt.child = time.unit;
        break;
      case 'hour':
        const hour = self.formatHour(value);
        dt.parent = hour.time;
        dt.child = hour.unit;
        break;
      case 'hourRange':
        dt.parent = self.formatHourRange(value);
        break;
      case 'multiply':
        const diff = self.formatDifficulty(value);
        dt.parent = diff.pow;
        dt.child = diff.mul;
        break;
      case 'amount':
      case 'wmcoin': // convert wmcoin to wmcc
        const wmcc = self.formatAmount(value, 'wmcoin', options);
        dt.parent = wmcc.amount;
        dt.child = wmcc.unit;
        break;
      case 'wmcc': // convert wmcc to wmcoin
        const wmcoin = self.formatAmount(value, 'wmcc', options);
        dt.parent = wmcoin.amount;
        dt.child = wmcoin.unit;
        break;
      default:
        dt.parent = value;
    }

    return dt;
  }

  this.formatDifficulty = function(diff) {
    const str = diff.toString();
    const txt = str.replace('.', '');
    const pos = str.indexOf('.');
    const min = Math.min(pos,3);
    const max = Math.max(2,5-pos);

    return {
        pow: txt.substr(0, min) + '.' + txt.substr(min, max),
        mul: 'x1' + new Array(pos<2?0:pos-2).join('0')
    }
  }

  this.formatAge = function(ts) {
    let sec = ts < 1000000000000 ? Math.abs(Date.now()/1000 - ts) : Math.abs(Date.now() - ts)/1000;
    return this.formatSecond(sec, {age: true});
  }

  this.formatSecond = function(sec, options) {
    options = options || {};

    let o = {
          time: '&nbsp;',
          unit: _langs.global.date.justNow
        },
        r = {},
        c = 0;
    const s = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
    }

    if (sec < 1)
      return o;

    Object.keys(s).forEach(function(i){
      r[i] = Math.floor(sec / s[i]);
      sec -= r[i] * s[i];
      if (r[i] && c<1) {
        c++;
        o.time = r[i] || 0;
        o.unit = _langs.global.date[i];
        if (_langs.global.date.plural && o.time > 1)
          o.unit += 's';
        if (options.age)
          o.unit += ' '+_langs.global.date.ago;
      }
    });
    return o;
  }

  this.formatHour = function(ts) {
    let sec = ts < 1000000000000 ? Math.abs(Date.now()/1000 - ts) : Math.abs(Date.now() - ts)/1000;
    let o = {
          time: '',
          unit: _langs.global.date.justNow
        };

    o.time = Math.floor(sec/3600);
    o.unit = _langs.global.date.hour;
    if (_langs.global.date.plural && o.time > 1)
      o.unit += 's';

    return o;
  }

  this.formatHourRange = function(ts) {
    const c = new Date(ts * 1000);
    const p = new Date((ts-360) * 1000);

    return c.getFullYear()+'/'+(c.getMonth()+1)+'/'+c.getDate()+
      ' '+c.getHours()+':00 - '+c.getHours()+':59';
  }

  this.formatSize = function(b, t, r, d) {
    const k = (t==='size') ? 1024: 1000;
    const dm = d || 2;
    const rate = r?_langs.global.size[t].perTime:'';

    if(b == 0)
      return {
        size: 0,
        unit: Object.values(_langs.global.size[t])[0] + rate
      }


    if (t==='share'&&b<1)
      return {
        size: b.toFixed(dm),
        unit: Object.values(_langs.global.size[t])[0] + rate
      }

    const s = {
      size: ['bytes', 'kb', 'mb', 'gb', 'tb', 'pb', 'eb', 'zb', 'yb'],
      hash: ['hashes', 'kh', 'mh', 'gh', 'th', 'ph', 'eh', 'zh', 'yh'],
      share: ['shares', 'ks', 'ms', 'gs', 'ts', 'ps', 'es', 'zs', 'ys']
    };
    const i = Math.floor(Math.log(b) / Math.log(k));
    return {
      size: parseFloat((b / Math.pow(k, i)).toFixed(dm)),
      unit: _langs.global.size[t][s[t][i]] + rate
    }
  }

  this.formatAmount = function(value, unit, options) {
    options = options || {};
    const o = {
      amount: 0,
      unit: ''
    };

    if (!value)
      return o;

    const s = ['zero', 'k', 'm', 'g', 't'];
    const d = options.decimal || 2;

    let mul;
    switch (unit) {
      case 'wmcc':
        mul = 1e8;
        break;
      case 'wmcoin':
        mul = 1/1e8;
        break;
      default:
        mul = 1;
    }


    const i = Math.floor(Math.log(value*mul) / Math.log(1000));
    o.amount = parseFloat((value*mul / Math.pow(1000, i))).toFixed(d);
    o.unit = _langs.global.size.number[s[i]];
    
    return o;
  }

  /**
   * Helper
   */
  const _dt = function(parent, child) {
    this.parent = parent;
    this.child = child;

    return this;
  }

  _dt.prototype.toString = function(bool) {
    return this.parent+(bool?'':' ')+this.child;
  }
}

const wmcc_events = new WMCC_Events();