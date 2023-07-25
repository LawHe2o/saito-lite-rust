const SaitoUserTemplate = require("./../../lib/saito/ui/saito-user/saito-user.template.js");
const saito = require("../../lib/saito/saito");
const ModTemplate = require("../../lib/templates/modtemplate");
const ChatMain = require("./lib/appspace/main");
const SaitoHeader = require("./../../lib/saito/ui/saito-header/saito-header");
const ChatManager = require("./lib/chat-manager/main");
const ChatManagerOverlay = require("./lib/overlays/chat-manager");
const JSON = require("json-bigint");
const localforage = require("localforage");

class Chat extends ModTemplate {
  constructor(app) {
    super(app);

    this.name = "Chat";

    this.description = "Saito instant-messaging client";

    this.groups = [];

    /*
     Array of: 
     {
        id: id,
        members: members, //Array of publickeys
        member_ids: {} // Key->value pairs  :admin / :1 / :0 -- group admin, confirmed, unconfirmed member
        name: name,
        unread: 0, //Number of new messages
        txs: [],
        // Processed TX:
        {
            sig = "string" //To helpfully prevent duplicates??
            ts = number
            from = "string" //Assuming only one sender
            msg = "" // raw message
        }
        last_update
    }
    */

    this.inTransitImageMsgSig = null;

    this.added_identifiers_post_load = 0;

    this.communityGroup = null;
    this.communityGroupName = "Saito Community Chat";

    this.debug = false;

    this.chat_manager = null;

    this.chat_manager_overlay = null;

    this.loading = true;

    this.isRelayConnected = false;

    this.app.connection.on("encrypt-key-exchange-confirm", (data) => {
      this.returnOrCreateChatGroupFromMembers(data?.members);
      this.app.connection.emit("chat-manager-render-request");
    });

    this.app.connection.on("remove-user-from-chat-group", (group_id, member_id) => {
      let group = this.returnGroup(group_id);
      if (group) {
        if (group.members.includes(member_id) && group?.member_ids[this.app.wallet.returnPublicKey()] == "admin"){
          this.sendRemoveMemberTransaction(group, member_id);  
        }
      }
    });

    this.postScripts = ["/saito/lib/emoji-picker/emoji-picker.js"];

    this.theme_options = {
      lite: "fa-solid fa-sun",
      dark: "fa-solid fa-moon",
    };

    this.hiddenTab = "hidden";
    this.orig_title = "";

    return;
  }

  initialize(app) {
    super.initialize(app);

    //
    // if I run a chat service, create it
    //
    if (app.BROWSER == 0) {
      this.communityGroup = this.returnOrCreateChatGroupFromMembers(
        [app.wallet.returnPublicKey()],
        "Saito Community Chat"
      );
       this.communityGroup.members = [app.wallet.returnPublicKey()];

       //
       // Chat server hits archive on boot up so it has something to return 
       // on chat history request
       this.getOlderTransactions(this.communityGroup.id, "localhost");

       return;
    }

    //
    // BROWSERS ONLY
    //

    //Enforce compliance with wallet indexing
    if (!app.options?.chat || !Array.isArray(app.options.chat)) {
      app.options.chat = [];
      this.createDefaultChatsFromKeys();
    }

    this.loadChatGroups();

    //Add script for emoji to work
    this.attachPostScripts();

    // Set the name of the hidden property and the change event for visibility
    let visibilityChange;
    if (typeof document.hidden !== "undefined") {
      // Opera 12.10 and Firefox 18 and later support
      this.hiddenTab = "hidden";
      visibilityChange = "visibilitychange";
    } else if (typeof document.msHidden !== "undefined") {
      this.hiddenTab = "msHidden";
      visibilityChange = "msvisibilitychange";
    } else if (typeof document.webkitHidden !== "undefined") {
      this.hiddenTab = "webkitHidden";
      visibilityChange = "webkitvisibilitychange";
    }

    document.addEventListener(
      visibilityChange,
      () => {
        if (document[this.hiddenTab]) {
        } else {
          if (this.tabInterval) {
            clearInterval(this.tabInterval);
            this.tabInterval = null;
            document.title = this.orig_title;
          }
        }
      },
      false
    );
  }


  render() {
    if (this.app.BROWSER == 1) {
      if (this.app.options.theme) {
        let theme = this.app.options.theme[this.slug];

        if (theme != null) {
          this.app.browser.switchTheme(theme);
        }
      }
    }

    if (this.main == null) {
      this.main = new ChatMain(this.app, this);
      this.header = new SaitoHeader(this.app, this);
      this.addComponent(this.header);
      this.addComponent(this.main);
    }

    if (this.chat_manager == null) {
      this.chat_manager = new ChatManager(this.app, this);
      this.addComponent(this.chat_manager);
    }
    this.chat_manager.container = ".saito-sidebar.left";
    this.chat_manager.chat_popup_container = ".saito-main";
    this.chat_manager.render_manager_to_screen = 1;
    this.chat_manager.render_popups_to_screen = 0;

    super.render();
  }


