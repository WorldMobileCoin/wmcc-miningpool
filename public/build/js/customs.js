// smartresize: Resize function without multiple trigger
(function($,sr){
  const debounce = function (func, threshold, execAsap) {
    let t;

    return function debounced () {
      const obj = this, args = arguments;
      function delayed () {
        if (!execAsap)
          func.apply(obj, args); 
        t = null; 
      }

      if (t)
        clearTimeout(t);
      else if (execAsap)
        func.apply(obj, args);

      t = setTimeout(delayed, threshold || 100); 
    }
  }
  // smartresize 
  $.fn[sr] = function(fn){  return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr); };
})($,'smartresize');

// NProgress
if (typeof NProgress != 'undefined') {
  $(document).ready(function () {
    NProgress.start();
  });

  $(window).load(function () {
    NProgress.done();
  });
}