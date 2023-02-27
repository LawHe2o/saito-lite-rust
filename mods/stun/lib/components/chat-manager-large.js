const VideoBox = require('./video-box');
const ChatManagerLargeTemplate = require('./chat-manager-large.template');
const ChatInvitationOverlay = require('../overlays/chat-invitation-link');
const Effects = require('../overlays/effects');


class VideoChatManager {

  // peers = {};
  localStream;
  room_code;
  // my_pc = [];
  video_boxes = {}
  videoEnabled = true;
  audioEnabled = true;
  isActive = false;
  waitSeconds = 0;
  waitTimer = null;


  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.effectsMenu = new Effects(app, mod)

    this.app.connection.on('show-video-chat-request', (app, mod, ui_type, call_type = "Video", room_code) => {
      if (ui_type !== "large") return
      this.call_type = "video"
      this.room_code = room_code
      this.ui_type = "large";
      this.show(app, mod);
    })
    this.app.connection.on('render-local-stream-request', (localStream, ui_type) => {
      if (!this.isActive) return;
      if (ui_type !== "large") return
      this.renderLocalStream(localStream)
      // this.updateRoomLink()
    })
    this.app.connection.on('add-remote-stream-request', (peer, remoteStream, pc, ui_type) => {
      if (!this.isActive) return;
      if (ui_type !== "large") return
      this.addRemoteStream(peer, remoteStream, pc)
      // this.updateRoomLink()
    });
    this.app.connection.on('render-remote-stream-placeholder-request', (peer, ui_type) => {
      if (!this.isActive) return;
      if (ui_type !== "large") return
      this.renderRemoteStreamPlaceholder(peer);
      // this.updateRoomLink()
    });

    this.app.connection.on('change-connection-state-request', (peer, state, ui_type, call_type, room_code) => {
      if (!this.isActive) return;
      if (ui_type !== "large" || this.room_code !== room_code) return
      this.updateConnectionState(peer, state)
      // this.updateRoomLink()
    })

