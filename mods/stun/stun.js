const saito = require("../../lib/saito/saito");
const ModTemplate = require("../../lib/templates/modtemplate");
const StunLauncher = require("./lib/appspace/call-launch");
const CallInterfaceVideo = require("./lib/components/call-interface-video");
const CallInterfaceFloat = require("./lib/components/call-interface-float");
const DialingInterface = require("./lib/appspace/dialer");
const PeerManager = require("./lib/appspace/PeerManager");

//Do these do anything???
var serialize = require("serialize-javascript");
const adapter = require("webrtc-adapter");
const { default: Transaction } = require("../../lib/saito/transaction");
const StreamManager = require("./lib/appspace/StreamManager");
const Slip = require("../../lib/saito/slip").default;

class Stun extends ModTemplate {
  constructor(app) {
    super(app);
    this.app = app;
    this.appname = "Video Call";
    this.name = "Stun";
    this.slug = this.returnSlug();
    this.description = "P2P Video & Audio Connection Module";
    this.categories = "Utilities Communications";
    this.icon = "fas fa-video";
    this.request_no_interrupts = true; // Don't let chat popup inset into /videocall
    this.isRelayConnected = false;
    this.hasReceivedData = {};
    this.servers = [
      {
        urls: "turn:stun-sf.saito.io:3478",
        username: "guest",
        credential: "somepassword",
      },
      {
        urls: "turn:stun-sg.saito.io:3478",
        username: "guest",
        credential: "somepassword",
      },
      {
        urls: "turn:stun-de.saito.io:3478",
        username: "guest",
        credential: "somepassword",
      },

      // Firefox gives a warning if you provide more than two servers and
      // throws an error if you use 5 or more.
      // is it redundant to have both turn and stun on the same server, since 
      //
      // " TURN (Traversal Using Relay NAT) is the more advanced solution that incorporates 
      // the STUN protocols and most commercial WebRTC based services use a TURN server 
      // for establishing connections between peers. "

      /*{
        urls: "stun:stun-sf.saito.io:3478",
      },
      {
        urls: "stun:stun-sg.saito.io:3478",
      },
      {
        urls: "stun:stun-de.saito.io:3478",
      },*/
    ];

    this.styles = ["/saito/saito.css", "/videocall/style.css"];

    this.streamManager = new StreamManager(app, this);
    this.peerManager = new PeerManager(app, this);
    this.dialer = new DialingInterface(app, this);

    //When StunLauncher is rendered or game-menu triggers it
    app.connection.on("stun-init-call-interface", (ui_type = "large") => {
      if (this.CallInterface) {
        console.warn("Already instatiated a video/audio call manager");
        return;
      }

      if (ui_type === "large") {
        this.CallInterface = new CallInterfaceVideo(app, this);
      } else {
        this.CallInterface = new CallInterfaceFloat(app, this);
      }
    });


    app.connection.on("stun-disconnect", () => {
      this.room_obj = null;
      this.CallInterface = null;
    });
  }

  /**
   * Stun will be rendered on
   *  - /videocall
   *  - Saito-header menu
   *  - Saito-user-menu
   *  - game-menu options
   *
   */

  async initialize(app) {
    await super.initialize(app);

    console.log("STUN: " + this.publicKey);

    if (app.BROWSER) {
      if (app.browser.returnURLParameter("stun_video_chat")) {
        this.room_obj = JSON.parse(
          app.crypto.base64ToString(app.browser.returnURLParameter("stun_video_chat"))
        );

        // JOIN THE ROOM
        if (!this.browser_active) {
          this.renderInto(".saito-overlay");
        }
      }
    }
  }

  async onPeerServiceUp(app, peer, service) {
    if (app.BROWSER !== 1) {
      return;
    }

    if (service.service === "relay") {
      if (app.BROWSER !== 1) {
        return;
      }

      this.isRelayConnected = true;
    }
  }

  render() {
    this.renderInto("body");
  }

  renderInto(qs) {
    if (qs == ".saito-overlay" || qs == "body") {
      if (!this.renderIntos[qs]) {
        this.renderIntos[qs] = [];
        this.renderIntos[qs].push(new StunLauncher(this.app, this, qs));
      }
      this.attachStyleSheets();
      this.renderIntos[qs].forEach((comp) => {
        comp.render();
      });
      this.renderedInto = qs;
    }
  }

