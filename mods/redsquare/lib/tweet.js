const saito = require("./../../../lib/saito/saito");
const SaitoUser = require("./../../../lib/saito/ui/saito-user/saito-user");
const TweetTemplate = require("./tweet.template");
const Link = require("./link");
const Image = require("./image");
const Post = require("./post");
const JSON = require("json-bigint");

class Tweet {
  constructor(app, mod, container = "", tx = null) {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.name = "Tweet";

    //
    // the core
    //
    this.tx = tx;

    //
    // ancillary content is stored in the tx.optional array, where it
    // can be saved back to the network of archive nodes / databases and
    // preserved along with the transaction as optional (unverified) but
    // associated content.
    //
    // this includes information like the number of replies, retweets,
    // likes, and information like open graph images, etc.
    //
    if (!this.tx.optional) {
      this.tx.optional = {};
    }
    if (!this.tx.optional.num_replies) {
      this.tx.optional.num_replies = 0;
    }
    if (!this.tx.optional.num_retweets) {
      this.tx.optional.num_retweets = 0;
    }
    if (!this.tx.optional.num_likes) {
      this.tx.optional.num_likes = 0;
    }
    if (!this.tx.optional.link_properties) {
      this.tx.optional.link_properties = null;
    }
    if (!this.tx.optional.parent_id) {
      this.tx.optional.parent_id = "";
    }
    if (!this.tx.optional.thread_id) {
      this.tx.optional.thread_id = "";
    }
    let txmsg = tx.returnMessage();

    if (txmsg.module !== mod.name){
      console.warn("Attempting to create Tweet from non-Redsquare tx");
      return null;
    }

    // 
    // If I am not part of a thread, become my own thread
    // This value will get propagated to this.thread_id
    //
    this.tx.optional.thread_id = this.tx.transaction.sig;
    //
    // comments will specify parent and thread ids, so we should capture that in the optional
    // field here in the constructor so that we can guarantee they exist
    //
    if (txmsg.data) {
      if (txmsg.data.parent_id) {
        this.tx.optional.parent_id = txmsg.data.parent_id;
      }
      if (txmsg.data.thread_id) {
        this.tx.optional.thread_id = txmsg.data.thread_id;
      }
    }

    //
    // additional variables are created in-memory from the core transaction
    // without the need for re-saving, these are specified below.
    //
    this.text = "";
    this.youtube_id = null;
    this.created_at = this.tx.transaction.ts;
    this.updated_at = this.tx.transaction.ts;

    //
    // the notice shows up at the top of the tweet BEFORE the username and
    // is used for "retweeted by X" or "liked by Y". the userline is the
    // line that goes in the tweet header below the username/address but to
    // the right of the identicon.
    //
    this.notice = "";

    this.user = new SaitoUser(
      app,
      mod,
      `.tweet-${this.tx.transaction.sig} > .tweet-header`,
      this.tx.transaction.from[0].add
    );

    //
    // Default is a new tweet
    //
    this.user.notice = "new post on " + this.formatDate(this.created_at);

    this.children = [];
    this.children_sigs_hmap = {};
    this.unknown_children = [];
    this.unknown_children_sigs_hmap = {};
    this.critical_child = null;
    this.render_after_selector = "";

    this.retweet = null;
    this.retweeters = [];
    this.retweet_tx = null;
    this.links = [];
    this.link = null;
    this.show_controls = 1;
    this.force_long_tweet = false;
    this.is_long_tweet = false;
    this.is_retweet = false;
    
    //
    // Read data from txmsg.data and tx.optional to populate this class
    //
    try {
      this.setKeys(txmsg.data);
    } catch (err) {
      console.log("ERROR 1: " + err);
    }
    try {
      this.setKeys(tx.optional);
    } catch (err) {
      console.log("ERROR 2: " + err);
    }

    this.generateTweetProperties(app, mod, 1);

    //
    // retweets
    //
    if (this.retweet_tx != null) {
      let newtx = new saito.default.transaction();
      newtx.deserialize_from_web(this.app, this.retweet_tx);
      this.retweet = new Tweet(
        this.app,
        this.mod,
        `.tweet-preview-${this.tx.transaction.sig}`,
        newtx
      );
      this.retweet.is_retweet = true;
      this.retweet.show_controls = 0;

    } else {
      //
      // image preview
      //
      if (this.images?.length > 0) {
        this.img_preview = new Image(
          this.app,
          this.mod,
          `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-preview`,
          this
        );
      } else {
        if (this.link != null) {
          this.link_preview = new Link(
            this.app,
            this.mod,
            `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-preview`,
            this
          );
        }
      }
    }
  }