  onPeerServiceUp(app, peer, service = {}) {
    let chat_self = this;

    if (service.service === "relay"){
      this.isRelayConnected = true;
      this.app.connection.emit("chat-manager-render-request");
    }

    //
    // load private chat
    //
    if (service.service === "archive") {
      if (this.debug) {
        console.log("Chat: onPeerServiceUp", service.service);
      }

      this.loading = this.groups.length;

      for (let group of this.groups) {
        //Let's not hit the Archive for community chat since that is seperately queried on service.service == chat
        if (group.name !== this.communityGroupName) {

          this.app.storage.loadTransactions({ field3 : group.id, limit: 100, created_later_than: group.last_update }, (txs) => {

            chat_self.loading--;

            if (txs) {
              while (txs.length > 0) {
                //Process the chat transaction like a new message
                let tx = txs.pop();
                tx.decryptMessage(chat_self.app);
                chat_self.addTransactionToGroup(group, tx);
              }
            }
          });
        }
      }
    }

    //
    // load public chat
    //
    if (service.service === "chat") {
      if (this.debug) {
        console.log("Chat: onPeerServiceUp", service.service);
      }

      this.communityGroup = this.returnOrCreateChatGroupFromMembers(
        [peer.returnPublicKey()],
        this.communityGroupName
      );
      this.communityGroup.members = [peer.returnPublicKey()];

      if (this.communityGroup) {

        //
        // remove duplicate public chats caused by server update
        //
        for (let i = 0; i < this.groups.length; i++) {
          if (
            this.groups[i].name === this.communityGroup.name &&
            this.groups[i] !== this.communityGroup
          ) {
            if (this.groups[i].members.length == 1) {
              if (!this.app.network.isConnectedToPublicKey(this.groups[i].members[0])) {
                this.app.connection.emit("chat-popup-remove-request", this.groups[i]);
                this.groups.splice(i, 0);
              }
            }
          }
        }

        let newtx = this.app.wallet.createUnsignedTransaction();

        newtx.msg = {
          request: "chat history",
          group_id: this.communityGroup.id,
          ts: this.communityGroup.last_update,
        };

        newtx = this.app.wallet.signTransaction(newtx);

        this.app.network.sendTransactionWithCallback(newtx, (txs) => {
          this.loading--;
          if (this.debug) {
            console.log("chat history callback: " + txs.length);
          }
          // These are no longer proper transactions!!!!

          if (this.communityGroup.txs.length > 0) {
            let most_recent_ts = this.communityGroup.txs[this.communityGroup.txs.length - 1].ts;
            for (let i = 0; i < txs.length; i++) {
              if (txs[i].ts > most_recent_ts) {
                this.communityGroup.txs.push(txs[i]);
              }
            }
          } else {
            this.communityGroup.txs = txs;
          }

          if (this.app.BROWSER) {
            let active_module = app.modules.returnActiveModule();
            if (
              app.browser.isMobileBrowser(navigator.userAgent) ||
              window.innerWidth < 600 ||
              active_module?.request_no_interrupts
            ) {
              this.app.connection.emit("chat-manager-request-no-interrupts");
            }
            this.app.connection.emit("chat-popup-render-request");
          }
        });
      }
    }
  }

  returnServices() {
    let services = [];
    // servers with chat service run plaintext community chat groups
    if (this.app.BROWSER == 0) {
      services.push({ service: "chat", name: "Saito Community Chat" });
    }
    return services;
  }

  respondTo(type, obj = null) {
    let chat_self = this;

    switch (type) {
      case "chat-manager":
        if (this.chat_manager == null) {
          //console.log("Respond to");
          this.chat_manager = new ChatManager(this.app, this);
        }
        return this.chat_manager;
      case "saito-header":
        //TODO:
        //Since the left-sidebar chat-manager disappears at screens less than 1200px wide
        //We need another way to display/open it...
        if (this.app.browser.isMobileBrowser() || (this.app.BROWSER && window.innerWidth < 600)) {
          
          if (this.chat_manger) {
            this.chat_manager.render_popups_to_screen = 0;    
          }
          
          if (this.chat_manager_overlay == null) {
            this.chat_manager_overlay = new ChatManagerOverlay(this.app, this);
          }  
          return [
            {
              text: "Chat",
              icon: "fas fa-comments",
              callback: function (app, id) {
                console.log("Callback for saito-header chat");
                chat_self.chat_manager_overlay.render();
              },
            },
          ];
        }else if (!chat_self.browser_active){
          return [
            {
              text: "Chat",
              icon: "fas fa-comments",
              callback: function (app, id) {
                window.location = "/chat";
              },
            },

            ];
        }
        return null;
      case "user-menu":
        if (obj?.publickey) {
          if (
            chat_self.app.keychain.hasSharedSecret(obj.publickey) &&
            obj.publickey !== chat_self.app.wallet.returnPublicKey()
          ) {
            return {
              text: "Chat",
              icon: "far fa-comment-dots",
              callback: function (app, publickey) {
                if (chat_self.chat_manager == null) {
                  chat_self.chat_manager = new ChatManager(chat_self.app, chat_self);
                }

                chat_self.chat_manager.render_popups_to_screen = 1;
                chat_self.app.connection.emit("open-chat-with", { key: publickey });
              },
            };
          }
        }

        return null;

      case "saito-profile-menu":
        if (obj?.publickey) {
          if (
            chat_self.app.keychain.hasPublicKey(obj.publickey) &&
            obj.publickey !== chat_self.app.wallet.returnPublicKey()
          ) {
            return {
              text: "Chat",
              icon: "far fa-comment-dots",
              callback: function (app, publickey) {
                if (chat_self.chat_manager == null) {
                  chat_self.chat_manager = new ChatManager(chat_self.app, chat_self);
                }

                chat_self.chat_manager.render_popups_to_screen = 1;
                chat_self.app.connection.emit("open-chat-with", { key: publickey });
              },
            };
          }
        }

        return null;
      default:
        return super.respondTo(type);
    }
  }

