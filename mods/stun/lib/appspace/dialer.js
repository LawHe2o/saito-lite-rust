const SaitoOverlay = require("../../../../lib/saito/ui/saito-overlay/saito-overlay.js");
const DialerTemplate = require("./dialer.template.js");
const CallSetting = require("../components/call-setting.js");
const SaitoUser = require("../../../../lib/saito/ui/saito-user/saito-user");

/**
 *
 * This is a splash screen for calling/answering a P2P Stun call
 *
 **/

class Dialer {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(app, mod);
    this.callSetting = new CallSetting(app, this);
    this.receiver = null;
  }

  render(call_receiver, making_call = true) {
    this.overlay.show(DialerTemplate(this.app, this.mod, making_call), () => {
      if (making_call) {
        this.app.connection.emit("close-preview-window");
      } else {
        this.stopRing();
      }
    });
    this.overlay.blockClose();

    if (!this.receiver) {
      this.receiver = new SaitoUser(
        this.app,
        this.mod,
        ".stun-minimal-appspace .contact",
        call_receiver
      );
    } else {
      this.receiver.publicKey = call_receiver;
    }

    this.receiver.render();

    if (this.mod?.room_obj?.ui === "video" && !making_call){
      this.callSetting.render();
    }

    this.attachEvents();
  }

  attachEvents() {
    let video_switch = document.getElementById("video_call_switch");
    let call_button = document.getElementById("startcall");

    let recipient = this.receiver.publicKey;

    if (video_switch && call_button) {
      this.activateOptions();

      call_button.onclick = (e) => {

        this.mod.room_obj.ui = video_switch.checked ? "video" : "voice";

        let data = Object.assign({}, this.mod.room_obj);

        this.app.connection.emit("update-media-preference", "video", video_switch.checked);
        this.app.connection.emit("update-media-preference", "ondisconnect", false);

        this.app.connection.emit("relay-send-message", {
          recipient,
          request: "stun-connection-request",
          data,
        });

        //this.startRing();
        this.updateMessage("Dialing...");
        this.deactivateOptions();



        this.dialing = setTimeout(() => {
          this.app.connection.emit("relay-send-message", {
            recipient,
            request: "stun-cancel-connection-request",
            data,
          });
          this.stopRing();
          call_button.innerHTML = "Call";
          this.updateMessage("No answer");
          this.attachEvents();
        }, 10000);

        call_button.innerHTML = "Cancel";

        call_button.onclick = (e) => {
          clearTimeout(this.dialing);
          this.app.connection.emit("relay-send-message", {
            recipient,
            request: "stun-cancel-connection-request",
            data,
          });
          this.stopRing();
          this.app.connection.emit("close-preview-window");
          this.overlay.remove();
        };
      };
    }

    let answer_button = document.getElementById("answercall");
    let reject_button = document.getElementById("rejectcall");

    if (answer_button) {
      answer_button.onclick = (e) => {

        this.app.connection.emit("update-media-preference", "video", (this.mod.room_obj.ui == "video"));
        this.app.connection.emit("update-media-preference", "ondisconnect", false);

        this.app.connection.emit("relay-send-message", {
          recipient,
          request: "stun-connection-accepted",
          data: this.mod.room_obj,
        });

        this.stopRing();
        this.updateMessage("connecting...");
        setTimeout(()=> {
          this.app.connection.emit("close-preview-window");
          this.overlay.remove();
          this.app.connection.emit("stun-init-call-interface", this.mod.room_obj.ui);
          this.app.connection.emit("start-stun-call");
        }, 1000);

      };
    }

    if (reject_button) {
      reject_button.onclick = (e) => {
        this.app.connection.emit("relay-send-message", {
          recipient,
          request: "stun-connection-rejected",
          data: this.mod.room_obj,
        });
        this.stopRing();
        this.mod.room_obj = null;
        this.overlay.remove();
      };
    }
  }

  startRing() {
    try {
      if (!this.ring_sound) {
        this.ring_sound = new Audio("/videocall/audio/ring.mp3");
      }
      this.ring_sound.play();
    } catch (err) {
      console.error(err);
    }
  }
  stopRing() {
    try {
      if (!this.ring_sound) {
        this.ring_sound = new Audio("/videocall/audio/ring.mp3");
      }
      this.ring_sound.pause();
    } catch (err) {
      console.error(err);
    }
  }

  updateMessage(message) {
    let div = document.getElementById("stun-phone-notice");
    if (div) {
      div.innerHTML = message;
    }
  }

  activateOptions() {
    let div = document.querySelector(".video_switch");
    if (div) {
      div.classList.remove("deactivated");
    }

    let video_switch = document.getElementById("video_call_switch");

    video_switch.onchange = (e) => {
      if (video_switch.checked) {
        this.callSetting.render();
      } else {
        this.app.connection.emit("close-preview-window");
      }
    };
  }

  deactivateOptions() {
    let div = document.querySelector(".video_switch");
    div.classList.add("deactivated");

    let video_switch = document.getElementById("video_call_switch");
    video_switch.onchange = null;
  }

  establishStunCallWithPeers(recipients) {
    // salert("Establishing a connection with your peers...");

    // create a room
    if (!this.mod.room_obj) {
      this.mod.room_obj = {
        room_code: this.mod.createRoomCode(),
        host_public_key: this.mod.publicKey,
      };
    }

    // send the information to the other peers and ask them to join the call
    recipients = recipients.filter((player) => {
      return player !== this.publicKey;
    });

    //Temporary only 1 - 1 calls
    this.render(recipients[0], true);
  }

  receiveStunCallMessageFromPeers(tx) {
    let txmsg = tx.returnMessage();
    let sender = tx.from[0].publicKey;
    let data = txmsg.data;

    switch (txmsg.request) {
      case "stun-connection-request":
        if (!this.mod.room_obj) {
          this.mod.room_obj = txmsg.data;
          this.render(sender, false);
          this.startRing();

          //
          // Ping back to let caller know I am online
          // 
          this.app.connection.emit("relay-send-message", {recipient: sender, request: "stun-connection-ping", data});
          break;
        }

      case "stun-cancel-connection-request":
        this.stopRing();
        this.overlay.remove();
        this.mod.room_obj = null;
        siteMessage(`${sender} hung up`);
        break;

      case "stun-connection-rejected":
        this.stopRing();
        this.updateMessage("did not answer");
        this.activateOptions();
        break;

      case "stun-connection-accepted":
        this.stopRing();
        if (this.dialing) {
          clearTimeout(this.dialing);
          this.dialing = null;
        }

        this.updateMessage("connecting...");

        setTimeout(()=> {
          this.app.connection.emit("close-preview-window");
          this.overlay.remove();
          this.app.connection.emit("stun-init-call-interface", this.mod.room_obj.ui);
          this.app.connection.emit("start-stun-call");
        }, 1000);

        break;

      case "stun-connection-ping":
        if (this.dialing){
          clearTimeout(this.dialing);
          this.dialing = setTimeout(() => {
            this.app.connection.emit("relay-send-message", {
              recipient: sender,
              request: "stun-cancel-connection-request",
              data,
            });
            this.stopRing();

            if (document.getElementById("startcall")){
              document.getElementById("startcall").innerHTML = "Call";
            }
            this.updateMessage("No answer");
            this.attachEvents();
          }, 10000);
        }

      default:
    }
  }
}

module.exports = Dialer;