  formatDate(ts = 0){
    let dt = this.app.browser.formatDate(ts || this.updated_at);
    return `${dt.month} ${dt.day}, ${dt.year} at ${dt.hours}:${dt.minutes}`;
  }

  isRendered() {
    if (document.querySelector(`.tweet-${this.tx.transaction.sig}`)) {
      return true;
    }
    return false;
  }

  remove() {
    let eqs = `.tweet-${this.tx.transaction.sig}`;
    if (document.querySelector(eqs)) {
      document.querySelector(eqs).remove();
    }
  }

  render(prepend = false) {
    // double-rendering is possible with commented retweets
    if (this.isRendered()) {
      return;
    }

    let myqs = `.tweet-${this.tx.transaction.sig}`;
    let replace_existing_element = true;

    let has_reply = false;
    let has_reply_disconnected = false;

    //
    // we might be re-rendering when critical child is on screen, so check if the
    // class exists and flag if so
    //
    if (document.querySelector(myqs)) {
      let obj = document.querySelector(myqs);
      if (obj.classList.contains("has-reply")) {
        has_reply = true;
      }
      if (obj.classList.contains("has-reply-disconnected")) {
        has_reply_disconnected = true;
      }
    }

    //
    //
    //
    if (this.updated_at > this.created_at) {
      if (this.num_replies > 0) {
        this.user.notice = "new reply on " + this.formatDate();
      }
    }

    //
    // if prepend = true, remove existing element
    //
    if (prepend == true) {
      let eqs = ".tweet-" + this.tx.transaction.sig;
      if (document.querySelector(eqs)) {
        document.querySelector(eqs).remove();
      }
    }

    //
    // retweets displayed in container even if master exists elsewhere on page
    //
    if (this.is_retweet) {
      myqs = this.container;
      replace_existing_element = true;
    } else {
      //
      // this isn't retweet, but if the original exists, we want to ignore
      // it unless it is parent-level (top thread).
      //
      if (document.querySelector(myqs)) {
        let obj = document.querySelector(myqs);
        let parent = obj.parentElement;
        if (parent.classList.contains("tweet-main")) {
          replace_existing_element = false;
        }
      }
    }

    //
    // retweets without commentary? pass-through and render subtweet
    //
    //
    // this is if i retweet my own tweet
    //
    if (!this.text && this.retweet_tx) {
      //
      // i am retweeting myself
      //
      this.retweet.notice =
        "retweeted by " + this.app.browser.returnAddressHTML(this.tx.transaction.from[0].add) + this.formatDate();
      this.retweet.container = ".tweet-" + this.retweet.tx.transaction.sig;
      
      let t = this.mod.returnTweet(this.retweet.tx.transaction.sig);
      if (t) {
        t.notice = this.retweet.notice;
        t.render(prepend);
      } else {
        this.retweet.render(prepend);
      }
      return;
    }

    //
    // remove if selector does not exist
    // - if we click on a child we rerender but w/o parent just insert in container
    // why? I want to expand to see the whole thread
    if (this.render_after_selector) {
      if (!document.querySelector(this.render_after_selector)) {
        this.render_after_selector = "";
      }
    }

    if (!this.container) {
      this.container = ".tweet-manager";
    }

    if (replace_existing_element && document.querySelector(myqs)) {
      this.app.browser.replaceElementBySelector(TweetTemplate(this.app, this.mod, this), myqs);
    } else {
      if (prepend) {
        this.app.browser.prependElementToSelector(
          TweetTemplate(this.app, this.mod, this),
          this.container
        );
      } else {
        if (this.render_after_selector) {
          this.app.browser.addElementAfterSelector(
            TweetTemplate(this.app, this.mod, this),
            this.render_after_selector
          );
        } else {
          this.app.browser.addElementToSelector(
            TweetTemplate(this.app, this.mod, this),
            this.container
          );
        }
      }
    }

    //
    // has-reply and has-reply-disconnected
    //
    if (has_reply) {
      let obj = document.querySelector(myqs);
      if (obj) {
        obj.classList.add("has-reply");
      }
    }
    if (has_reply_disconnected) {
      let obj = document.querySelector(myqs);
      if (obj) {
        obj.classList.add("has-reply-disconnected");
      }
    }

    //
    // modify width of any iframe
    //
    if (this.youtube_id != null && this.youtube_id != "null") {
      let tbqs = myqs + " .tweet-body .tweet-main";
      let ytqs = myqs + " .tweet-body .tweet-main .youtube-embed";
      if (document.querySelector(tbqs)) {
        let x = document.querySelector(tbqs).getBoundingClientRect();
        let y = document.querySelector(ytqs);
        if (x) {
          if (y) {
            y.style.width = Math.floor(x.width) + "px";
            y.style.height = Math.floor((x.width / 16) * 9) + "px";
          }
        }
      }
    }

    this.user.render();

    if (this.retweet != null) {
      this.retweet.render();
    }
    if (this.img_preview != null) {
      this.img_preview.render();
    }
    if (this.link_preview != null) {
      if (this.tx.optional.link_properties != null) {
        if (Object.keys(this.tx.optional.link_properties).length > 0) {
          this.link_preview.render();
        }
      }
    }

    this.attachEvents();
  }