  //
  // ---------- on chain messages ------------------------
  // ONLY processed if I am in the to/from of the transaction
  // so I will process messages I send to community, but not other peoples
  // it is mostly just a legacy safety catch for direct messaging
  //
  onConfirmation(blk, tx, conf, app) {
    if (conf == 0) {
      tx.decryptMessage(app);

      let txmsg = tx.returnMessage();

      if (this.debug) {
        console.log("Chat onConfirmation: " + txmsg.request);
      }

      if (txmsg.request == "chat message") {
        this.receiveChatTransaction(app, tx, 1);
      }
      if (txmsg.request == "chat group") {
        this.receiveCreateGroupTransaction(app, tx);
      }
      if (txmsg.request == "chat confirm") {
        this.receiveConfirmGroupTransaction(app, tx); 
      }
      if (txmsg.request == "chat add") {
        this.receiveAddMemberTransaction(app, tx);
      }
      if (txmsg.request == "chat remove") {
        this.receiveRemoveMemberTransaction(app, tx);
      }
    }
  }

  //
  // We have a Chat-services peer that does 2 things
  // 1) it uses archive to save all the chat messages passing through it
  // 2) it forwards all messages to everyone through Relay
  // Private messages are encrypted and will be ignored by other parties
  // but this is essential to receive unencrypted community chat messages
  // the trick is that receiveChatTransaction checks if the message is to a group I belong to
  // or addressed to me
  //
  async handlePeerTransaction(app, tx = null, peer, mycallback) {
    if (tx == null) {
      return;
    }

    tx.decryptMessage(app); //In case forwarding private messages
    let txmsg = tx.returnMessage();

    if (!txmsg.request) {
      return;
    }

    if (this.debug) {
      console.log("Chat handlePeerTransaction: " + txmsg.request);
    }

    if (txmsg.request === "chat history") {

      let group = this.returnGroup(txmsg?.group_id);

      if (!group) {
        console.log("Group doesn't exist?");
        return;
      }

      //Just process the most recent 50 (if event that any)
      //Without altering the array!
      //mycallback(group.txs.slice(-50));

      if (mycallback) {
        mycallback(group.txs.filter((t) => t.ts > txmsg.ts));
      }
    }

    if (txmsg.request === "chat message") {
      this.receiveChatTransaction(app, tx);

      //
      // notify sender if requested
      //
      if (mycallback) {
        mycallback({ payload: "success", error: {} });
      }
    } else if (txmsg.request === "chat message broadcast") {

      /*
      * This whole block is duplicating the functional logic of the Relay module....
      */

      let inner_tx = new saito.default.transaction(txmsg.data);
      let inner_txmsg = inner_tx.returnMessage();

      //
      // if chat message broadcast is received - we are being asked to broadcast this
      // to a peer if the inner_tx is addressed to one of our peers.
      //
      if (inner_tx.transaction.to.length > 0) {
        if (inner_tx.transaction.to[0].add != this.app.wallet.returnPublicKey()) {
          if (app.BROWSER == 0) {
            app.network.peers.forEach((p) => {
              if (p.peer.publickey === inner_tx.transaction.to[0].add) {
                p.sendTransactionWithCallback(inner_tx, () => {});
              }
              return;
            });
            return;
          }
        } else {
          //
          // broadcast to me, so send to all non-this-peers
          //
          if (app.BROWSER == 0) {
            app.network.peers.forEach((p) => {
              if (p.peer.publickey !== peer.peer.publickey) {
                p.sendTransactionWithCallback(inner_tx, () => {});
              }
            });
          }
        }
      }

      //
      // notify sender if requested
      //
      if (mycallback) {
        mycallback({ payload: "success", error: {} });
      }
    }
  }


  //
  // Create a n > 2 chat group (currently unencrypted)
  // We have a single admin (who can add additional members or kick people out)
  //
  sendCreateGroupTransaction(group){

    let newtx = this.app.wallet.createUnsignedTransaction(
      this.app.wallet.returnPublicKey(),
      0.0,
      0.0
    );
    if (newtx == null) {
      return;
    }

    for (let i = 0; i < group.members.length; i++) {
      if (group.members[i] !== this.app.wallet.returnPublicKey()) {
        newtx.transaction.to.push(new saito.default.slip(group.members[i]));
      }
    }

    newtx.msg = {
      module: "Chat",
      request: "chat group",
      group_id: group.id,
      group_name: group.name,
      admin: this.app.wallet.returnPublicKey(), 
      timestamp: new Date().getTime(),
    };

    newtx = this.app.wallet.signTransaction(newtx);

    this.app.network.propagateTransaction(newtx);

  }