  respondTo(type = "") {
    // console.log(type, obj);
    let stun_self = this;
    let obj = arguments[1];

    if (type === "user-menu") {
      if (obj?.publicKey) {
        if (obj.publicKey !== this.app.wallet.publicKey) {
          this.attachStyleSheets();
          super.render(this.app, this);
          return [
            {
              text: "Video/Audio Call",
              icon: "fas fa-video",
              callback: function (app, public_key) {
                stun_self.dialer.establishStunCallWithPeers([public_key]);
              },
            },
          ];
        }
      }
    }

    if (type === "invite") {
      this.attachStyleSheets();
      super.render(this.app, this);
      return new StunxInvite(this.app, this);
    }

    if (type === "saito-header") {
      this.attachStyleSheets();
      super.render(this.app, this);

      return [
        {
          text: "Video Call",
          icon: this.icon,
          allowed_mods: ["redsquare", "arcade"],
          callback: function (app, id) {
            stun_self.renderInto(".saito-overlay");
          },
        },
      ];
    }
    //
    //Game-Menu passes the game_mod as the obj, so we can test if we even want to add the option
    //
    if (type == "game-menu") {
      this.attachStyleSheets();
      super.render(this.app, this);
      if (obj?.game?.players?.length > 1) {
        return {
          id: "game-social",
          text: "Chat / Social",
          submenus: [
            {
              parent: "game-social",
              text: "Voice Chat",
              id: "group-voice-chat",
              class: "group-voice-chat",
              callback: null,
            },
            {
              parent: "group-voice-chat",
              text: "Start call",
              id: "start-group-video-chat",
              class: "start-group-video-chat",
              callback: function (app, game_mod) {
                //Start Call
                game_mod.menu.hideSubMenus();
                stun_self.dialer.establishStunCallWithPeers([...game_mod.game.players]);
              },
            },
            {
              parent: "game-social",
              text: "Record Game",
              id: "record-stream",
              class: "record-stream",
            },
            {
              parent: "record-stream",
              text: "Record with camera",
              id: "record-with-camera",
              class: "record-with-camera",
              callback: function (app, game_mod) {
                game_mod.menu.hideSubMenus();
                stun_self.streamManager.recordGameStream(true);
              },
            },
            {
              parent: "record-stream",
              text: "Record without camera",
              id: "record-without-camera",
              class: "record-without-camera",
              callback: function (app, game_mod) {
                game_mod.menu.hideSubMenus();
                // game_mod.addMenuOption("stop-record-stream", "Stop recording");
                stun_self.streamManager.recordGameStream();
              },
            },
            {
              parent: "record-stream",
              text: "Stop recording",
              id: "stop-recording",
              class: "stop-recording",
              callback: function (app, game_mod) {
                game_mod.menu.hideSubMenus();
                // game_mod.addMenuOption("stop-record-stream", "Stop recording");
                stun_self.streamManager.stopRecordGameStream();
              },
            },
          ],
        };
      }
    }

    return null;
  }

  onConfirmation(blk, tx, conf) {
    if (tx == null) {
      return;
    }

    let message = tx.returnMessage();

    if (conf === 0) {
      if (message.module === "Stun") {
        //
        // Do we even need/want to send messages on chain?
        // There are problems with double processing events...
        //

        try {
          if (this.app.BROWSER === 1) {
            if (this.hasSeenTransaction(tx)) return;

            if (!this?.room_obj?.room_code || this.room_obj.room_code !== message.data.room_code) {
              console.log("OC: Tab is not active");
              return;
            }
            // if (document.hidden) {
            //   console.log("tab is not active");
            //   return;
            // }

            if (tx.isTo(this.publicKey) && !tx.isFrom(this.publicKey)) {
              if (message.request === "stun-send-call-list-request") {
                //console.log("OnConfirmation:  stun-send-call-list-request");
                this.receiveCallListRequestTransaction(this.app, tx);
              }
              if (message.request === "stun-send-call-list-response") {
                //console.log("OnConfirmation:  stun-send-call-list-response");
                this.receiveCallListResponseTransaction(this.app, tx);
              }

              if (message.request === "stun-send-message-to-peers") {
                //console.log("OnConfirmation: stun-send-message-to-peers");
                this.peerManager.handleSignalingMessage(tx.msg.data);
              }

            }
          }
        } catch (err) {
          console.error("Stun Error:", err);
        }
      }
    }
  }