  renderWithCriticalChild(prepend = false) {

    this.render(prepend);

    if (this.critical_child) {
      this.critical_child.render_after_selector = ".tweet-" + this.tx.transaction.sig;
      this.critical_child.render();

      let myqs = `.tweet-${this.tx.transaction.sig}`;
      let obj = document.querySelector(myqs);
      if (obj) {
        if (this.critical_child.parent_id == this.tx.transaction.sig) {
          obj.classList.add("has-reply");
        } else {
          obj.classList.add("has-reply-disconnected");
        }
      }
    }

    this.attachEvents();
  }

  renderWithChildren() {
    //
    // first render the tweet
    //
    this.render();

    //
    // then render its children
    //
    if (this.children.length > 0) {
      if (
        this.children[0].tx.transaction.from[0].add === this.tx.transaction.from[0].add ||
        this.children.length == 1
      ) {
        if (this.children[0].children.length > 0) {
          this.children[0].container = this.container;
          this.children[0].renderWithChildren();
        } else {
          for (let i = 0; i < this.children.length; i++) {
            this.children[i].container = this.container;
            this.children[i].render_after_selector = `.tweet-${this.tx.transaction.sig}`;
            this.children[i].render();
          }
        }
      } else {
        for (let i = 0; i < this.children.length; i++) {
          this.children[i].container = this.container;
          this.children[i].render_after_selector = `.tweet-${this.tx.transaction.sig}`;
          this.children[i].render();
        }
      }
    }

    this.attachEvents();
  }