  receiveCreateGroupTransaction(app, tx) {

    if (tx.isTo(app.wallet.returnPublicKey())) {
        
      let txmsg = tx.returnMessage();

      let group = this.returnGroup(txmsg.group_id);

      //
      //Get the list of all keys message is sent to
      //
      let members = [];
      for (let x = 0; x < tx.transaction.to.length; x++) {
        if (!members.includes(tx.transaction.to[x].add)) {
          members.push(tx.transaction.to[x].add);
        }
      }

      if (group) {
        if (txmsg.group_name){
          console.log("Update group name: " + txmsg.group_name);
          group.name = txmsg.group_name;
        }
      }else{
        group = this.returnOrCreateChatGroupFromMembers(members, txmsg.group_name);
        group.id = txmsg.group_id;
      }

      group.members = members;

      if (!group.member_ids){
        group.member_ids = {};
      }
      for (let m of group.members) {
        if (!group.member_ids[m]){
          group.member_ids[m] = 0;  
        }
      }
      
      group.member_ids[app.wallet.returnPublicKey()] = 1;
      
      if (txmsg.admin){
        group.member_ids[txmsg.admin] = "admin";  
      }
      
      this.saveChatGroup(group);
      this.app.connection.emit("chat-manager-render-request");

      if (!tx.isFrom(app.wallet.returnPublicKey())) {
        this.sendConfirmGroupTransaction(group);
      }
    }
  }

  //
  // We automatically send a confirmation when added to a chat group (just so that we can make sure that the user was successfully added)
  // But in the future, we may add a confirmation interface
  //
  sendConfirmGroupTransaction(group){

    let newtx = this.app.wallet.createUnsignedTransaction(
      this.app.wallet.returnPublicKey(),
      0.0,
      0.0
    );
    if (newtx == null) {
      return;
    }

    for (let i = 0; i < group.members.length; i++) {
      if (group.members[i] !== this.app.wallet.returnPublicKey()) {
        newtx.transaction.to.push(new saito.default.slip(group.members[i]));
      }
    }

    newtx.msg = {
      module: "Chat",
      request: "chat confirm",
      group_id: group.id,
      group_name: group.name,
      timestamp: new Date().getTime(),
    };

    newtx = this.app.wallet.signTransaction(newtx);

    this.app.network.propagateTransaction(newtx);

  }

  receiveConfirmGroupTransaction(app, tx) {

    if (tx.isTo(app.wallet.returnPublicKey()) && !tx.isFrom(app.wallet.returnPublicKey())) {
        
      let txmsg = tx.returnMessage();

      let group = this.returnGroup(txmsg.group_id);

      if (!group){
        this.receiveCreateGroupTransaction(app, tx);
        group = this.returnGroup(txmsg.group_id);        
      }

      if (!group.members.includes(tx.transaction.from[0].add)) {
        group.members.push(tx.transaction.from[0].add);
      }

      //Don't overwrite admin (if for some reason admin is sending a confirm)
      if (!group.member_ids[tx.transaction.from[0].add]){
        group.member_ids[tx.transaction.from[0].add] = 1;
      }

      this.saveChatGroup(group);
    }
  }


  //
  // Add a member to an existing chat group
  //
  sendAddMemberTransaction(group, member) {
      let newtx = this.app.wallet.createUnsignedTransaction(
        this.app.wallet.returnPublicKey(),
        0.0,
        0.0
      );
      if (newtx == null) {
        return;
      }

      if (!group.members.includes(member)){
        group.members.push(member);
      }

      for (let i = 0; i < group.members.length; i++) {
        if (group.members[i] !== this.app.wallet.returnPublicKey()) {
          newtx.transaction.to.push(new saito.default.slip(group.members[i]));
        }
      }


      newtx.msg = {
        module: "Chat",
        request: "chat add",
        group_name: group.name,
        group_id: group.id,
        member_id: member,
      };

      newtx = this.app.wallet.signTransaction(newtx);

      this.app.network.propagateTransaction(newtx);
  }

  receiveAddMemberTransaction(app, tx) {

    if (tx.isTo(app.wallet.returnPublicKey())) {
        
      let txmsg = tx.returnMessage();

      //I am receiving message about being added to the group
      if (app.wallet.returnPublicKey() == txmsg.member_id) {
        this.receiveCreateGroupTransaction(app, tx);
        let group = this.returnGroup(txmsg.group_id);

        tx.msg.message = `<div class="saito-chat-notice">added you to the group</div>`;  
        this.addTransactionToGroup(group, tx);

        return;
      }

      let group = this.returnGroup(txmsg.group_id);

      if (!group){
        console.warn("Chat group not found");
        return;
      }

      if (!group.members.includes(txmsg.member_id)) {
        group.members.push(txmsg.member_id);
      }

      //
      //Don't overwrite confirmed flag if txs arrive out of order
      //
      if (!group.member_ids){
        group.member_ids = {};
      }

      if (!group.member_ids[txmsg.member_id]) {
        group.member_ids[txmsg.member_id] = 0;  
      }
      
        tx.msg.message = `<div class="saito-chat-notice">added ${this.app.browser.returnAddressHTML(txmsg.member_id)} to the group</div>`;  
        this.addTransactionToGroup(group, tx);

//      this.saveChatGroup(group);

    }
  }

