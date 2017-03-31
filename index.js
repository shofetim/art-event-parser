var https = require('https'),
    http = require('http'),
    url = require('url'),
    restify = require('restify'),
    FeedParser = require('feedparser'),
    log = console.log.bind(console);

var get = (str, callback) => {
    var handler = res => callback(res),
        endpoint = url.parse(str),
        req = {host: endpoint.host, path: endpoint.path,
               headers: {"User-Agent": "art-event-scrapper"}};
    if (endpoint.protocol == "http:") {
        http.get(req, handler);
    } else {
        https.get(req, handler);
    }
};

var rssHelper = (callback, endpoint, extractor) => {
    get(endpoint, res => {
        var result = [];
        res.pipe(new FeedParser())
            .on('error', (error) => log(error))
            .on('readable', function () {
                var item;
                while ((item = this.read())) {
                    result.push(extractor(item));
                }
            })
            .on('end', () => callback(result));
    });
};

var callforentry = (callback) => {
    get("https://www.callforentry.org/festivals-ajax.php",
        res => {
            var body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                var data = [];
                JSON.parse(body).results.map((i) => {
                    data.push({
                        title: i.fair_name,
                        medium: i.ProductDescription,
                        postingDate: i.Entered,
                        deadline: i.Deadline,
                        venue: i.fair_city
                    });
                });
                callback(data);
            });
        });
};

var artshows = (callback) => {
    rssHelper(callback, "http://artshow.com/RSSfeeds/international_artshows.xml", item => {
        return {
            "title" : item.title,
            "description" : item.description,
            "medium" : "",
            "deadline": item.description.substring(
                item.description.indexOf("Deadline:")),
            "venue" : item.title.substring(item.title.indexOf("- ") + 2)
        };
    });
};

var artandartdeadlines = (callback) => {
    rssHelper(callback, "http://www.artandartdeadlines.com/feed/", item => {
        var categories = item.categories.filter(i => (i.indexOf('deadline') == -1)),
            deadline = item.categories.find(i => (i.indexOf('deadline') > -1));
        return {
            "title" : item.title,
            "medium": categories.join(", "),
            "posting_date": item.pubDate,
            "deadline": deadline,
            "venue" : item.title //TODO
        };
    });
};

var artshow = (callback) => {
    rssHelper(callback, "http://www.artshow.com/RSSfeeds/artshows.xml", item => {
        return {
            "title" : item.title,
            "description" : item.description,
            "medium" : "",
            "deadline": item.description.substring(item.description.indexOf("Deadline:")),
            "venue" : item.title.substring(item.title.indexOf("- ") + 2)
        };
    });
};

var reTitle = (callback) => {
    rssHelper(callback, "http://blog.re-title.com/opportunities/rss.xml", item => {
        var medium = "";
        if (item['rss:category'] && item['rss:category'].length > 0) {
            medium = item['rss:category'][0]['#'];
        }
        var description = item.description.toLowerCase(),
        deadline;
        deadline = description.match(/deadline(.*)(,|)/);
        if (deadline && deadline.length>0) {
            deadline= deadline[0].replace(/<\/?[^>]+(>|$)/g, "");
            if (deadline.length > 100) {
                deadline = deadline.substring(0,30);
            }
        }
        return {
            "title" : item.title,
            "medium": medium,
            "posting_date": item.pubDate,
            "deadline": deadline,
            "venue" : item.title //TODO
        };
    });
};

var collegeArt = (callback) => {
    rssHelper(callback, "http://www.collegeart.org/news/feed/", item => {
        var deadline  = item['content:encoded']['#'].match(/Deadline:(.*)/);
        if (deadline){
            deadline = deadline[0];
        }
        var medium = item.categories.join(', ');
        return {
            "title" : item.title,
            "medium": medium,
            "posting_date": item.pubDate,
            "deadline": deadline,
            "venue" : item.title
        };
    });
};

var entrythingy = (callback) => {
    rssHelper(callback, "http://www.entrythingy.com/rss", item => {
        return {
            "title" : item.title,
            "medium": "",
            "posting_date": item['rss:pubdate']['#'],
            "deadline": "",
            "venue" : item.title
        };
    });
};

var artdeadline = (callback) => {
    rssHelper(callback, "http://artdeadline.com/feed/", item => {
        var deadline = item.description.match(/Deadline: (.*)</);
        if (deadline) {
            deadline= deadline[1];
        }
        return {
            "title" : item.title,
            "medium": item['dc:creator']['#'],
            "posting_date": item['rss:pubdate']['#'],
            "deadline": deadline,
            "venue" : item.title
        };
    });
};

var data = {};

var fetch = () => {
    var makeUpdater = (key) => {
        return (res) => {
            log("fetched %s", key);
            data[key] = res;
        };
    };
    callforentry(makeUpdater('callforentry'));
    artshows(makeUpdater('artshows'));
    artandartdeadlines(makeUpdater('artandartdeadlines'));
    artshow(makeUpdater('artshow'));
    reTitle(makeUpdater('reTitle'));
    collegeArt(makeUpdater('collegeArt'));
    entrythingy(makeUpdater('entrythingy'));
    artdeadline(makeUpdater('artdeadline'));
};

var getAll = (req, res, next) => {
    res.send(data);
    return next();
};

var getDomain = (req, res, next) => {
    res.send(data[req.params.domain]);
    return next();
};

var init = () => {
    var server = restify.createServer();
    fetch();
    setInterval(fetch, 1000 * 60 * 60);
    server.get("/api/feed", getAll);
    server.get("/api/feed/:domain", getDomain);
    server.listen(80, () => {
        log('%s listening at %s', server.name, server.url);
    });
};

init();