  attachEvents() {
    let mod = this.mod;
    let app = this.app;

    if (this.show_controls == 0) {
      return;
    }

    try {
      //
      // tweet does not exist? exit
      //
      let this_tweet = document.querySelector(`.tweet-${this.tx.transaction.sig}`);
      if (!this_tweet) {
        return;
      }

      /////////////////////////////
      // Expand / Contract Tweet //
      /////////////////////////////
      //
      // if you don't want a tweet to auto-contract on display, set this.is_long_tweet
      // to be true before running attachEvents(); this will avoid it getting compressed
      // with full / preview toggle.
      //
      let el = document.querySelector(
        `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-text`
      );
      if (!el) {
        return;
      }
      if (!this.force_long_tweet) {
        if (el.clientHeight < el.scrollHeight) {
          el.classList.add("preview");
          this.is_long_tweet = true;
        } else {
          el.classList.add("full");
        }
      } else {
        el.classList.add("full");
      }

      /////////////////
      // view thread //
      /////////////////
      if (!this_tweet.dataset.hasClickEvent) {
        this_tweet.dataset.hasClickEvent = true;
        this_tweet.onclick = (e) => {
          //
          // if we have selected text, then we are trying to copy and paste and
          // the last thing we want is for the UI to update and prevent us from
          // being able to use the site.
          //
          let highlightedText = "";
          if (window.getSelection) {
            highlightedText = window.getSelection().toString();
          } else if (document.selection && document.selection.type != "Control") {
            highlightedText = document.selection.createRange().text;
          }
          if (highlightedText != "") {
            return;
          }

          let tweet_text = document.querySelector(
            `.tweet-${this.tx.transaction.sig} > .tweet-body > .tweet-main > .tweet-text`
          );

          if (this.is_long_tweet) {
            if (!tweet_text.classList.contains("full")) {
              tweet_text.classList.remove("preview");
              tweet_text.classList.add("full");
              this.force_long_tweet = true;
              return;
            } 
          }

          //
          // if we are asking to see a tweet, WE SHOULD load from parent if exists
          //
          if (e.target.tagName != "IMG") {

            //window.location.href = `/redsquare/?tweet_id=${this.thread_id}`;

            window.history.pushState(null, "", `/redsquare/?tweet_id=${this.tx.transaction.sig}`);
            app.connection.emit("redsquare-home-tweet-render-request", this);
          }
        };
      }

      ////////////////////////////////////////////////
      // view preview  -- click on the retweeted post 
      ////////////////////////////////////////////////
      document.querySelectorAll(`.tweet-${this.tx.transaction.sig} .tweet`).forEach((item) => {
        item.addEventListener("click", (e) => {
          console.log("Click to View Original of Retweeted");
          e.stopImmediatePropagation();
          let sig = item.getAttribute("data-id");
          if (e.target.tagName != "IMG" && sig) {
            window.location.href = `/redsquare/?tweet_id=${sig}`;
          }
        });
      });

      ///////////
      // reply //
      ///////////
      document.querySelector(
        `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-controls .tweet-tool-comment`
      ).onclick = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        let tweet_sig = this.tx.transaction.sig;
        if (tweet_sig != null) {
          let post = new Post(this.app, this.mod, this);
          post.parent_id = tweet_sig;
          post.thread_id = this.thread_id;

          post.source = "Reply";
          post.render();
          this.app.browser.prependElementToSelector(
            `<div id="post-tweet-preview-${tweet_sig}" class="post-tweet-preview" data-id="${tweet_sig}"></div>`,
            ".tweet-overlay"
          );

          let newtx = new saito.default.transaction(
            JSON.parse(JSON.stringify(this.tx.transaction))
          );
          newtx.transaction.sig = this.app.crypto.hash(newtx.transaction.sig);
          let new_tweet = new Tweet(this.app, this.mod, `#post-tweet-preview-${tweet_sig}`, newtx);
          new_tweet.show_controls = 0;
          new_tweet.render();
        }
      };

      /////////////
      // retweet //
      /////////////
      document.querySelector(
        `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-controls .tweet-tool-retweet`
      ).onclick = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        let tweet_sig = e.currentTarget.parentNode.parentNode.parentNode.parentNode.getAttribute("data-id");
        if (tweet_sig) {
          let post = new Post(this.app, this.mod, this);

          post.source = "Retweet";
          post.render();

          this.app.browser.prependElementToSelector(
            `<div id="post-tweet-preview-${tweet_sig}" class="post-tweet-preview" data-id="${tweet_sig}"></div>`,
            ".tweet-overlay"
          );

          //Insert this tweet as a new Tweet in the post window
          let newtx = new saito.default.transaction(
            JSON.parse(JSON.stringify(this.tx.transaction))
          );
          newtx.transaction.sig = this.app.crypto.hash(newtx.transaction.sig);
          let new_tweet = new Tweet(this.app, this.mod, `#post-tweet-preview-${tweet_sig}`, newtx);
          new_tweet.show_controls = 0;
          new_tweet.render();
        }
      };