  sendRemoveMemberTransaction(group, member) {
      let newtx = this.app.wallet.createUnsignedTransaction(
        this.app.wallet.returnPublicKey(),
        0.0,
        0.0
      );
      if (newtx == null) {
        return;
      }

      for (let i = 0; i < group.members.length; i++) {
        if (group.members[i] !== this.app.wallet.returnPublicKey()) {
          newtx.transaction.to.push(new saito.default.slip(group.members[i]));
        }
      }

      newtx.msg = {
        module: "Chat",
        request: "chat remove",
        group_id: group.id,
        member_id: member,
      };

      newtx = this.app.wallet.signTransaction(newtx);

      this.app.network.propagateTransaction(newtx);

  }

  receiveRemoveMemberTransaction(app, tx) {
    if (tx.isTo(app.wallet.returnPublicKey())) {
        
      let txmsg = tx.returnMessage();

      let group = this.returnGroup(txmsg.group_id);

      if (!group){
        console.warn("Chat group doesn't exist locally");
        return;
      }

      for (let i = 0; i < group.members.length; i++){
        if (group.members[i] == txmsg.member_id){
          group.members.splice(i,1);
          break;
        }
      }

      if (group.member_ids){
        delete group.member_ids[txmsg.member_id];  
      }
      
      if (app.wallet.returnPublicKey() == txmsg.member_id) {
        this.deleteChatGroup(group);
      }else{
        if (tx.isFrom(txmsg.member_id)){
          tx.msg.message = `<div class="saito-chat-notice">left the group</div>`;  
        }else{
          tx.msg.message = `<div class="saito-chat-notice">kicked ${this.app.browser.returnAddressHTML(txmsg.member_id)} out of the group</div>`;  
        }
        
        this.addTransactionToGroup(group, tx);
      }
    }

  }
 

  /**
   *
   * Encrypt and send your chat message
   * We send messages on chain to their target and to the chat-services node via Relay
   *
   */
  sendChatTransaction(app, tx) {
    //
    // won't exist if encrypted
    //
    if (tx.msg.message) {
      if (tx.msg.message.substring(0, 4) == "<img") {
        if (this.inTransitImageMsgSig) {
          salert("Image already being sent");
          return;
        }
        this.inTransitImageMsgSig = tx.transaction.sig;
      }
    }
    if (app.network.peers.length > 0) {
      let recipient = app.network.peers[0].peer.publickey;
      for (let i = 0; i < app.network.peers.length; i++) {
        if (app.network.peers[i].hasService("chat")) {
          recipient = app.network.peers[i].peer.publickey;
          break;
        }
      }

      app.network.propagateTransaction(tx);
      app.connection.emit("relay-send-message", {
        recipient,
        request: "chat message broadcast",
        data: tx.transaction,
      });
    } else {
      salert("Connection to chat server lost");
    }
  }

  createChatTransaction(group_id, msg = "") {
    let newtx = this.app.wallet.createUnsignedTransaction(
      this.app.wallet.returnPublicKey(),
      0.0,
      0.0
    );
    if (newtx == null) {
      return;
    }

    let members = this.returnMembers(group_id);

    for (let i = 0; i < members.length; i++) {
      if (members[i] !== this.app.wallet.returnPublicKey()) {
        newtx.transaction.to.push(new saito.default.slip(members[i]));
      }
    }


    if (msg.substring(0, 4) == "<img") {
      if (this.inTransitImageMsgSig) {
        salert("Image already being sent");
        return;
      }
      this.inTransitImageMsgSig = newtx.transaction.sig;
    }

    newtx.msg = {
      module: "Chat",
      request: "chat message",
      group_id: group_id, 
      message: msg,
      timestamp: new Date().getTime(),
    };

    let group = this.returnGroup(group_id);
    if (group){
      if (!members.includes(group.name)){
        newtx.msg.group_name = group.name;  
      }   
    }

    //
    // swap first two addresses so if private chat we will encrypt with proper shared-secret
    //
    if (newtx.transaction.to.length == 2) {
      let x = newtx.transaction.to[0];
      newtx.transaction.to[0] = newtx.transaction.to[1];
      newtx.transaction.to[1] = x;
    }

    if (members.length == 2) {
      newtx = this.app.wallet.signAndEncryptTransaction(newtx);
    } else {
      newtx = this.app.wallet.signTransaction(newtx);
    }
    return newtx;
  }

