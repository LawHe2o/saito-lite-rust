const AppspaceHomeTemplate = require("./home.template");
const Post = require("./../post");
const Tweet = require("./../tweet");
const SaitoLoader = require("../../../../lib/saito/ui/saito-loader/saito-loader");



class AppspaceHome {

  constructor(app, mod, container = "") {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.name = "RedSquareAppspaceHome";
    this.thread_id = "";
    this.parent_id = "";
    this.loader = new SaitoLoader(app, mod, ".redsquare-appspace-body");
    this.intersection_loader = new SaitoLoader(app, mod, "#redsquare-intersection");

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (mod.viewing !== "home") { return; }
          this.intersection_loader.render();
          mod.loadMoreTweets(() => this.intersection_loader.hide());
        }
      });
    }, {
      root: null,
      rootMargin: '0px',
      threshold: 1
    });
  }

  render(include_tweets=true) {

    if (document.querySelector(".redsquare-home")) {
      this.app.browser.replaceElementBySelector(AppspaceHomeTemplate(), ".redsquare-home");
    } else {
      this.container.innerHTML = "";
      this.app.browser.addElementToSelectorOrDom(AppspaceHomeTemplate(), this.container);
    }

  }

  renderLoader() {

    //
    // ensure redsquare home exists
    //
    if (!document.querySelector(".redsquare-home")) {
      this.container.innerHTML = "";
      this.app.browser.addElementToSelectorOrDom(AppspaceHomeTemplate(), this.container);
    }

    this.loader.render();
    this.attachEvents();

  }

  renderTweets() {

    //
    // ensure redsquare home exists
    //
    if (!document.querySelector(".redsquare-home")) {
      this.container.innerHTML = "";
      this.app.browser.addElementToSelectorOrDom(AppspaceHomeTemplate(), this.container);
    }

    //
    // loop and render tweets
    //
    for (let i = 0; i < this.mod.tweets.length; i++) {
      this.appendTweetWithCriticalChild(this.mod.tweets[i]);
    }

    this.attachEvents();

  }

  appendTweetWithCriticalChild(tweet) {

    tweet.container = ".redsquare-appspace-body";
    if (tweet.updated_at > this.mod.tweets_last_viewed_ts) {
      this.mod.tweets_last_viewed_ts = tweet.updated_at;
    }
    tweet.renderWithCriticalChild();

  }

  prependTweetWithCriticalChild(tweet) {

    tweet.container = ".redsquare-appspace-body";
    if (tweet.updated_at > this.mod.tweets_last_viewed_ts) {
      this.mod.tweets_last_viewed_ts = tweet.updated_at;
    }
    tweet.renderWithCriticalChild(true);

  }

  appendTweet(tweet) {

    tweet.container = ".redsquare-appspace-body";
    if (tweet.updated_at > this.mod.tweets_last_viewed_ts) {
      this.mod.tweets_last_viewed_ts = tweet.updated_at;
    }
    tweet.render();

  }

  prependTweet(tweet) {

    tweet.container = ".redsquare-appspace-body";
    if (tweet.updated_at > this.mod.tweets_last_viewed_ts) {
      this.mod.tweets_last_viewed_ts = tweet.updated_at;
    }
    tweet.render(true);

  }


  renderThread(tweets=[]) {

    if (tweets.length == 0) { return; }

    //
    // organize into thread
    //
    for (let z = 1; z < tweets.length; z++) { tweets[0].addTweet(tweets[z], 0); }

    this.thread_id = tweets[0].tx.transaction.sig;
    this.parent_id = tweets[0].tx.transaction.sig;

    //
    // do not compress parent
    //
    tweets[0].is_long_tweet = true;
    tweets[0].renderWithChildren();


    document.querySelectorAll('.tweet-text').forEach(item => {
      if (item.classList.contains('preview')) {
        item.classList.replace('preview', 'full')
      }
    })


    document.querySelectorAll(".tweet")[0].scrollIntoView({behavior: "smooth", block: "start"});

    this.attachEvents();

  }



  attachEvents() {

    this.intersectionObserver.observe(document.querySelector('#redsquare-intersection'));

    document.getElementById("redsquare-tweet").onclick = (e) => {
      let post = new Post(this.app, this.mod);
      post.render();
    }

    document.getElementById("redsquare-profile").onclick = (e) => {
      this.app.connection.emit('redsquare-profile-render-request', this.app.wallet.returnPublicKey());
    }

  }




























/****
  renderTweetsWithSig(sig) {

    if (document.querySelector(".redsquare-appspace-body")) {
      this.app.browser.replaceElementBySelector(AppspaceHomeTemplate(), ".redsquare-home");
    } else {
      this.container.innerHTML = "";
      this.app.browser.addElementToSelector(AppspaceHomeTemplate(), this.container);    
    }

    let sql = `SELECT * FROM tweets WHERE sig = '${sig}' OR parent_id = '${sig}'`;
    this.mod.loadTweetsFromPeerAndReturn(this.mod.peers_for_tweets[0], sql, (txs) => {
      for (let z = 0; z < txs.length; z++) {
        let tweet = new Tweet(this.app, this.mod, ".redsquare-appspace-body", txs[z]);
        tweet.render();
      }
    }, false, false);

  }

  renderMoreTweets() {
    for (let i = 0; i < this.mod.tweets.length; i++) {
      if (this.mod.tweets[i].updated_at > this.mod.tweets_last_viewed_ts) {
        this.mod.tweets_last_viewed_ts = this.mod.tweets[i].updated_at;
      }
      this.mod.tweets[i].container = ".redsquare-appspace-body";
      this.mod.tweets[i].renderWithCriticalChild();

    }


    this.attachEvents();
  }


  renderNewTweets() {
    for (let i = 0; i < this.mod.tweets.length; i++) {
      if (this.mod.tweets[i].updated_at > this.mod.tweets_last_viewed_ts) {
        this.mod.tweets_last_viewed_ts = this.mod.tweets[i].updated_at;
      }
      this.mod.tweets[i].container = ".redsquare-appspace-body";
      this.mod.tweets[i].renderWithCriticalChild();

    }

    this.attachEvents();

  }
****/

}

module.exports = AppspaceHome;



