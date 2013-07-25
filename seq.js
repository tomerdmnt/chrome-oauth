
module.exports = seq;

/**
 * Flow control, call functions sequeintialy
 * Used with the oauth flow
 */
function seq() {
  var i = 0;
  var args = arguments;

  function next() {
    var nextargs = arguments;
    var fn = args[i++];

    Array.prototype.push.call(nextargs, next);
    if (fn) fn.apply(fn, nextargs);
  }

  next();
}