  /**
   * Everyone receives the chat message (via the Relay)
   * So we make sure here it is actually for us (otherwise will be encrypted gobbledygook)
   */
  receiveChatTransaction(app, tx, onchain = 0) {
    if (this.inTransitImageMsgSig == tx.transaction.sig) {
      this.inTransitImageMsgSig = null;
    }

    let txmsg = "";

    try {
      tx.decryptMessage(app);
      txmsg = tx.returnMessage();
    } catch (err) {
      console.log("ERROR: " + JSON.stringify(err));
    }

    if (this.debug) {
      console.log("Receive Chat Transaction:");
      console.log(JSON.parse(JSON.stringify(tx)));
      console.log(JSON.parse(JSON.stringify(txmsg)));
    }

    //
    // if to someone else and encrypted
    // (i.e. I am sending an encrypted message and not waiting for relay)
    //
    //if (tx.transaction.from[0].add == app.wallet.returnPublicKey()) {
    //    if (app.keychain.hasSharedSecret(tx.transaction.to[0].add)) {
    //    }
    //}

    //
    // save transactions if getting chat tx over chain
    // and only trigger if you were the sender
    // (should less the duplication effect)
    //
    if (onchain){
      if (this.app.BROWSER) {
        if (tx.isFrom(app.wallet.returnPublicKey())) {
          console.log("Save My Sent Chat TX");
          this.app.storage.saveTransaction(tx, { field3 : txmsg.group_id });
        }
      }
    }

    let group = this.returnGroup(txmsg.group_id);

    if (!group) {

      if (!tx.isTo(app.wallet.returnPublicKey())) {
        if (this.debug) {
          console.log("Chat message not for me");
        }
        return;
      }

      //
      // Create a chat group on the fly if properly addressed to me
      //
      let members = [];
      for (let x = 0; x < tx.transaction.to.length; x++) {
        if (!members.includes(tx.transaction.to[x].add)) {
          members.push(tx.transaction.to[x].add);
        }
      }

      group = this.returnOrCreateChatGroupFromMembers(members, txmsg.group_name);
      group.id = txmsg.group_id;
    
    }


    //Have we already inserted this message into the chat?
    for (let z = 0; z < group.txs.length; z++) {
      if (group.txs[z].sig === tx.transaction.sig) {
        if (this.debug) {
          console.log("Duplicate received message");
        }
        return;
      }
    }

    this.addTransactionToGroup(group, tx);
    app.connection.emit("chat-popup-render-request", group);
  }

  //////////////////
  // UI Functions //
  //////////////////
  //
  // These three functions replace all the templates to format the messages into
  // single speaker blocks
  //
  returnChatBody(group_id) {
    let html = "";
    let group = this.returnGroup(group_id);
    if (!group) {
      return "";
    }

    let message_blocks = this.createMessageBlocks(group);

    for (let block of message_blocks) {
      let ts = 0;
      if (block?.date){
        html += `<div class="saito-time-stamp">${block.date}</div>`;
      }else{
        if (block.length > 0) {
          let sender = "";
          let msg = "";
          for (let z = 0; z < block.length; z++) {
            if (z > 0) {
              msg += "<br>";
            }
            sender = block[z].from[0];
            if (block[z].msg.indexOf("<img") != 0) {
              msg += this.app.browser.sanitize(block[z].msg);
            } else {
              msg += block[z].msg.substring(0, block[z].msg.indexOf(">") + 1);
            }
            ts = ts || block[z].ts;
          }

          //Use FA 5 so compatible in games (until we upgrade everything to FA6)
          const replyButton = `<div data-id="${group_id}" class="saito-userline-reply">reply <i class="fas fa-reply"></i></div>`;
          html += `${SaitoUserTemplate({
            app: this.app,
            publickey: sender,
            notice: msg,
            fourthelem:
              `<div class="saito-chat-line-controls"><span class="saito-chat-line-timestamp">` +
              this.app.browser.returnTime(ts) +
              `</span>${replyButton}</div>`,
          })}`;
        }
      }
    }

    group.unread = 0;

    //Save the status that we have read these messages
    this.saveChatGroup(group);

    return html;
  }

  createMessageBlocks(group) {
    let blocks = [];
    let block = [];
    let last_message_sender = "";
    let last_message_ts = 0;
    let last = new Date(0);

    for (let minimized_tx of group?.txs) {
      //Same Sender -- keep building block 
      let next = new Date(minimized_tx.ts);
      
      if (minimized_tx.from.includes(last_message_sender) && (minimized_tx.ts - last_message_ts) < 300000 && next.getDate() == last.getDate()) {
        block.push(minimized_tx);
      } else {
        //Start new block
        if (block.length > 0){
          blocks.push(block);
          block = [];  
        }
        if (next.getDate() !== last.getDate()){
          if (next.toDateString() == new Date().toDateString()){
            blocks.push({ date: "Today"});
          }else{
            blocks.push( { date: next.toDateString()});
          }
        }
        
        block.push(minimized_tx);
      }
    
      last_message_sender = minimized_tx.from[0];
      last_message_ts = minimized_tx.ts;
      last = next;
    }

    blocks.push(block);
    return blocks;
  }