    this.app.connection.on('stun-receive-media-offer', ({ room_code, offer_creator, recipient }) => {
      if (!this.isActive) return;
      console.log(room_code, offer_creator, recipient, 'stun-receive-media-offer')
      if (room_code !== this.room_code) {
        return;
      }

      let my_public_key = this.app.wallet.getPublicKey()
      if (my_public_key === offer_creator) {
        this.renderRemoteStreamPlaceholder(recipient, "Sending Offer tx");
        this.startWaitTimer(recipient)
      } else {
        this.renderRemoteStreamPlaceholder(offer_creator, "Receiving Offer tx");
        this.startWaitTimer(offer_creator)
      }

    })
  }


  render() {
    this.app.browser.addElementToDom(ChatManagerLargeTemplate(this.call_type, this.room_code), document.getElementById('content__'));
    this.isActive = true;


  }

  attachEvents(app, mod) {
    // app.browser.makeDraggable("stunx-chatbox", null, true);


    document.querySelector('.disconnect_btn').addEventListener('click', (e) => {

      this.disconnect()

      siteMessage("You have been disconnected", 5000);
    })

    let add_users = document.querySelector('.add_users')
    if (add_users) {
      add_users.addEventListener('click', (e) => {
        let public_keys = this.updateRoomLink();
        if (public_keys.length === 1) {
          this.chatInvitationOverlay.render()
        } else {
          salert("Room filled up");
        }

      })
    }
    document.querySelector('.audio_control').addEventListener('click', (e) => {
      this.toggleAudio();
    })
    document.querySelector('.video_control').addEventListener('click', (e) => {
      this.toggleVideo();
    })

    document.querySelector('.effects-control').addEventListener('click', (e) => {
      this.effectsMenu.render();
    })

    document.querySelector('.stunx-chatbox .minimizer').addEventListener('click', (e) => {
      let chat_box = document.querySelector(".stunx-chatbox")
      chat_box.classList.add('minimize');
    })

    document.querySelector('.large-wrapper').addEventListener('click', (e) => {
      let chat_box = document.querySelector('.stunx-chatbox')
      console.log('clicking stunx', e.target.classList, e.target)
      if (chat_box.classList.contains('minimize')) {
        chat_box.classList.remove('minimize')
      }


    })
  }

  updateRoomLink() {
    let public_keys = []
    for (let i in this.video_boxes) {
      if (i === "local") {
        public_keys.push(this.app.wallet.getPublicKey())
      } else {
        public_keys.push(i);
      }
    }
    let obj = {
      room_id: this.room_code,
      public_keys,
    }
    let base64obj = this.app.crypto.stringToBase64(JSON.stringify(obj));

    let url = window.location.toString();
    if (url.includes('?')) {
      let index = url.indexOf('?');
      url = url.slice(0, index);
    }
    let myurl = new URL(url);
    myurl = myurl.href.split('#')[0];
    console.log(myurl, 'myurl')
    this.room_link = `${myurl}?stun_video_chat=${base64obj}`;
    this.chatInvitationOverlay = new ChatInvitationOverlay(this.app, this.mod, this.room_link)

    if (document.querySelector('.add-users-code-container span')) {
      document.querySelector('.add-users-code-container span').textContent = this.room_link.slice(0, 30);
    }

    return public_keys;
  }

  show(app, mod) {
    if (!document.querySelector('.stunx-chatbox')) {
      this.render();
      this.attachEvents(app, mod);

    }
    this.isActive = true
  }

  hide() {
    console.log('hiding')
    document.querySelector('#stunx-chatbox').parentElement.removeChild(document.querySelector('#stunx-chatbox'));
    this.isActive = false;
  }

  disconnect() {
    let stun_mod = this.app.modules.returnModule("Stun");
    console.log("peer connections ", stun_mod.peer_connections);
    stun_mod.closeMediaConnections();

    // remove pair from room
    let sql = `SELECT *
               FROM rooms
               WHERE room_code = "${this.room_code}"`;
    let requestCallback = async (res) => {
      let room = res.rows[0];
      console.log(res, 'res')
      let peers_in_room = JSON.parse(room.peers);
      let my_public_key = this.app.wallet.getPublicKey()
      peers_in_room = peers_in_room.filter(public_key => public_key !== my_public_key)

      const data = {
        peers_in_room: JSON.stringify(peers_in_room),
        peer_count: peers_in_room.length,
        is_max_capacity: false
      }
      stun_mod.sendUpdateRoomTransaction(this.room_code, data);
    }

    stun_mod.sendPeerDatabaseRequestWithFilter('Stun', sql, requestCallback)


    this.localStream.getTracks().forEach(track => {
      track.stop();
      console.log(track);
      console.log('stopping track');
    })
    this.video_boxes = {}
    this.hide();
  }


  addRemoteStream(peer, remoteStream, pc) {
    this.video_boxes[peer].video_box.addStream(remoteStream);
    this.video_boxes[peer].peer_connection = pc;
  }

  renderLocalStream(localStream) {
    const videoBox = new VideoBox(this.app, this.mod, this.ui_type, this.call_type);
    videoBox.render(localStream, 'local', 'large-wrapper');
    this.video_boxes['local'] = { video_box: videoBox, peer_connection: null }
    this.localStream = localStream;
    this.updateImages();
    segmentBackground(document.querySelector('#streamlocal video'), document.querySelector('#streamlocal canvas'), 1);

    // applyBlur(7);
  }


  renderRemoteStreamPlaceholder(peer, placeholder_info) {
    this.createVideoBox(peer, placeholder_info);
    this.video_boxes[peer].video_box.render(null, peer, 'large-wrapper', placeholder_info);
  }

  createVideoBox(peer) {
    if (!this.video_boxes[peer]) {
      const videoBox = new VideoBox(this.app, this.mod, this.ui_type, this.call_type);
      this.video_boxes[peer] = { video_box: videoBox, peer_connection: null }
    }
  }


  updateConnectionState(peer, state) {
    this.createVideoBox(peer)
    this.video_boxes[peer].video_box.handleConnectionStateChange(state);
    switch (state) {
      case "connecting":
        clearInterval(this.waitTimer)
        break;
      case "disconnected":
        delete this.video_boxes[peer];
        this.stopTimer();
        this.updateImages();
        this.mod.closeMediaConnections()
        console.log("video boxes: after ", this.video_boxes);
        break;
      case "connected":
        this.startTimer();
        this.updateImages();
        break;

      case "failed":
        delete this.video_boxes[peer];
        this.stopTimer();
        this.updateImages();
        this.mod.closeMediaConnections()
        console.log("video boxes: after ", this.video_boxes);
        break;

      default:
        break;
    }
  }


  toggleAudio() {
    console.log('toggling audio');
    if (this.audioEnabled === true) {
      this.localStream.getAudioTracks()[0].enabled = false;
      this.audioEnabled = false
      document.querySelector('.audio_control').classList.remove('fa-microphone')
      document.querySelector('.audio_control').classList.add('fa-microphone-slash')
    } else {

      this.localStream.getAudioTracks()[0].enabled = true;

      this.audioEnabled = true;
      document.querySelector('.audio_control').classList.remove('fa-microphone-slash')
      document.querySelector('.audio_control').classList.add('fa-microphone')
    }

  }

  toggleVideo() {
    console.log('toggling video');
    if (this.videoEnabled === true) {
      this.localStream.getVideoTracks()[0].enabled = false;
      this.videoEnabled = false
      document.querySelector('.video_control').classList.remove('fa-video')
      document.querySelector('.video_control').classList.add('fa-video-slash')
    } else {

      this.localStream.getVideoTracks()[0].enabled = true;


      this.videoEnabled = true;
      document.querySelector('.video_control').classList.remove('fa-video-slash')
      document.querySelector('.video_control').classList.add('fa-video')
    }

  }


  startTimer() {
    // if (this.timer_interval) {
    //     return;
    // }
    let timerElement = document.querySelector(".stunx-chatbox .counter");
    let seconds = 0;

    const timer = () => {
      seconds++;

      // Get hours
      let hours = Math.floor(seconds / 3600);
      // Get minutes
      let minutes = Math.floor((seconds - hours * 3600) / 60);
      // Get seconds
      let secs = Math.floor(seconds % 60);

      if (hours < 10) {
        hours = `0${hours}`;
      }
      if (minutes < 10) {
        minutes = `0${minutes}`;
      }
      if (secs < 10) {
        secs = `0${secs}`;
      }

      timerElement.innerHTML = `<sapn style="color:orangered; font-size: 3rem;" >${hours}:${minutes}:${secs} </sapn>`;

    };

    this.timer_interval = setInterval(timer, 1000);
  }

  stopTimer() {
    clearInterval(this.timer_interval)
    this.timer_interval = null
  }

  startWaitTimer(peer) {
    this.waitTimer = setInterval(() => {
      this.waitSeconds += 1;
      if (this.waitSeconds === 10) {
        this.updateConnectionState(peer, 'ten_seconds')
      }
      if (this.waitSeconds === 20) {
        this.updateConnectionState(peer, 'twenty_seconds')
      }
      if (this.waitSeconds === 120) {
        this.updateConnectionState(peer, 'two_minutes')
      }
      if (this.waitSeconds === 180) {
        this.updateConnectionState(peer, 'failed')
        clearInterval(this.waitTimer)
      }
    }, 1000)
  }

  updateImages() {
    let images = ``;
    let count = 0
    console.log('video boxes ', this.video_boxes)
    for (let i in this.video_boxes) {
      if (i === "local") {
        let publickey = this.app.wallet.getPublicKey()
        let imgsrc = this.app.keychain.returnIdenticon(publickey);
        images += `<img data-id="${publickey}" src="${imgsrc}"/>`
      } else {
        let imgsrc = this.app.keychain.returnIdenticon(i);
        images += `<img data-id ="${i}" class="saito-identicon" src="${imgsrc}"/>`
      }
      count++;

    }
    document.querySelector('.stunx-chatbox .image-list').innerHTML = images;
    document.querySelector('.stunx-chatbox .users-on-call-count').innerHTML = count
  }


}


module.exports = VideoChatManager;