      //////////
      // like //
      //////////
      const heartIcon = document.querySelector(
        `.tweet-${this.tx.transaction.sig} .tweet-like-button .heart-icon`
      );
      heartIcon.onclick = (e) => {
        if (heartIcon.classList.contains("liked")) {
          heartIcon.classList.remove("liked");
          setTimeout(() => {
            heartIcon.classList.add("liked");
          });
        } else {
          heartIcon.classList.add("liked");
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        let tweet_sig =
          e.currentTarget.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.getAttribute(
            "data-id"
          );
        if (tweet_sig != null) {
          this.mod.sendLikeTransaction(this.app, this.mod, { sig: tweet_sig }, this.tx);

          //
          // increase num likes
          //
          let obj = document.querySelector(
            `.tweet-${tweet_sig} .tweet-body .tweet-main .tweet-controls .tweet-tool-like .tweet-tool-like-count`
          );
          obj.innerHTML = parseInt(obj.innerHTML) + 1;
          if (obj.parentNode.classList.contains("saito-tweet-no-activity")) {
            obj.parentNode.classList.remove("saito-tweet-no-activity");
            obj.parentNode.classList.add("saito-tweet-activity");
          }
        }
      };

      ///////////
      // share //
      ///////////
      document.querySelector(
        `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-controls .tweet-tool-share`
      ).onclick = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        let tweet_sig =
          e.currentTarget.parentNode.parentNode.parentNode.parentNode.getAttribute("data-id");
        if (tweet_sig != null) {
          let tweetUrl =
            window.location.origin + window.location.pathname + "?tweet_id=" + tweet_sig;
          navigator.clipboard.writeText(tweetUrl).then(() => {
            siteMessage("Link copied to clipboard.", 2000);
          });
        }
      };