  async handlePeerTransaction(app, tx = null, peer, mycallback) {
    if (tx == null) {
      return;
    }
    let txmsg = tx.returnMessage();

    if (this.app.BROWSER === 1) {
      if (tx.isTo(this.publicKey) && !tx.isFrom(this.publicKey)) {
        //console.log(txmsg);

        if (txmsg.request.substring(0, 10) == "stun-send-") {

          if (this.hasSeenTransaction(tx)) return;

          if (!this?.room_obj?.room_code || this.room_obj.room_code !== txmsg.data.room_code) {
            console.log("HPT: Tab is not active");
            return;
          }

          if (txmsg.request === "stun-send-call-list-request") {
            console.log("HPT:  stun-send-call-list-request");
            this.receiveCallListRequestTransaction(this.app, tx);
            return;
          }
          if (txmsg.request === "stun-send-call-list-response") {
            console.log("HPT:  stun-send-call-list-response");
            this.receiveCallListResponseTransaction(this.app, tx);
            return;
          }

          if (txmsg.request === "stun-send-message-to-peers") {
            console.log("HPT: stun-send-message-to-peers");
            this.peerManager.handleSignalingMessage(tx.msg.data);
            return;
          }

          console.warn("Unprocessed request:");
          console.log(txmsg);

        } else if (txmsg.request.substring(0, 5) == "stun-") {

          this.dialer.receiveStunCallMessageFromPeers(tx);

        }
      }
    }

    return super.handlePeerTransaction(app, tx, peer, mycallback);
  }

  createRoomCode() {
    return this.app.crypto.generateRandomNumber().substring(0, 12);
  }

  async sendStunMessageToPeersTransaction(_data, recipients) {
    //console.log("sending to peers ", recipients, " data ", _data);
    let request = "stun-send-message-to-peers";

    let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee();

    if (recipients) {
      recipients.forEach((recipient) => {
        if (recipient) {
          newtx.addTo(recipient);
        }
      });
    }
    newtx.msg.module = "Stun";
    newtx.msg.request = request;
    newtx.msg.data = _data;
    newtx.msg.data.module = "Stun";

    newtx.msg.data.timestamp = Date.now();

    await newtx.sign();

    this.app.connection.emit("relay-transaction", newtx);

    this.app.network.propagateTransaction(newtx);
  }

  async sendCallEntryTransaction(public_key = "") {
    if (!this.room_obj) {
      console.error("No room object");
      return;
    }

    if (!public_key) {
      public_key = this.room_obj?.host_public_key;
    }

    let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(public_key);

    let request = "stun-send-call-list-request";

    newtx.msg.module = "Stun";
    newtx.msg.request = request;

    let data = {
      room_code: this.room_obj.room_code,
    };

    newtx.msg.data = data;
    newtx.msg.data.module = "Stun";
    await newtx.sign();

    this.app.connection.emit("relay-transaction", newtx);
    this.app.network.propagateTransaction(newtx);
  }

  async receiveCallListRequestTransaction(app, tx) {
    let txmsg = tx.returnMessage();

    let from = tx.from[0].publicKey;
    let call_list = [];
    let peers = this.app.options?.stun;

    if (peers) {
      peers.forEach((key) => {
        if (!call_list.includes(key)) {
          call_list.push(key);
        }
      });
    }

    if (!call_list.includes(this.publicKey)) {
      call_list.push(this.publicKey);
    }

    console.log("STUN: call list", call_list);

    this.sendCallListResponseTransaction(from, call_list);
  }

  async sendCallListResponseTransaction(public_key, call_list) {
    let request = "stun-send-call-list-response";
    let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(public_key);

    newtx.msg.module = "Stun";
    newtx.msg.request = request;
    let data = {
      call_list,
      room_code: this.room_obj.room_code,
    };

    newtx.msg.data = data;
    newtx.msg.data.module = "Stun";

    await newtx.sign();

    this.app.connection.emit("relay-transaction", newtx);

    this.app.network.propagateTransaction(newtx);
  }

  async receiveCallListResponseTransaction(app, tx) {
    let txmsg = tx.returnMessage();

    let call_list = txmsg.data.call_list;
    // remove my own key
    call_list = call_list.filter((key) => this.publicKey !== key);

    let room_code = txmsg.data.room_code;

    let _data = {
      type: "peer-joined",
      public_key: this.publicKey,
      room_code,
    };

    await this.sendStunMessageToPeersTransaction(_data, call_list);
  }

  hasSeenTransaction(tx) {
    let hashed_data = tx.signature;

    // this.app.crypto.stringToBase64(txmsg.data) can be short or very long!
    // signature = 128 characters
    // running signature though stringToBase64 or stringToHex makes it longer (172, 256 respectively)
    //

    if (this.hasReceivedData[hashed_data]) {
      return true;
    }
    this.hasReceivedData[hashed_data] = true;

    return false;
  }
}

module.exports = Stun;
