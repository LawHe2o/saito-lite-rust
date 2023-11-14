module.exports = (app, mod, post) => {
  let placeholder = "What's happening";


  return `

    <div class="tweet-overlay hide-scrollbar" id="tweet-overlay">
      <div class="tweet-overlay-content">
        <div class="tweet-overlay-header"></div>

        <!--textarea rows="7" class="post-tweet-textarea" name="post-tweet-textarea" id="post-tweet-textarea" placeholder="${placeholder}" cols="60"></textarea-->
  
        <div id="post-tweet-img-preview-container" class="post-tweet-img-preview-container"></div>

        <!--div class="tweet-overlay-content-controls">
          <div class="post-tweet-img-icon" id="post-tweet-img-icon"><i class="fa-solid fa-image"></i></div>
          <div class="saito-gif-icon-container"><div class="saito-gif gif-icon"></div></div>
          <div class="saito-emoji-icon-container"></div>
          <div class="tweet-overlay-content-controls-spacer"></div>

        </div-->
          <div class="saito-button-primary post-tweet-button" id="post-tweet-button">${post.source}</div>
      </div>

      <input type="hidden" id="parent_id" name="parent_id" value="${post.parent_id}" />
      <input type="hidden" id="thread_id" name="thread_id" value="${post.thread_id}" />
      <input type="hidden" id="source" name="source" value="${post.source}" />

      <section id="post-tweet-loader" class="post-tweet-loader">
        <span class="loading__anim"></span>
      </section>
    
    </div>

  `;
};
