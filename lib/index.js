var webfist = require('./webfist').webfist;
var NoDataError = require('./errors/nodataerror');


module.exports = function() {
  
  // http://webfist.org/
  // http://www.onebigfluke.com/2013/06/bootstrapping-webfinger-with-webfist.html
  // https://github.com/bradfitz/webfist
  // https://groups.google.com/forum/#!topic/webfinger/rZI4OEZtK0U
  
  // http://webfist.org/.well-known/webfinger?resource=acct:pithy.example@gmail.com
  // http://webfist.org/.well-known/webfinger?resource=acct:bradfitz@gmail.com
  // http://webfist.org/.well-known/webfinger?resource=acct:bradfitz@facebook.com
  // http://webfist.org/.well-known/webfinger?resource=acct:wnorris@gmail.com
  
  // http://webfist.org/webfist/bump
  
  
  var plugin = {};
  
  plugin.resolveAliases = function(identifier, cb) {
    webfist(identifier, {}, function(err, jrd) {
      if (err) {
        // Ignore the error under the assumption that Webfinger is not
        // implemented by the host.  The expectation is that other discovery
        // mechanisms are registered with `fingro` that will be used as
        // alternatives.
        return cb(null);
      }
      if (!jrd.aliases || jrd.aliases.length == 0) {
        return cb(new NoDataError('No aliases in JRD'));
      }
      
      return cb(null, jrd.aliases);
    });
  }
  
  plugin.resolveProperties = function(identifier, cb) {
    webfist(identifier, {}, function(err, jrd) {
      if (err) {
        // Ignore the error under the assumption that Webfinger is not
        // implemented by the host.  The expectation is that other discovery
        // mechanisms are registered with `fingro` that will be used as
        // alternatives.
        return cb(null);
      }
      if (!jrd.properties || jrd.properties.length == 0) {
        return cb(new NoDataError('No properties in JRD'));
      }
      
      return cb(null, jrd.properties);
    });
  }
  
  plugin.resolveServices = function(identifier, type, cb) {
    if (typeof type == 'function') {
      cb = type;
      type = undefined;
    }
    
    webfist(identifier, {}, function(err, jrd) {
      if (err) {
        // Ignore the error under the assumption that Webfinger is not
        // implemented by the host.  The expectation is that other discovery
        // mechanisms are registered with `fingro` that will be used as
        // alternatives.
        return cb(null);
      }
      if (!jrd.links || jrd.links.length == 0) {
        return cb(new NoDataError('No links in JRD'));
      }
      
      var services = {}
        , links = jrd.links
        , link, i, len;
      for (i = 0, len = links.length; i < len; ++i) {
        link = links[i];
        services[link.rel] = (services[link.rel] || []).concat({
          location: link.href,
          type: link.type
        });
      }
      
      return cb(null, services);
    });
  }
  
  return plugin;
}
