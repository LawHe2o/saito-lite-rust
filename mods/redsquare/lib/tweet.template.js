//const SaitoUser = require('./../../../lib/saito/ui/templates/saito-user.template');

module.exports = (app, mod, tweet) => {

  let optional = tweet.tx.optional;
  let notice = tweet?.notice || "";
  let text = tweet?.text || "";
 
  if (!text && !notice && tweet.retweet_tx) {
    notice = "retweeted by " + app.browser.returnAddressHTML(tweet.tx.transaction.from[0].add);
  }

  let num_likes =  optional.num_likes ||  0;
  let num_replies =  optional.num_replies ||  0;
  let num_retweets = optional.num_retweets || 0;

  let controls = `
              <div class="tweet-controls">
                <div class="tweet-tool tweet-tool-comment">
                  <span class="tweet-tool-comment-count">${num_replies}</span> <i class="far fa-comment"></i>
                </div>
                <div class="tweet-tool tweet-tool-retweet"><span class="tweet-tool-retweet-count">${num_retweets}</span>
                  <i class="fa fa-repeat"></i>
                </div>
                <div class="tweet-tool tweet-tool-like"><span class="tweet-tool-like-count  ">${num_likes}</span> <div class="tweet-like-button">
                <div class="heart-bg">
                  <div class="heart-icon"></div>
                </div>
              </div></div>
                    
                <div class="tweet-tool tweet-tool-share "><i class="fa fa-arrow-up-from-bracket"></i>
                </div>
                <div class="tweet-tool tweet-tool-flag"><i class="fa fa-flag"></i></div>
              </div>`;

  let html = `
        <div class="tweet tweet-${tweet.tx.transaction.sig}" data-id="${tweet.tx.transaction.sig}">
          <div class="tweet-notice">${notice}</div>
          <div class="tweet-header"></div>
          <div class="tweet-body">
            <div class="tweet-sidebar">
            </div>
            <div class="tweet-main">
              <div class="tweet-text">${app.browser.sanitize(text)}</div>`;

  if (tweet.youtube_id != null && tweet.youtube_id != "null") {
    html += `<iframe class="youtube-embed" src="https://www.youtube.com/embed/${tweet.youtube_id}"></iframe>`;
  } else {
    html += `<div class="tweet-preview tweet-preview-${tweet.tx.transaction.sig}"></div>`;
  }

  if (tweet?.show_controls){
    html += controls;
  }

  html += `</div>
          </div>
        </div>
  `;

  return html;

}



