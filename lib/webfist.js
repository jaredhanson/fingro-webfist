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

var lookup = function(server, resource, httpsOnly, callback) {

    var parsed,
        params,
        qs,
        options;

    parsed = url.parse(server);
    
    if ((parsed.protocol !== "https:") && httpsOnly) {
        callback(new Error("Refusing to use insecure WebFist server: " + server), null);
        return;
    }

    params = {
        resource: resource
    };

    qs = querystring.stringify(params),

    options = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: "/.well-known/webfinger?" + qs,
        method: "GET",
        httpsOnly: httpsOnly
    };

    request(((parsed.protocol == "https:") ? https : http), options, {"application/json": webfinger.jrd, "application/jrd+json": webfinger.jrd}, callback);
};

var webfist = function(resource, options, callback) {

    // Options parameter is optional

    if (!callback) {
        callback = options;
        options = {};
    }

    // Prefix it with acct: if it looks like a bare webfinger

    if (resource.indexOf(":") === -1) {
        if (resource.indexOf("@") !== -1) {
            resource = "acct:" + resource;
        }
    }

    Step(
        function() {
            lookup(options.server || 'http://webfist.org/', resource, options.httpsOnly, this);
        },
        function(err, jrd) {
            var delegations, newopts;
            if (err) throw err;
            if (!jrd.hasOwnProperty("links")) {
                throw new Error("No links in WebFist JRD");
            }
            
            // First, get the WebFist delegation links
            delegations = jrd.links.filter(function(link) {
                return (link.hasOwnProperty("rel") && 
                        link.rel == "http://webfist.org/spec/rel" &&
                        link.hasOwnProperty("href"));
            });
            
            if (!delegations || delegations.length === 0) {
                throw new Error("No delegation links in WebFist JRD");
            }
            
            // Fetch the real resource descriptor
            newopts = url.parse(delegations[0].href);
    
            if ((newopts.protocol !== "https:") && options.httpsOnly) {
                callback(new Error("Refusing to fetch non-HTTPS delegation: " + delegations[0].href), null);
                return;
            }
            
            newopts.httpsOnly = options.httpsOnly;
            
            request(((newopts.protocol == "https:") ? https : http), newopts, {"application/json": webfinger.jrd, "application/jrd+json": webfinger.jrd}, this);
        },
        callback
    );
};

exports.webfist = webfist;