      //////////
      // flag //
      //////////
      document.querySelector(
        `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-controls .tweet-tool-flag`
      ).onclick = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        let tweet_sig =
          e.currentTarget.parentNode.parentNode.parentNode.parentNode.getAttribute("data-id");
        if (tweet_sig != null) {
          this.mod.sendFlagTransaction(this.app, this.mod, { sig: tweet_sig }, this.tx);
          let obj = document.querySelector(`.tweet-flag-${tweet_sig}`);
          if (obj) {
            obj.classList.add("saito-tweet-activity");
          }
          obj = document.querySelector(`.tweet-${tweet_sig}`);
          if (obj) {
            obj.style.display = "none";
          }
          salert("Tweet reported to moderators successfully.");
        }
      };
    } catch (err) {
      console.log("ERROR attaching events to tweet: " + err);
    }
  }

  setKeys(obj) {
    for (let key in obj) {
      if (typeof obj[key] !== "undefined") {
        if (
          this[key] === 0 ||
          this[key] === "" ||
          this[key] === null ||
          typeof this[key] === "undefined"
        ) {
          this[key] = obj[key];
        }
      }
    }
  }

  addTweet(tweet, levels_deep = 0) {
    //
    // this means we know the comment is supposed to be somewhere in this thread/parent
    // but its own parent doesn't yet exist, so we are simply going to store it here
    // until we possibly add the parent (where we will check all unknown children) for
    // placement then.
    //

    //
    // make this UNKNOWN tweet our critical child if we do not have any critical children
    //
    if (!this.critical_child) {
      this.critical_child = tweet;
      if (tweet.created_at > this.updated_at) {
        //
        // April 14, 2023 - do not show critical children unless 2nd level
        //
        this.user.notice = "new reply on " + this.formatDate(tweet.created_at);
      }
    }

    //
    // if this tweet is the parent-tweet of a tweet we have already downloaded
    // and indexed here. this can happen if tweets arrive out-of-order.
    //
    for (let i = 0; i < this.unknown_children.length; i++) {
      if (this.unknown_children[i].parent_id === tweet.tx.transaction.sig) {
        if (this.isCriticalChild(this.unknown_children[i])) {
          this.critical_child = this.unknown_children[i];
          //
          // April 14, 2023 - do not show critical children unless 2nd level
          // - since we are adding a child, we do a levels check on OURSELVERS
          //
          if (levels_deep == 0) {
            this.updated_at = this.critical_child.updated_at;
          }
          
          this.user.notice = "new reply on " + this.formatDate();
              
        }
        this.unknown_children[i].parent_tweet = tweet;

        //
        // tweet adds its orphan
        //
        tweet.addTweet(this.unknown_children[i], levels_deep + 1);

        //
        // and delete from unknown children
        //
        this.removeUnknownChild(this.unknown_children[i]);
      }
    }

    //
    // tweet is direct child
    //
    if (tweet.parent_id == this.tx.transaction.sig) {
      //
      // already added?
      //
      if (this.children_sigs_hmap[tweet.tx.transaction.sig]) {
        return 0;
      }

      //
      // make critical child if needed
      //
      if (
        this.isCriticalChild(tweet) ||
        (tweet.tx.transaction.ts > this.updated_at && this.critical_child == null)
      ) {
        this.critical_child = tweet;
        //
        // April 14, 2023 - do not show critical children unless 2nd level
        // - since we are adding a child, we do a levels check on OURSELVERS
        //
        if (levels_deep == 0) {
          if (tweet.created_at > this.updated_at) {
            this.updated_at = tweet.created_at;
          }
        }

        this.user.notice = "new reply on " + this.formatDate();
      }

      //
      // prioritize tweet-threads
      //
      if (tweet.tx.transaction.from[0].add === this.tx.transaction.from[0].add) {
        this.children.unshift(tweet);
        this.children_sigs_hmap[tweet.tx.transaction.sig] == 1;
        this.removeUnknownChild(tweet);
        return 1;
      } else {
        tweet.parent_tweet = this;
        this.children.push(tweet);
        this.children_sigs_hmap[tweet.tx.transaction.sig] == 1;
        this.removeUnknownChild(tweet);
        return 1;
      }

      //
      // tweet belongs to a child
      //
    } else {
      //
      // maybe it is a critical child
      //
      if (this.isCriticalChild(tweet)) {
        this.critical_child = tweet;
        //
        // April 14, 2023 - do not show critical children unless 2nd level
        // - since we are adding a child, we do a levels check on OURSELVERS
        //
        if (levels_deep == 0) {
          if (tweet.created_at > this.updated_at) {
            this.updated_at = tweet.created_at;
          }
        }

        this.user.notice = "new reply on " + this.formatDate();
      }

      if (this.children_sigs_hmap[tweet.parent_id]) {
        for (let i = 0; i < this.children.length; i++) {
          if (this.children[i].addTweet(tweet, levels_deep + 1)) {
            this.removeUnknownChild(tweet);
            this.children_sigs_hmap[tweet.tx.transaction.sig] = 1;
            //
            // April 14, 2023 - do not show critical children unless 2nd level
            // - since we are adding a child, we do a levels check on OURSELVERS
            //
            if (levels_deep == 0) {
              this.updated_at = tweet.updated_at;
              if (tweet.created_at > this.updated_at) {
                this.updated_at = tweet.created_at;
              }
            }

            this.user.notice = "new reply on " + this.formatDate();
            return 1;
          }
        }
      } else {
        //
        // if still here, add to unknown children if top-level as we didn't add to any children
        //
        if (levels_deep == 0) {
          if (this.unknown_children_sigs_hmap[tweet.tx.transaction.sig] != 1) {
            this.unknown_children.push(tweet);
            this.unknown_children_sigs_hmap[tweet.tx.transaction.sig] = 1;
          }
        }
      }
    }

    return 1; //? or 0?
  }

  /////////////////////
  // query children  //
  /////////////////////
  hasChildTweet(tweet_sig) {
    if (this.tx.transaction.sig == tweet_sig) {
      return 1;
    }
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].hasChildTweet(tweet_sig)) {
        return 1;
      }
    }
    return 0;
  }
  returnChildTweet(tweet_sig) {
    if (this.tx.transaction.sig == tweet_sig) {
      return this;
    }
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].hasChildTweet(tweet_sig)) {
        return this.children[i].returnChildTweet(tweet_sig);
      }
    }
    return null;
  }

  removeUnknownChild(tweet) {
    if (this.unknown_children_sigs_hmap[tweet.tx.transaction.sig] == 1) {
      for (let i = 0; i < this.unknown_children.length; i++) {
        if (this.unknown_children[i].tx.transaction.sig === tweet.tx.transaction.sig) {
          this.unknown_children.splice(i, 0);
          delete this.unknown_children_sigs_hmap[tweet.tx.transaction.sig];
        }
      }
    }
  }

  isCriticalChild(tweet) {
    //
    // TODO -- changed comparison to !== March 13, right?
    //
    if (tweet.thread_id !== this.thread_id) {
      return false;
    }
    for (let i = 0; i < tweet.tx.transaction.to.length; i++) {
      if (tweet.tx.transaction.to[i].add === this.app.wallet.returnPublicKey()) {
        if (this.critical_child == null) {
          return true;
        }
        if (tweet.tx.transaction.ts > this.critical_child.tx.transaction.tx) {
          return true;
        }
      }
    }
    return false;
  }

  async generateTweetProperties(app, mod, fetch_open_graph = 0) {
    if (this.text == null) {
      return this;
    }

    let expression = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
    let links = this.text.match(expression);

    if (links != null && links.length > 0) {
      //
      // save the first link
      //
      let link = new URL(links[0]);
      this.link = link.toString();

      //
      // youtube link
      //
      if (this.link.indexOf("youtube.com") != -1 || this.link.indexOf("youtu.be") != -1) {
        let videoId = "";

        if (this.link.indexOf("youtu.be") != -1) {
          videoId = this.link.split("/");
          videoId = videoId[videoId.length - 1];
        } else {
          let urlParams = new URLSearchParams(link.search);
          videoId = urlParams.get("v");
        }

        if (videoId != null && videoId != "null") {
          this.youtube_id = videoId;
        }
        return this;
      }

      //
      // normal link
      //
      if (fetch_open_graph == 1) {
        //
        // Returns "" if a browser or error
        //
        let res = await mod.fetchOpenGraphProperties(app, mod, this.link);
        if (res !== "") {
          this.tx.optional.link_properties = res;
        }
      }
    }

    return this;
  }

  renderLikes() {
    // some edge cases where tweet won't have rendered
    try {
      let qs = `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-controls .tweet-tool-like .tweet-tool-like-count`;
      let obj = document.querySelector(qs);
      let likes = this.tx?.optional?.num_likes || 0;
      if (obj) {
        obj.innerHTML = likes;
      }
    } catch (err) {}
  }
  renderRetweets() {
    // some edge cases where tweet won't have rendered
    try {
      let qs = `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-controls .tweet-tool-retweet .tweet-tool-retweet-count`;
      let obj = document.querySelector(qs);
      let retweets = this.tx?.optional?.num_retweets || 0;
      if (obj) {
        obj.innerHTML = retweets;
      }
    } catch (err) {}
  }
  renderReplies() {
    // some edge cases where tweet won't have rendered
    try {
      let qs = `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-controls .tweet-tool-comment .tweet-tool-comment-count`;
      let obj = document.querySelector(qs);
      let replies = this.tx?.optional?.num_replies || 0;
      if (obj) {
        obj.innerHTML = replies;
      }
    } catch (err) {}
  }

}

module.exports = Tweet;