  //
  // Since we were always testing the timestamp its a good thing we don't manipulate it
  //
  addTransactionToGroup(group, tx) {
    if (this.debug) {
      console.log("Adding Chat TX to group: ", tx);
    }

    // Limit live memory 
    // I may be overly worried about memory leaks
    // If users can dynamically load older messages, this limit creates a problem 
    // when scrolling back in time
    if (!this.app.BROWSER){
      while (group.txs.length > 200) {
        group.txs.shift();
      }

    }

    let content = tx.returnMessage()?.message;
    if (!content) {
      console.warn("Not a chat message?");
      return;
    }
    let new_message = {
      sig: tx.transaction.sig,
      ts: tx.transaction.ts,
      from: [],
      msg: content,
    };

    //Keep the from array just in case....
    for (let sender of tx.transaction.from) {
      if (!new_message.from.includes(sender.add)) {
        new_message.from.push(sender.add);
      }
    }

    for (let i = 0; i < group.txs.length; i++) {
      if (group.txs[i].sig === tx.transaction.sig) {
        if (this.debug) {
          console.log("duplicate");
        }
        return;
      }
      if (tx.transaction.ts < group.txs[i].ts) {
        group.txs.splice(i, 0, new_message);
        group.unread++;

        if (this.debug) {
          console.log("out of order " + i);
          console.log(JSON.parse(JSON.stringify(new_message)));
        }

        return;
      }
    }

    group.txs.push(new_message);

    group.unread++;

    group.last_update = tx.transaction.ts;

    if (!this.app.BROWSER) { 
      return; 
    }

    if (this.debug) {
      console.log(`new msg: ${group.unread} unread`);
      console.log(JSON.parse(JSON.stringify(new_message)));
    }

    if (group.name !== this.communityGroupName && !new_message.from.includes(this.app.wallet.returnPublicKey())) {
      this.startTabNotification();    
      this.app.connection.emit("group-is-active", group);
    }

    //Save to IndexedDB Here
    if (this.loading <= 0) {
      this.saveChatGroup(group);
    } else {
      console.warn(`Not saving because in loading mode (${this.loading})`);
    }
  }

  ///////////////////
  // CHAT UTILITIES //
  ///////////////////
  createGroupIdFromMembers(members = null) {
    if (members == null) {
      return "";
    }
    //So David + Richard == Richard + David
    members.sort();

    return this.app.crypto.hash(`${members.join("_")}`);
  }

  //
  // if we already have a group with these members,
  // returnOrCreateChatGroupFromMembers will find and return it, otherwise
  // it makes a new group
  //
  returnOrCreateChatGroupFromMembers(members = null, name = null, update_name = true) {
    if (!members) {
      return null;
    }
    
    let id;

    //This might keep persistence across server resets
    if (name === this.communityGroupName) {
      id = this.app.crypto.hash(this.communityGroupName);
    }else{
      //Make sure that I am part of the chat group
      if (!members.includes(this.app.wallet.returnPublicKey())){
        members.push(this.app.wallet.returnPublicKey());
      }
      id = this.createGroupIdFromMembers(members);
    }

    if (name == null) {
      name = "";
      for (let i = 0; i < members.length; i++) {
        if (members[i] != this.app.wallet.returnPublicKey()) {
          name += members[i] + ", ";
        }
      }
      if (!name) {
        name = "me";
      } else {
        name = name.substring(0, name.length - 2);
      }
    }

    for (let i = 0; i < this.groups.length; i++) {
      if (this.groups[i].id == id) {
        //console.log(JSON.parse(JSON.stringify(this.groups[i])));
        if (update_name && this.groups[i].name != name){
          this.groups[i].old_name = this.groups[i].name;
          this.groups[i].name = name;
        }else if (this.groups[i].old_name){
          this.groups[i].name = this.groups[i].old_name;
          delete this.groups[i].old_name;
        }
        
        return this.groups[i];
      }
    }


    if (this.debug) {
      console.log("Creating new chat group " + id);
      console.log(JSON.stringify(members));
    }

    let newGroup = {
      id: id,
      members: members,
      name: name,
      txs: [],
      unread: 0,
      last_update: 0,
    };

    //Prepend the community chat
    if (name === this.communityGroupName) {
      this.groups.unshift(newGroup);
    } else {

      this.groups.push(newGroup);
    }

    this.app.connection.emit("chat-manager-render-request");

    return newGroup;
  }

  returnGroup(group_id) {
    for (let i = 0; i < this.groups.length; i++) {
      if (group_id === this.groups[i].id) {
        return this.groups[i];
      }
    }

    return null;
  }

  returnGroupByMemberPublickey(publickey) {
    for (let i = 0; i < this.groups.length; i++) {
      if (this.groups[i].members.includes(publickey)) {
        return this.groups[i];
      }
    }
    return null;
  }

  returnMembers(group_id) {
    for (let i = 0; i < this.groups.length; i++) {
      if (group_id === this.groups[i].id) {
        return [...new Set(this.groups[i].members)];
      }
    }
    return [];
  }

  returnGroupByName(name = "") {
    for (let i = 0; i < this.groups.length; i++) {
      if (this.groups[i].name === name) {
        return this.groups[i];
      }
    }
    return this.groups[0];
  }

  returnCommunityChat() {
    for (let i = 0; i < this.groups.length; i++) {
      if (this.groups[i].name === this.communityGroupName) {
        return this.groups[i];
      }
    }
    return this.groups[0];
  }

