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
          if (this.app.browser.returnURLParameter('user_id') || this.app.browser.returnURLParameter('tweet_id')) { return; }

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
    tweets[0].force_long_tweet = true;
    tweets[0].renderWithChildren();


    document.querySelectorAll('.tweet-text').forEach(item => {
      if (item.classList.contains('preview')) {
        item.classList.replace('preview', 'full')
      }
    })


    document.querySelector('.saito-container').scrollTo({top:0, left:0, behavior:"smooth"});

    this.attachEvents();

  }



  attachEvents() {

    this.intersectionObserver.observe(document.querySelector('#redsquare-intersection'));

  }

}

module.exports = AppspaceHome;



