const IO = io({
  transports: ['websocket', 'polling']
});

function WMCC_Template () {
  this.events = [];

  this.init = function() {
    const html = this.replace($('.body').html(), {bool: true});
    $('title').html(_langs.title.siteTitle);
    $('.body').html(html);
    this.route('home', false);
    this.initSocket();
  }

  this.initSocket = function () {
    const self = this;
    IO.on('s_module', function (data) {
      const options = {};

      if (data.setId)
        options.id = data.id;

      let n = self.replace(data.html, options);
      $('#'+data.id).html(n);
      self.handleEvents(n);
    });

    IO.on('s_page', function (data) {
      self.clearEvent();
      const html = self.replace(data.html, {bool: true});
      $('#pageContent').html(html);
      if (data.reload !== false)
        wmcc_events.c_run_all();
    });
  }

  this.replace = function (html, options) {
    options = options || {};
    let ret = html;
    const self = this;
    html.replace(/{{(.+?)}}/g, function (m, c) {
      const r = c.split("::");
      let n = '',
          o = _langs;
      for (let i=0; i<r.length; i++) {
        o = o[r[i]];
      }

      if (typeof o === 'object') {
        if (o.array) {
          for(let i=0; i<o.array.length; i++) {
            if (o.tag)
              n += '<'+ o.tag +'>' + o.array[i] + '</'+ o.tag +'>';
            else
              n += o.array[i];
          }
        }
      }

      if (!n)
        n = o;

      ret = ret.replace(m, self.parse(n));
    });

    if (options.id)
      ret = ret.replace(/__id__/g, options.id);

    if (!options.bool)
      return ret;

    return this.modules(ret);
  }

  this.append = function (path, id, setId) {
    IO.emit('c_module', {path: './modules/'+path+'.html', id: id, setId: setId});
  }

  this.parse = function (t) {
    let m = '';
    if (!t)
      return "UNKNOWN";

    return t.replace(/\[\[(.+?)]]\((.+?)\)/g, function (m, c, o, i, j) {
      if (!m)
        m = j;
      return m.replace(m, '<strong><a href="'+c+'" target="_blank">'+o+'</a></strong>');
    });
  }

  this.route = function (link, reload) {
    IO.emit('c_page', {path: './pages/'+ link +'.html', reload: reload});
  }

  this.modules = function (html) {
    let ret = html;
    const self = this;
    html.replace(/%%(.+?)%%/g, function (m, c) {
      const r = c.replace("::","/");
      const id = "_" + random();
      ret = ret.replace(m, '<div id="'+id+'"></div>');
      self.append(r, id);
    });
    return ret;
  }

  this.handleEvents = function (html) {
    const self = this;
    // !!even_name!! - add and fire
    html.replace(/!!(.+?)!!/g, function (m, c) {
      self.addEvent('s_' + c);
      IO.emit('c_' + c);
    });
    // ##even_name## - add only
    html.replace(/##(.+?)##/g, function (m, c) {
      self.addEvent('s_' + c);
    });
    // handle client events
    html.replace(/>>(.+?)<</g, function (m, c) {
      wmcc_events['c_' + c]();
    });
  }

  this.clearEvent = function() {
    wmcc_events.clearTimers();

    for (let i=0; i<this.events.length; i++)
      IO.removeAllListeners(this.events[i]);

    this.events = [];
  }

  this.addEvent = function(name) {
    this.events.push(name);
    IO.on(name, wmcc_events[name]);
  }

  function random() {
    return Math.floor(Math.random() * 0x100000000);
  }
};

const wmcc_template = new WMCC_Template();

wmcc_template.init();

$(window).on('hashchange', function() {
  wmcc_template.route(window.location.hash.substr(1));
});

// page reload
if (localStorage) {
  $(window).on('beforeunload',function(){
      localStorage.setItem('reload', true);
  }).on('load',function(){
    if (localStorage.reload){
      localStorage.removeItem('reload');
      window.location.hash = "home";
    }
  });
} else {
  $(window).on('beforeunload', function(){
    window.location.hash = "home";
  });
}