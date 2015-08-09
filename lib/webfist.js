// CREDIT: https://github.com/e14n/webfinger

var Step = require("step"),
    dns = require("dns"),
    http = require("http"),
    https = require("https"),
    url = require("url"),
    querystring = require("querystring")
    webfinger = require("webfinger");


var request = function(module, options, parsers, callback) {

    var types = [], prop;

    for (prop in parsers) {
        if (parsers.hasOwnProperty(prop)) {
            types.push(prop);
        }
    }

    var req = module.request(options, function(res) {

        var body = "";

        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            body = body + chunk;
        });

        res.on("error", function(err) {
            callback(err, null);
        });

        res.on("end", function() {

            var ct, matched, parser, newopts;

            if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {

                newopts = url.parse(res.headers.location);

                // Don't redirect if it's not allowed

                if (options.httpsOnly && newopts.protocol != "https:") {
                    callback(new Error("Refusing to redirect to non-HTTPS url: " + res.headers.location), null);
                    return;
                }

                newopts.httpsOnly = options.httpsOnly;

                request(((newopts.protocol == "https:") ? https : http), newopts, parsers, callback);
                return;

            } else if (res.statusCode !== 200) {
                callback(new Error("Bad response code: " + res.statusCode + ":" + body), null);
                return;
            }

            if (!res.headers["content-type"]) {
                callback(new Error("No Content-Type header"), null);
                return;
            }

            ct = res.headers["content-type"];

            matched = types.filter(function(type) { return (ct.substr(0, type.length) == type); });

            if (matched.length == 0) {
                callback(new Error("Content-Type '"+ct+"' does not match any expected types: "+types.join(",")), null);
                return;
            }

            parser = parsers[matched];

            parser(body, callback);
        });
    });

    req.on('error', function(err) {
        callback(err, null);
    });

    req.end();    
};

var httpsWebfist = function(hostname, resource, rel, callback) {

    var params,
        qs,
        options;

    params = {
        resource: resource
    };

    if (rel) {
        params.rel = rel;
    }

    qs = querystring.stringify(params),

    options = {
        hostname: hostname,
        port: 443,
        path: "/.well-known/webfinger?" + qs,
        method: "GET",
        httpsOnly: true
    };

    request(https, options, {"application/json": webfinger.jrd, "application/jrd+json": webfinger.jrd}, callback);
};

var webfist = function(resource, rel, options, callback) {
  
    var server;

    // Options parameter is optional

    if (!callback) {
        callback = options;
        options = {};
    }

    // Rel parameter is optional

    if (!callback) {
        callback = rel;
        rel = null;
    }

    // Prefix it with acct: if it looks like a bare webfinger

    if (resource.indexOf(":") === -1) {
        if (resource.indexOf("@") !== -1) {
            resource = "acct:" + resource;
        }
    }
    
    server = url.parse(options.server || 'http://webfist.org');

    Step(
        function() {
            httpsWebfist(server.hostname, resource, rel, this);
        },
        function(err, jrd) {
            if (!err) {
                // It worked; return the jrd
                callback(null, jrd);
                return;
            }
            if (options.webfingerOnly) {
                throw new Error("Unable to find webfinger");
            }
            lrdd(resource, options, this);
        },
        callback
    );
  
  
};

exports.webfist = webfist;
