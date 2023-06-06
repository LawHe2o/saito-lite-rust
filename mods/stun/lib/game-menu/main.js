const saito = require("../../../../lib/saito/saito");
class StunxGameMenu {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.config = {
      name: "game",
      container: "#game-chat ul",
      stream_container: 'chat-manager-small-audio-container',
      onHide: () => {
        document.querySelector(".join-group-video-chat").style.display = "block";
      },
      showMain: false
    };



    app.connection.on("game-menu-start-video-call", async (recipients) => {
      console.log("initing peer manager");
      // init peer manager
      app.connection.emit("stun-init-peer-manager", "small", this.config);

      console.log(this.config, "config")

      // create a room
      let room_code = await mod.sendCreateRoomTransaction();

      //Store room_code in stun
      mod.updateGameRoomCode(room_code); 
      //Store room_code in PeerManager
      app.connection.emit("stun-peer-manager-update-room-code", room_code);

      // send the information to the other peers and ask them to join the call
      recipients = recipients.filter((player) => {
        return player !== app.wallet.returnPublicKey();
      });

      // show-small-chat-manager
      app.connection.emit("show-chat-manager-small", false);
      // change ui from start to join
      document.querySelector("#start-group-video-chat").style.display = "none";
      // document.querySelector('#join-group-video-chat').style.display = "block"

      let data = {
        type: "connection-request",
        room_code,
        sender: app.wallet.returnPublicKey(),
      };

      this.mod.sendGameCallMessageToPeers(app, data, recipients);
    });

    app.connection.on("game-menu-join-video-call", (data) => {
      console.log("initing peer manager", data);
      mod.updateGameRoomCode(data.room_code);

      // init peer manager
      app.connection.emit("stun-init-peer-manager", "small", this.config);
      app.connection.emit("stun-peer-manager-update-room-code", data.room_code);

      // send the information to the other peers and ask them to join the call
      // show-small-chat-manager
      app.connection.emit("show-chat-manager-small", true);

      document.querySelector("#start-group-video-chat").style.display = "none";
      document.querySelector("#join-group-video-chat").style.display = "none";
    });
  }

}

module.exports = StunxGameMenu;