  createDefaultChatsFromKeys(){
    //
    // create chatgroups from keychain -- friends only
    //
    let keys = this.app.keychain.returnKeys();
    //console.log("Populate chat list");
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].aes_publickey && !keys[i]?.mute) {
        this.returnOrCreateChatGroupFromMembers(
          [keys[i].publickey],
          keys[i].name,
          false
        );
      }
    }

    //
    // create chatgroups from groups
    //
    let g = this.app.keychain.returnGroups();
    for (let i = 0; i < g.length; i++) {
      this.returnOrCreateChatGroupFromMembers(g[i].members, g[i].name, false);
    }
    this.app.connection.emit("chat-manager-render-request");
  }


  getOlderTransactions(group_id, peer = null){

    let group = this.returnGroup(group_id);

    if (!group) { return; }

    let ts = new Date().getTime();

    if (group.txs.length > 0) {
      ts = group.txs[0].ts;
    }

    let chat_self = this;

    this.app.storage.loadTransactions({ field3 : group.id, limit: 25, created_earlier_than: ts }, (txs) => {

      console.log(`Fetched ${txs?.length} older chat messages from Archive`);

      if (!txs || txs.length < 25){
        this.app.connection.emit("chat-remove-fetch-button-request", group_id);
      }

      if (txs) {
        while (txs.length > 0) {
          //Process the chat transaction like a new message
          let tx = txs.pop();
          tx.decryptMessage(chat_self.app);
          chat_self.addTransactionToGroup(group, tx);
          chat_self.app.connection.emit("chat-popup-render-request", group);
          chat_self.app.connection.emit("chat-popup-scroll-top-request", group_id);
        }
      }

    }, peer);
  }

  ///////////////////
  // LOCAL STORAGE //
  ///////////////////
  loadChatGroups() {
    if (!this.app.BROWSER) {
      return;
    }

    let chat_self = this;
    //console.log("Reading local DB");
    let count = 0;
    for (let g_id of this.app.options.chat) {
      //console.log("Fetch", g_id);
      count++;
      localforage.getItem(`chat_${g_id}`, function (error, value) {
        count --;
        //Because this is async, the initialize function may have created an
        //empty default group

        if (value) {
          let currentGroup = chat_self.returnGroup(g_id);
          if (currentGroup) {
            value.members = currentGroup.members;
            currentGroup = Object.assign(currentGroup, value);
          } else {
            chat_self.groups.push(value);
          }

          //console.log(value);
        }

        if (count === 0){
          chat_self.createDefaultChatsFromKeys();
        }
      });
    }
  }

  saveChatGroup(group) {
    if (!this.app.BROWSER) {
      return;
    }
    let chat_self = this;

    //Save group in app.options
    if (!this.app.options.chat.includes(group.id)) {
      this.app.options.chat.push(group.id);
      this.app.storage.saveOptions();
    }

    let online_status = group.online;

    //Make deep copy
    let new_group = JSON.parse(JSON.stringify(group));
    new_group.online = false;
    new_group.txs = group.txs.slice(-50);

    localforage.setItem(`chat_${group.id}`, new_group).then(function () {
      if (chat_self.debug) {
        console.log("Saved chat history for " + new_group.id);
        console.log(JSON.parse(JSON.stringify(new_group)));
      }
    });
    group.online = online_status;
  }

  deleteChatGroup(group){

    let key_to_update = "";
    for (let i = 0; i < this.groups.length; i++){
      if (this.groups[i].id === group.id){
        if (this.groups[i].members.length == 2){
          for (let member of this.groups[i].members){
            if (member !== this.app.wallet.returnPublicKey()){
              key_to_update = member;
            }
          }
        }

        this.groups.splice(i,1);
        break;
      }
    }

    for (let i = 0; i < this.app.options.chat.length; i++){
      if (this.app.options.chat[i] === group.id){
        this.app.options.chat.splice(i,1);
        break;
      }  
    }

    this.app.storage.saveOptions();

    if (key_to_update){
      this.app.keychain.addKey(key_to_update, {mute: 1});  
    }
    

    localforage.removeItem(`chat_${group.id}`);

    this.app.connection.emit("chat-manager-render-request");
  }


  async onWalletReset(nuke) {
    console.log("Wallet reset");

    if (nuke){
      for (let i = 0; i < this.groups.length; i++) {
        await localforage.removeItem(`chat_${this.groups[i].id}`);
      }
    }
    return 1;
  }

  startTabNotification() {
    if (!this.app.BROWSER) {
      return;
    }
    //If we haven't already started flashing the tab
    let notifications = 0;
    for (let group of this.groups){
      if (group.name !== this.communityGroupName){
        notifications += group.unread;
      }
    }

    if (!this.tabInterval && document[this.hiddenTab]) {
      this.orig_title = document.title;
      this.tabInterval = setInterval(() => {
        if (document.title === this.orig_title) {
          document.title = `(${notifications}) unread message${notifications == 1 ?"":"s"}`;
        } else {
          document.title = "New message";
        }
      }, 650);
    }
  }
}

module.exports = Chat;
