module.exports = LiteDreamControlsTemplate = (app, mod, videoEnabled = false) => {

  let html = `
    <div class="dream-controls lite" id="dream-controls">
      <div class="control-panel">
        <div class="timer">
          <div class="counter"> 00:00 </div>
          <div class="stun-identicon-list"></div>
        </div>  
        <div class="control-list">`;


  html += `<div id="dreamspace-member-count" class="members-control icon_click_area">
            <i class="fa-solid fa-users"></i>
          </div>
          <div class="share-control icon_click_area">
            <i class="fa-solid fa-share-nodes"></i>
          </div>
          `;
  
  if (mod.publicKey == mod.dreamer){
    html += `<div class="stream-control icon_click_area click-me">
            <i class="fas fa-play"> </i>
          </div>`;
  }


  if (mod.publicKey == mod.dreamer){
    html += `<div class="disconnect-control icon_click_area">
             <i class="fa-solid fa-x"></i>
          </div>`;
  }else{
    html += `<div class="icon_click_area">
            <i class="fas ${videoEnabled ? mod.camera_icon : mod.audio_icon}"> </i>
          </div>`;

  }

  html += `</div>
      </div>
    </div>`;


    return html;
};
